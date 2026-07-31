const { knex, truncateAllTables } = require('./helpers');
const SignalHouseProvider = require('../services/sms/SignalHouseProvider');

const PHONE = '+15551234567';

function fakeSmsClient() {
  const calls = [];
  return {
    calls,
    messages: {
      sendSMS: async (p) => { calls.push(p); return { success: true, status: 201, data: { insertedMessages: [{ _id: 'M' }], enqueuedCount: 1 } }; },
    },
  };
}

// P5: self-built OTP (SignalHouse has no Verify product). Codes are hashed, expiring,
// single-use, attempt-limited, throttled. Exercised with a deterministic generator
// + DB; dev-mode stores/logs the code instead of sending.
describe('P5: SignalHouse OTP self-build', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterEach(() => {
    for (const k of ['SIGNALHOUSE_API_KEY', 'SIGNALHOUSE_BASE_URL', 'SIGNALHOUSE_OTP_SENDER']) {
      if (OLD_ENV[k] === undefined) delete process.env[k];
      else process.env[k] = OLD_ENV[k];
    }
  });

  afterAll(async () => {
    await knex.destroy();
  });

  test('dev-mode: sendOtp stores a hashed code, verifyOtp accepts it once (single use)', async () => {
    const p = new SignalHouseProvider({ otpGenerator: () => '123456' });
    await p.sendOtp(PHONE);

    const row = await knex('otp_codes').where('phone', PHONE).first();
    expect(row).toBeTruthy();
    expect(row.code_hash).not.toContain('123456'); // stored hashed, not raw

    expect(await p.verifyOtp(PHONE, '123456')).toBe(true);
    expect(await p.verifyOtp(PHONE, '123456')).toBe(false); // already consumed
  });

  test('wrong code fails and increments attempts; locks after the max', async () => {
    const p = new SignalHouseProvider({ otpGenerator: () => '123456' });
    await p.sendOtp(PHONE);

    for (let i = 0; i < 5; i++) {
      expect(await p.verifyOtp(PHONE, '000000')).toBe(false);
    }
    // Now locked — even the correct code is rejected.
    expect(await p.verifyOtp(PHONE, '123456')).toBe(false);
    const row = await knex('otp_codes').where('phone', PHONE).first();
    expect(row.attempts).toBe(5);
  });

  test('expired code is rejected', async () => {
    const p = new SignalHouseProvider({ otpGenerator: () => '123456' });
    await p.sendOtp(PHONE);
    await knex('otp_codes').where('phone', PHONE).update({ expires_at: new Date(Date.now() - 1000) });
    expect(await p.verifyOtp(PHONE, '123456')).toBe(false);
  });

  test('resend within the throttle window is rejected with 429', async () => {
    const p = new SignalHouseProvider({ otpGenerator: () => '123456' });
    await p.sendOtp(PHONE);
    await expect(p.sendOtp(PHONE)).rejects.toMatchObject({ status: 429 });
  });

  test('unknown phone → verifyOtp false', async () => {
    const p = new SignalHouseProvider({ otpGenerator: () => '123456' });
    expect(await p.verifyOtp('+15550000000', '123456')).toBe(false);
  });

  test('configured: sends the code from the OTP sender number via the SDK', async () => {
    process.env.SIGNALHOUSE_API_KEY = 'test-key';
    process.env.SIGNALHOUSE_BASE_URL = 'https://v2staging.signalhouse.io';
    process.env.SIGNALHOUSE_OTP_SENDER = '+15559990000';
    const client = fakeSmsClient();
    const p = new SignalHouseProvider({ client, otpGenerator: () => '654321' });

    await p.sendOtp(PHONE);

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].senderPhoneNumber).toBe('15559990000');
    expect(client.calls[0].recipientPhoneNumbers).toEqual(['15551234567']);
    expect(client.calls[0].messageBody).toContain('654321');
    // The code still verifies against the stored hash.
    expect(await p.verifyOtp(PHONE, '654321')).toBe(true);
  });
});
