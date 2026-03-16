const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestTask, createTestServiceCycle,
  addCustomerToBusiness, assignCycleToCustomer
} = require('./helpers');

let businessId, token, task, cycle;

beforeEach(async () => {
  await truncateAllTables();
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  token = biz.token;
  task = await createTestTask(businessId, token, { timeAllotmentMinutes: 60 });
  cycle = await createTestServiceCycle(businessId, token, [task.id]);
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

// ─── ASSIGN CYCLE ─────────────────────────────────────────────────────────────

describe('POST /api/businesses/:businessId/customers/:customerId/assign-cycle', () => {
  it('assigns a customer to a service cycle and generates upcoming selection cycles', async () => {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });

    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers/${customer.id}/assign-cycle`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceCycleId: cycle.id, totalHours: 3 });

    expect(res.status).toBe(201);
    expect(res.body.assignment.totalHours).toBe(3);
    expect(res.body.assignment.serviceCycleId).toBe(cycle.id);

    // Verify selection cycles were generated
    const selectionCycles = await knex('selection_cycles').where('customer_id', customer.id);
    expect(selectionCycles.length).toBeGreaterThan(0);
  });

  it('returns 409 when already assigned', async () => {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });
    await assignCycleToCustomer(businessId, customer.id, cycle.id, token, 3);

    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers/${customer.id}/assign-cycle`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceCycleId: cycle.id, totalHours: 3 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_ASSIGNED');
  });

  it('returns 400 when totalHours is missing', async () => {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });

    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers/${customer.id}/assign-cycle`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceCycleId: cycle.id });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent service cycle', async () => {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });

    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers/${customer.id}/assign-cycle`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceCycleId: 99999, totalHours: 3 });

    expect(res.status).toBe(404);
  });
});
