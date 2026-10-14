const request = require('supertest');
const {
  app, knex, truncateAllTables, createTestBusiness, addCustomerToBusiness,
} = require('./helpers');

// Web portal M3 (Customers): the customer list carries address + pin coords +
// geocodeStatus for the map, and the detail route now returns the geocodeStatus
// getCustomerDetails always computed (previously dropped by the route mapping).

let businessId, token;
const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeEach(async () => {
  await truncateAllTables();
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  token = biz.token;
});
afterAll(async () => { await knex.destroy(); });

// Seed the three address states directly (no Mapbox call in tests).
async function seedCustomers() {
  const mapped = await addCustomerToBusiness(businessId, token, { name: 'Mapped', phoneNumber: '+13330005001' });
  const failed = await addCustomerToBusiness(businessId, token, { name: 'Failed', phoneNumber: '+13330005002' });
  const none = await addCustomerToBusiness(businessId, token, { name: 'NoAddr', phoneNumber: '+13330005003' });
  await knex('customers').where('id', mapped.id).update({ address: '1 Main St, Lincoln, NE', lat: 40.8136, lng: -96.7026 });
  await knex('customers').where('id', failed.id).update({ address: 'nowhere', geocode_attempts: 99 });
  return { mapped, failed, none };
}

describe('GET /api/businesses/:businessId/customers — map fields', () => {
  it('returns address, numeric lat/lng, and geocodeStatus per customer', async () => {
    const { mapped, failed, none } = await seedCustomers();
    const res = await auth(request(app).get(`/api/businesses/${businessId}/customers`));
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.customers.map(c => [c.id, c]));

    expect(byId[mapped.id]).toMatchObject({ address: '1 Main St, Lincoln, NE', lat: 40.8136, lng: -96.7026, geocodeStatus: 'ok' });
    expect(byId[failed.id]).toMatchObject({ address: 'nowhere', lat: null, lng: null, geocodeStatus: 'failed' });
    expect(byId[none.id]).toMatchObject({ address: null, lat: null, lng: null, geocodeStatus: 'none' });
    // Existing fields untouched.
    expect(byId[mapped.id].assignedCycles).toEqual([]);
  });
});

describe('GET /api/businesses/:businessId/customers/:customerId — geocode fields', () => {
  it('returns geocodeStatus, geocodeRelevance and coords on the detail', async () => {
    const { mapped, failed } = await seedCustomers();
    await knex('customers').where('id', failed.id).update({ geocode_relevance: 0.42 });

    const ok = await auth(request(app).get(`/api/businesses/${businessId}/customers/${mapped.id}`));
    expect(ok.status).toBe(200);
    expect(ok.body.customer).toMatchObject({ geocodeStatus: 'ok', lat: 40.8136, lng: -96.7026 });

    const bad = await auth(request(app).get(`/api/businesses/${businessId}/customers/${failed.id}`));
    expect(bad.body.customer).toMatchObject({ geocodeStatus: 'failed', geocodeRelevance: 0.42, lat: null, lng: null });
  });

  it('still 404s on another business\'s customer', async () => {
    const { mapped } = await seedCustomers();
    const other = await createTestBusiness();
    const res = await request(app).get(`/api/businesses/${other.business.id}/customers/${mapped.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});
