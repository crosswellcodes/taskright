const request = require('supertest');
const { app, knex, truncateAllTables } = require('./helpers');

beforeEach(async () => { await truncateAllTables(); });
afterAll(async () => { await knex.destroy(); });

// ─── BUSINESS AUTH ────────────────────────────────────────────────────────────

describe('POST /api/auth/businesses/signup', () => {
  it('creates a business and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/businesses/signup')
      .send({ name: 'CleanCo', phoneNumber: '+15550001111' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.business.name).toBe('CleanCo');
    expect(res.body.business.phoneNumber).toBe('+15550001111');
    expect(res.body.token).toBeDefined();
    expect(res.body.expiresIn).toBe('24h');
  });

  it('returns 409 for duplicate phone number', async () => {
    await request(app)
      .post('/api/auth/businesses/signup')
      .send({ name: 'CleanCo', phoneNumber: '+15550001111' });

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
});

describe('POST /api/auth/businesses/login', () => {
  it('logs in and returns token', async () => {
    await request(app)
      .post('/api/auth/businesses/signup')
      .send({ name: 'CleanCo', phoneNumber: '+15550001111' });

    const res = await request(app)
      .post('/api/auth/businesses/login')
      .send({ phoneNumber: '+15550001111' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.business.phoneNumber).toBe('+15550001111');
  });

  it('returns 404 for unknown phone number', async () => {
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
    const res = await request(app)
      .post('/api/auth/businesses/signup')
      .send({ name: 'CleanCo', phoneNumber: '+15550001111' });
    businessId = res.body.business.id;
  });

  it('creates a customer and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/customers/signup')
      .send({ phoneNumber: '+14440001111', businessId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.customer.phoneNumber).toBe('+14440001111');
    expect(res.body.customer.businessId).toBe(businessId);
    expect(res.body.token).toBeDefined();
  });

  it('returns 404 for unknown businessId', async () => {
    const res = await request(app)
      .post('/api/auth/customers/signup')
      .send({ phoneNumber: '+14440001111', businessId: 99999 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 for duplicate phone + business', async () => {
    await request(app)
      .post('/api/auth/customers/signup')
      .send({ phoneNumber: '+14440001111', businessId });

    const res = await request(app)
      .post('/api/auth/customers/signup')
      .send({ phoneNumber: '+14440001111', businessId });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/customers/login', () => {
  it('logs in and returns token', async () => {
    const bizRes = await request(app)
      .post('/api/auth/businesses/signup')
      .send({ name: 'CleanCo', phoneNumber: '+15550001111' });
    const businessId = bizRes.body.business.id;

    await request(app)
      .post('/api/auth/customers/signup')
      .send({ phoneNumber: '+14440001111', businessId });

    const res = await request(app)
      .post('/api/auth/customers/login')
      .send({ phoneNumber: '+14440001111' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('returns 404 for unknown phone number', async () => {
    const res = await request(app)
      .post('/api/auth/customers/login')
      .send({ phoneNumber: '+19999999999' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
