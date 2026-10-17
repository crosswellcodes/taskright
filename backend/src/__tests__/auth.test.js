const request = require('supertest');
const { app, knex, truncateAllTables, authPost, issueTestOtp } = require('./helpers');

// Every login and signup (business, customer, team member; web and mobile)
// requires a texted code via otpGate: missing → 401 OTP_REQUIRED, wrong →
// 400 INVALID_OTP. Valid codes come from helpers.issueTestOtp.

beforeEach(async () => { await truncateAllTables(); });
afterAll(async () => { await knex.destroy(); });

const signupBusiness = (body = {}) =>
  authPost('/api/auth/businesses/signup', { name: 'CleanCo', phoneNumber: '+15550001111', ...body });

// ─── BUSINESS AUTH ────────────────────────────────────────────────────────────

describe('POST /api/auth/businesses/signup', () => {
  it('creates a business and returns token', async () => {
    const res = await signupBusiness();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.business.name).toBe('CleanCo');
    expect(res.body.business.phoneNumber).toBe('+15550001111');
    expect(res.body.token).toBeDefined();
    expect(res.body.expiresIn).toBe('24h');
  });

  it('returns 401 OTP_REQUIRED without a code and creates nothing', async () => {
    const res = await request(app)
      .post('/api/auth/businesses/signup')
      .send({ name: 'CleanCo', phoneNumber: '+15550001111' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('OTP_REQUIRED');
    expect(res.body.token).toBeUndefined();
    expect(await knex('businesses').count('* as n').first()).toEqual({ n: '0' });
  });

  it('returns 400 INVALID_OTP for a wrong code', async () => {
    await issueTestOtp('+15550001111');
    const res = await request(app)
      .post('/api/auth/businesses/signup')
      .send({ name: 'CleanCo', phoneNumber: '+15550001111', otpCode: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_OTP');
  });

  it('returns 409 for duplicate phone number before asking for a code', async () => {
    await signupBusiness();

    const res = await request(app)
      .post('/api/auth/businesses/signup')
      .send({ name: 'Another Co', phoneNumber: '+15550001111' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('DUPLICATE_PHONE');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/auth/businesses/signup')
      .send({ phoneNumber: '+15550001111' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when phone number is missing', async () => {
    const res = await request(app)
      .post('/api/auth/businesses/signup')
      .send({ name: 'CleanCo' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns joinCode in the signup response', async () => {
    const res = await signupBusiness({ name: 'TestBiz', phoneNumber: '+15550002222' });

    expect(res.status).toBe(201);
    expect(res.body.business.joinCode).toBeDefined();
    expect(res.body.business.joinCode).toHaveLength(6);
  });
});

describe('POST /api/auth/businesses/login', () => {
  it('verifies the code and logs in', async () => {
    await signupBusiness();

    const res = await authPost('/api/auth/businesses/login', { phoneNumber: '+15550001111' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.business.phoneNumber).toBe('+15550001111');
  });

  it('returns 401 OTP_REQUIRED and no token without a code (the old mobile flow)', async () => {
    await signupBusiness();

    const res = await request(app)
      .post('/api/auth/businesses/login')
      .send({ phoneNumber: '+15550001111' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('OTP_REQUIRED');
    expect(res.body.token).toBeUndefined();
  });

  it('rejects a wrong code', async () => {
    await signupBusiness();
    await issueTestOtp('+15550001111');

    const res = await request(app)
      .post('/api/auth/businesses/login')
      .send({ phoneNumber: '+15550001111', otpCode: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_OTP');
  });

  it('a code works once', async () => {
    await signupBusiness();
    const otpCode = await issueTestOtp('+15550001111');
    const first = await request(app).post('/api/auth/businesses/login').send({ phoneNumber: '+15550001111', otpCode });
    const second = await request(app).post('/api/auth/businesses/login').send({ phoneNumber: '+15550001111', otpCode });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(second.body.code).toBe('INVALID_OTP');
  });

  it('returns 404 for unknown phone number, with or without a code', async () => {
    const res = await request(app)
      .post('/api/auth/businesses/login')
      .send({ phoneNumber: '+19999999999' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when phone number is missing', async () => {
    const res = await request(app)
      .post('/api/auth/businesses/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── CUSTOMER AUTH ────────────────────────────────────────────────────────────

describe('POST /api/auth/customers/signup', () => {
  let businessId;

  beforeEach(async () => {
    businessId = (await signupBusiness()).body.business.id;
  });

  it('creates a customer and returns token', async () => {
    const res = await authPost('/api/auth/customers/signup', { phoneNumber: '+14440001111', businessId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.customer.phoneNumber).toBe('+14440001111');
    expect(res.body.customer.businessId).toBe(businessId);
    expect(res.body.token).toBeDefined();
  });

  it('stores the customer name when provided', async () => {
    const res = await authPost('/api/auth/customers/signup', { phoneNumber: '+14440001111', businessId, name: 'Sarah Johnson' });

    expect(res.status).toBe(201);
    expect(res.body.customer.phoneNumber).toBe('+14440001111');
  });

  it('returns 401 OTP_REQUIRED without a code', async () => {
    const res = await request(app)
      .post('/api/auth/customers/signup')
      .send({ phoneNumber: '+14440001111', businessId });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('OTP_REQUIRED');
  });

  it('returns 404 for unknown businessId', async () => {
    const res = await authPost('/api/auth/customers/signup', { phoneNumber: '+14440001111', businessId: 99999 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 for duplicate phone + business', async () => {
    await authPost('/api/auth/customers/signup', { phoneNumber: '+14440001111', businessId });

    const res = await authPost('/api/auth/customers/signup', { phoneNumber: '+14440001111', businessId });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/customers/login', () => {
  beforeEach(async () => {
    const businessId = (await signupBusiness()).body.business.id;
    await authPost('/api/auth/customers/signup', { phoneNumber: '+14440001111', businessId });
  });

  it('logs in with a valid code', async () => {
    const res = await authPost('/api/auth/customers/login', { phoneNumber: '+14440001111' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 OTP_REQUIRED and no token without a code', async () => {
    const res = await request(app).post('/api/auth/customers/login').send({ phoneNumber: '+14440001111' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('OTP_REQUIRED');
    expect(res.body.token).toBeUndefined();
  });

  it('rejects a wrong code', async () => {
    await issueTestOtp('+14440001111');
    const res = await request(app).post('/api/auth/customers/login').send({ phoneNumber: '+14440001111', otpCode: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_OTP');
  });

  it('returns 404 for unknown phone number', async () => {
    const res = await request(app).post('/api/auth/customers/login').send({ phoneNumber: '+19999999999' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── TEAM MEMBER AUTH ─────────────────────────────────────────────────────────

describe('team member auth', () => {
  const PHONE = '+13335559201';
  let inviteCode;

  beforeEach(async () => {
    const { body } = await signupBusiness();
    const member = (await request(app)
      .post(`/api/businesses/${body.business.id}/team-members`)
      .set('Authorization', `Bearer ${body.token}`)
      .send({ name: 'Ann', phoneNumber: PHONE, weeklyHours: 40 })).body.teamMember;
    inviteCode = (await knex('team_members').where('id', member.id).first()).invite_code;
  });

  const acceptInvite = (code) =>
    request(app).post('/api/auth/team-members/accept-invite').send({ phoneNumber: PHONE, inviteCode: code });
  const wrongCode = () => (inviteCode === '999999' ? '999998' : '999999');

  it('accepts the invite with the right code (no texted code needed)', async () => {
    const res = await acceptInvite(inviteCode);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('locks the invite for 15 minutes after 5 wrong codes — even the right code', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await acceptInvite(wrongCode())).status).toBe(401);
    }

    const locked = await acceptInvite(inviteCode);
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('INVITE_LOCKED');

    const row = await knex('team_members').where('phone_number', PHONE).first();
    const minutes = (new Date(row.invite_locked_until).getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
    expect(row.invite_code).toBe(inviteCode); // owner doesn't have to re-share
  });

  it('accepts again once the lock expires, and clears the counters', async () => {
    await knex('team_members').where('phone_number', PHONE)
      .update({ invite_locked_until: new Date(Date.now() - 1000), invite_failed_attempts: 0 });

    const res = await acceptInvite(inviteCode);
    expect(res.status).toBe(200);
    const row = await knex('team_members').where('phone_number', PHONE).first();
    expect(row.invite_failed_attempts).toBe(0);
    expect(row.invite_locked_until).toBeNull();
  });

  it('fewer than 5 wrong codes do not lock', async () => {
    for (let i = 0; i < 4; i++) await acceptInvite(wrongCode());

    expect((await acceptInvite(inviteCode)).status).toBe(200);
  });

  it('login: 403 before the invite is accepted', async () => {
    const res = await authPost('/api/auth/team-members/login', { phoneNumber: PHONE });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INVITE_PENDING');
  });

  it('login: requires a code after the invite is accepted', async () => {
    await acceptInvite(inviteCode);

    const noCode = await request(app).post('/api/auth/team-members/login').send({ phoneNumber: PHONE });
    expect(noCode.status).toBe(401);
    expect(noCode.body.code).toBe('OTP_REQUIRED');
    expect(noCode.body.token).toBeUndefined();

    const ok = await authPost('/api/auth/team-members/login', { phoneNumber: PHONE });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeDefined();
  });

  it('login: rejects a wrong code', async () => {
    await acceptInvite(inviteCode);
    await issueTestOtp(PHONE);

    const res = await request(app).post('/api/auth/team-members/login').send({ phoneNumber: PHONE, otpCode: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_OTP');
  });
});

// ─── DEV BYPASS (OTP_DEV_BYPASS_CODE) ─────────────────────────────────────────

describe('OTP dev bypass', () => {
  const saved = {};
  beforeEach(() => { for (const k of ['OTP_DEV_BYPASS_CODE', 'NODE_ENV']) saved[k] = process.env[k]; });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  const login = (phoneNumber, otpCode) =>
    request(app).post('/api/auth/businesses/login').send({ phoneNumber, otpCode });

  it('accepts the bypass code for a +1555 number, with no stored code', async () => {
    await signupBusiness();
    await knex('otp_codes').del();
    process.env.OTP_DEV_BYPASS_CODE = '424242';

    const res = await login('+15550001111', '424242');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects any other code for a +1555 number while the bypass is on', async () => {
    await signupBusiness();
    process.env.OTP_DEV_BYPASS_CODE = '424242';

    expect((await login('+15550001111', '123456')).status).toBe(400);
  });

  it('send skips the provider for a +1555 number (no stored code)', async () => {
    process.env.OTP_DEV_BYPASS_CODE = '424242';
    await knex('otp_codes').del();

    const res = await request(app).post('/api/auth/verify/send').send({ phoneNumber: '+15550001111' });
    expect(res.status).toBe(200);
    expect(await knex('otp_codes').count('* as n').first()).toEqual({ n: '0' });
  });

  it('never applies to a real (non-555) number', async () => {
    const businessId = (await signupBusiness()).body.business.id;
    await authPost('/api/auth/customers/signup', { phoneNumber: '+14440001111', businessId });
    process.env.OTP_DEV_BYPASS_CODE = '424242';

    const res = await request(app).post('/api/auth/customers/login').send({ phoneNumber: '+14440001111', otpCode: '424242' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_OTP');
  });

  it('is ignored when NODE_ENV is production', async () => {
    await signupBusiness();
    process.env.OTP_DEV_BYPASS_CODE = '424242';
    process.env.NODE_ENV = 'production';

    expect((await login('+15550001111', '424242')).status).toBe(400);
  });

  it('is off when OTP_DEV_BYPASS_CODE is unset', async () => {
    await signupBusiness();
    delete process.env.OTP_DEV_BYPASS_CODE;

    expect((await login('+15550001111', '424242')).status).toBe(400);
  });
});

// ─── BUSINESS JOIN CODE ───────────────────────────────────────────────────────

describe('GET /api/auth/businesses/join/:joinCode', () => {
  let joinCode;

  beforeEach(async () => {
    joinCode = (await signupBusiness()).body.business.joinCode;
  });

  it('returns businessId and businessName for a valid join code', async () => {
    const res = await request(app).get(`/api/auth/businesses/join/${joinCode}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.businessName).toBe('CleanCo');
    expect(res.body.businessId).toBeDefined();
  });

  it('is case-insensitive', async () => {
    const res = await request(app).get(`/api/auth/businesses/join/${joinCode.toLowerCase()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for an invalid join code', async () => {
    const res = await request(app).get('/api/auth/businesses/join/INVALID');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_JOIN_CODE');
  });
});
