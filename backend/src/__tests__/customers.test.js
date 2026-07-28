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
    // §5.3 lifecycle badge: unconfirmed open Calls read as proposed.
    expect(res.body.customer.upcomingServices.every(s => s.lifecycleState === 'proposed')).toBe(true);
    expect(res.body.customer.lastSelection).toBeNull();
  });

  it('marks an upcoming service confirmed once the customer submits a selection', async () => {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Cara', phoneNumber: '+13330003333' });
    await assignCycleToCustomer(businessId, customer.id, cycle.id, token, 2);

    const svc = await knex('customer_services').where('customer_id', customer.id).first();
    const task = await knex('service_tasks').where('customer_service_id', svc.id).orderBy('id').first();
    const firstCycle = await knex('selection_cycles')
      .where('customer_id', customer.id).orderBy('service_date', 'asc').first();

    const login = await request(app)
      .post('/api/auth/customers/login')
      .send({ phoneNumber: '+13330003333' });
    await request(app)
      .post(`/api/customers/${customer.id}/selection-cycle/${firstCycle.id}/submit`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ selectedTasks: [task.id], selectedTotalHours: 1 });

    const res = await request(app)
      .get(`/api/businesses/${businessId}/customers/${customer.id}`)
      .set('Authorization', `Bearer ${token}`);

    const confirmed = res.body.customer.upcomingServices.find(s => s.id === firstCycle.id);
    expect(confirmed.lifecycleState).toBe('confirmed');
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

// ─── IN-APP FEEDBACK — STAR RATING ────────────────────────────────────────────

describe('POST /api/customers/:customerId/feedback (rating)', () => {
  async function setupCustomerCycle() {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Rita', phoneNumber: '+13330004444' });
    await assignCycleToCustomer(businessId, customer.id, cycle.id, token, 2);
    const firstCycle = await knex('selection_cycles')
      .where('customer_id', customer.id).orderBy('service_date', 'asc').first();
    const login = await request(app)
      .post('/api/auth/customers/login')
      .send({ phoneNumber: '+13330004444' });
    return { customer, firstCycle, custToken: login.body.token };
  }

  it('stores and returns an optional star rating', async () => {
    const { customer, firstCycle, custToken } = await setupCustomerCycle();

    const res = await request(app)
      .post(`/api/customers/${customer.id}/feedback`)
      .set('Authorization', `Bearer ${custToken}`)
      .field('selectionCycleId', String(firstCycle.id))
      .field('rating', '4')
      .field('feedbackText', 'Great job');

    expect(res.status).toBe(200);
    expect(res.body.feedback.rating).toBe(4);
    expect(res.body.feedback.feedbackText).toBe('Great job');

    const get = await request(app)
      .get(`/api/customers/${customer.id}/feedback/${firstCycle.id}`)
      .set('Authorization', `Bearer ${custToken}`);
    expect(get.body.feedback.rating).toBe(4);
  });

  it('allows feedback with no rating (rating optional → null)', async () => {
    const { customer, firstCycle, custToken } = await setupCustomerCycle();

    const res = await request(app)
      .post(`/api/customers/${customer.id}/feedback`)
      .set('Authorization', `Bearer ${custToken}`)
      .field('selectionCycleId', String(firstCycle.id))
      .field('feedbackText', 'No stars this time');

    expect(res.status).toBe(200);
    expect(res.body.feedback.rating).toBeNull();
  });

  it('updates the rating in place on re-submit', async () => {
    const { customer, firstCycle, custToken } = await setupCustomerCycle();

    await request(app)
      .post(`/api/customers/${customer.id}/feedback`)
      .set('Authorization', `Bearer ${custToken}`)
      .field('selectionCycleId', String(firstCycle.id))
      .field('rating', '2');

    const res = await request(app)
      .post(`/api/customers/${customer.id}/feedback`)
      .set('Authorization', `Bearer ${custToken}`)
      .field('selectionCycleId', String(firstCycle.id))
      .field('rating', '5');

    expect(res.body.feedback.rating).toBe(5);
    const rows = await knex('feedbacks')
      .where('customer_id', customer.id).where('selection_cycle_id', firstCycle.id);
    expect(rows).toHaveLength(1);
  });

  it('rejects an out-of-range rating', async () => {
    const { customer, firstCycle, custToken } = await setupCustomerCycle();

    const res = await request(app)
      .post(`/api/customers/${customer.id}/feedback`)
      .set('Authorization', `Bearer ${custToken}`)
      .field('selectionCycleId', String(firstCycle.id))
      .field('rating', '7');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
