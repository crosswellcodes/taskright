const request = require('supertest');
const { app, knex, truncateAllTables } = require('./helpers');
const SignalHouseProvider = require('../services/sms/SignalHouseProvider');

// App-level limit on POST /api/auth/verify/send (services/otpRateLimit.js):
// per phone 3/10 min + 10/day, per client IP 20/hour + 100/day, counted in
// otp_send_events. Codes go through the SignalHouse dev path (stored + logged,
// never texted — no SIGNALHOUSE_* env in tests).

const PHONE = '+14025550100';
const send = (phoneNumber, headers = {}) =>
  request(app).post('/api/auth/verify/send').set(headers).send({ phoneNumber });

// Seed `n` prior sends `agoSec` seconds ago.
async function seedSends(n, { phone = PHONE, ip = '203.0.113.9', agoSec = 60, distinctPhones = false } = {}) {
  const rows = Array.from({ length: n }, (_, i) => ({
    phone: distinctPhones ? `+1402555${String(1000 + i)}` : phone,
    ip,
    created_at: knex.raw(`now() - make_interval(secs => ${agoSec})`),
  }));
  await knex('otp_send_events').insert(rows);
}

const count = async (where = {}) =>
  Number((await knex('otp_send_events').where(where).count('* as n').first()).n);

const saved = {};
beforeEach(async () => {
  await truncateAllTables();
  for (const k of ['SMS_PROVIDER_OTP', 'OTP_DEV_BYPASS_CODE', 'OTP_PROXY_SECRET']) saved[k] = process.env[k];
  process.env.SMS_PROVIDER_OTP = 'signalhouse';
  delete process.env.OTP_DEV_BYPASS_CODE;
  delete process.env.OTP_PROXY_SECRET;
});
afterEach(() => {
  jest.restoreAllMocks();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
afterAll(async () => { await knex.destroy(); });

describe('per-phone limit', () => {
  it('allows a send and records it with the client IP', async () => {
    const res = await send(PHONE);
    expect(res.status).toBe(200);
    const rows = await knex('otp_send_events').select('phone', 'ip');
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe(PHONE);
    expect(rows[0].ip).toBeTruthy();
  });

  it('blocks the 4th code in 10 minutes with 429 RATE_LIMITED + Retry-After', async () => {
    await seedSends(3, { agoSec: 5 * 60 });

    const res = await send(PHONE);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.body.error).toMatch(/try again in \d+ minutes?/);
    // Oldest of the 3 ages out ~5 min from now.
    expect(res.body.retryAfterSeconds).toBeGreaterThan(280);
    expect(res.body.retryAfterSeconds).toBeLessThanOrEqual(300);
    expect(res.headers['retry-after']).toBe(String(res.body.retryAfterSeconds));
    expect(await count()).toBe(3); // the refused send isn't counted
    expect(await knex('otp_codes').count('* as n').first()).toEqual({ n: '0' });
  });

  it('sends older than 10 minutes free up the short window', async () => {
    await seedSends(3, { agoSec: 11 * 60 });
    expect((await send(PHONE)).status).toBe(200);
  });

  it('caps a phone at 10 codes a day', async () => {
    await seedSends(10, { agoSec: 2 * 60 * 60 });

    const res = await send(PHONE);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.body.error).toMatch(/hours?/);
    expect(res.body.retryAfterSeconds).toBeGreaterThan(21 * 60 * 60);
  });

  it('normalizes the number before counting (10-digit and E.164 share a limit)', async () => {
    await seedSends(3, { agoSec: 60 });
    expect((await send('(402) 555-0100')).status).toBe(429);
  });
});

describe('per-IP limit', () => {
  it('blocks a 21st code in an hour from one IP across different numbers', async () => {
    await send(PHONE);
    const { ip } = await knex('otp_send_events').first('ip');
    await seedSends(19, { ip, agoSec: 10 * 60, distinctPhones: true });

    const res = await send('+14025550199');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
  });

  it('serializes a parallel burst so it cannot slip past the count', async () => {
    await send(PHONE);
    const { ip } = await knex('otp_send_events').first('ip');
    await seedSends(17, { ip, agoSec: 10 * 60, distinctPhones: true });

    const phones = ['+14025550201', '+14025550202', '+14025550203', '+14025550204', '+14025550205'];
    const results = await Promise.all(phones.map((p) => send(p)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    expect(results.filter((r) => r.status === 429)).toHaveLength(3);
    expect(await count({ ip })).toBe(20);
  });

  it('trusts a forwarded client IP only with the matching proxy secret', async () => {
    process.env.OTP_PROXY_SECRET = 'bff-secret';

    await send(PHONE, { 'X-TaskRight-Proxy-Secret': 'bff-secret', 'X-TaskRight-Client-IP': '198.51.100.7' });
    await send('+14025550101', { 'X-TaskRight-Proxy-Secret': 'wrong', 'X-TaskRight-Client-IP': '198.51.100.8' });
    delete process.env.OTP_PROXY_SECRET;
    await send('+14025550102', { 'X-TaskRight-Proxy-Secret': 'bff-secret', 'X-TaskRight-Client-IP': '198.51.100.9' });

    const ips = (await knex('otp_send_events').orderBy('id').select('ip')).map((r) => r.ip);
    expect(ips[0]).toBe('198.51.100.7');
    expect(ips[1]).not.toBe('198.51.100.8');
    expect(ips[2]).not.toBe('198.51.100.9');
  });

  it('limits portal users by their own IP, not the proxy\'s', async () => {
    process.env.OTP_PROXY_SECRET = 'bff-secret';
    await seedSends(20, { ip: '198.51.100.7', agoSec: 60, distinctPhones: true });
    const via = (ip) => ({ 'X-TaskRight-Proxy-Secret': 'bff-secret', 'X-TaskRight-Client-IP': ip });

    expect((await send(PHONE, via('198.51.100.7'))).status).toBe(429);
    expect((await send(PHONE, via('198.51.100.50'))).status).toBe(200);
  });
});

describe('what counts', () => {
  it('a provider failure is not counted against the user', async () => {
    jest.spyOn(SignalHouseProvider.prototype, 'sendOtp').mockRejectedValue(new Error('provider down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await send(PHONE);
    expect(res.status).toBe(500);
    expect(await count()).toBe(0);
  });

  it('the provider\'s own 60s resend throttle still maps to RATE_LIMITED and is not counted', async () => {
    expect((await send(PHONE)).status).toBe(200);
    const res = await send(PHONE);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(await count()).toBe(1);
  });

  it('prunes sends older than a day', async () => {
    await seedSends(2, { agoSec: 2 * 24 * 60 * 60 });
    await send(PHONE);
    expect(await count()).toBe(1);
  });

  it('the local 555 dev bypass is never limited or counted', async () => {
    process.env.OTP_DEV_BYPASS_CODE = '424242';
    await seedSends(10, { phone: '+15550001111', agoSec: 60 });

    expect((await send('+15550001111')).status).toBe(200);
    expect(await count()).toBe(10);
  });
});

describe('US numbers only', () => {
  it.each(['+447911123456', '12345', '+1402555010', '+1402555010012345678'])('rejects %s with 400 and sends nothing', async (phoneNumber) => {
    const res = await send(phoneNumber);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await count()).toBe(0);
  });
});
