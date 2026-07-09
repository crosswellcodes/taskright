const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestServiceCycle,
  addCustomerToBusiness, assignCycleToCustomer
} = require('./helpers');

let businessId, token, cycle;

beforeEach(async () => {
  await truncateAllTables();
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  token = biz.token;
  cycle = await createTestServiceCycle(businessId, token, [{ name: 'Service task', timeAllotmentMinutes: 60 }]);
});
afterAll(async () => { await knex.destroy(); });

// ─── ADD CUSTOMER ─────────────────────────────────────────────────────────────

describe('POST /api/businesses/:businessId/customers', () => {
  it('adds a customer to the business', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice Smith', phoneNumber: '+13330001111' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.customer.name).toBe('Alice Smith');
    expect(res.body.customer.phoneNumber).toBe('+13330001111');
    expect(res.body.customer.businessId).toBe(businessId);
  });

  it('returns 409 for duplicate phone number within same business', async () => {
    await request(app)
      .post(`/api/businesses/${businessId}/customers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice', phoneNumber: '+13330001111' });

    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice Again', phoneNumber: '+13330001111' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_CUSTOMER');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: '+13330001111' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid phone format', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice', phoneNumber: '5550001111' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers`)
      .send({ name: 'Alice', phoneNumber: '+13330001111' });

    expect(res.status).toBe(401);
  });
});

// ─── GET CUSTOMERS ────────────────────────────────────────────────────────────

describe('GET /api/businesses/:businessId/customers', () => {
  it('returns all customers with assignedCycles', async () => {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });
    await assignCycleToCustomer(businessId, customer.id, cycle.id, token, 2);

    const res = await request(app)
      .get(`/api/businesses/${businessId}/customers`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.customers).toHaveLength(1);
    expect(res.body.customers[0].name).toBe('Alice');
    expect(res.body.customers[0].assignedCycles).toHaveLength(1);
    expect(res.body.customers[0].assignedCycles[0].totalHours).toBe(2);
    expect(res.body.total).toBe(1);
  });

  it('returns empty array when no customers', async () => {
    const res = await request(app)
      .get(`/api/businesses/${businessId}/customers`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.customers).toHaveLength(0);
  });
});

// ─── GET CUSTOMER DETAILS ─────────────────────────────────────────────────────

describe('GET /api/businesses/:businessId/customers/:customerId', () => {
  it('returns customer with upcomingServices and lastSelection', async () => {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Bob', phoneNumber: '+13330002222' });
    await assignCycleToCustomer(businessId, customer.id, cycle.id, token, 2);

    const res = await request(app)
      .get(`/api/businesses/${businessId}/customers/${customer.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.customer.name).toBe('Bob');
    expect(res.body.customer.assignedCycles).toHaveLength(1);
    expect(Array.isArray(res.body.customer.upcomingServices)).toBe(true);
    expect(res.body.customer.upcomingServices.length).toBeGreaterThan(0);
    expect(res.body.customer.lastSelection).toBeNull();
  });

  it('returns 404 for non-existent customer', async () => {
    const res = await request(app)
      .get(`/api/businesses/${businessId}/customers/99999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ─── CREATE SERVICE FROM TEMPLATE ─────────────────────────────────────────────
// (Formerly POST /assign-cycle — removed in Service Model C4. Seeding a Service
//  from a template is now POST /customers/:id/services with { templateId }.)

const soon = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

describe('POST /api/businesses/:businessId/customers/:customerId/services (template-seeded)', () => {
  it('creates a Service seeded from a template and generates upcoming service calls', async () => {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });

    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers/${customer.id}/services`)
      .set('Authorization', `Bearer ${token}`)
      .send({ templateId: cycle.id, totalHours: 3, startDate: soon() });

    expect(res.status).toBe(201);
    expect(Number(res.body.service.total_hours)).toBe(3);
    expect(res.body.service.template_id).toBe(cycle.id); // provenance

    const selectionCycles = await knex('selection_cycles').where('customer_id', customer.id);
    expect(selectionCycles.length).toBeGreaterThan(0);
  });

  it('returns 400 when totalHours is missing', async () => {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });

    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers/${customer.id}/services`)
      .set('Authorization', `Bearer ${token}`)
      .send({ templateId: cycle.id, startDate: soon() });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent template', async () => {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });

    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers/${customer.id}/services`)
      .set('Authorization', `Bearer ${token}`)
      .send({ templateId: 99999, totalHours: 3, startDate: soon() });

    expect(res.status).toBe(404);
  });
});
