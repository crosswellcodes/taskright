const request = require('supertest');
const { app, knex, truncateAllTables, createTestBusiness } = require('./helpers');

beforeEach(async () => { await truncateAllTables(); });
afterAll(async () => { await knex.destroy(); });

// Web portal M0: self business profile — used by the dashboard shell header
// and the Account module.
describe('GET /api/businesses/:businessId', () => {
  it('returns the authenticated business\'s own profile', async () => {
    const { business, token } = await createTestBusiness({ name: 'CleanCo' });

    const res = await request(app)
      .get(`/api/businesses/${business.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.business.id).toBe(business.id);
    expect(res.body.business.name).toBe('CleanCo');
    expect(res.body.business.phoneNumber).toBe(business.phoneNumber);
    expect(res.body.business.joinCode).toBeDefined();
    expect(res.body.business.timeZone).toBe('America/Chicago'); // migration 029 default
  });

  it('returns 403 when requesting another business\'s profile', async () => {
    const { business: businessA } = await createTestBusiness({ name: 'A Co' });
    const { token: tokenB } = await createTestBusiness({ name: 'B Co' });

    const res = await request(app)
      .get(`/api/businesses/${businessA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without a token', async () => {
    const { business } = await createTestBusiness({ name: 'CleanCo' });

    const res = await request(app).get(`/api/businesses/${business.id}`);

    expect(res.status).toBe(401);
  });
});
