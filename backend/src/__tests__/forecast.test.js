const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestTask, createTestServiceCycle,
  addCustomerToBusiness, assignCycleToCustomer
} = require('./helpers');

let businessId, token;

beforeEach(async () => {
  await truncateAllTables();
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  token = biz.token;
});
afterAll(async () => { await knex.destroy(); });

// ─── FORECAST ─────────────────────────────────────────────────────────────────

describe('GET /api/businesses/:businessId/selections', () => {
  it('returns totalCustomers 0 when no customers', async () => {
    const res = await request(app)
      .get(`/api/businesses/${businessId}/selections`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary.totalCustomers).toBe(0);
    expect(res.body.summary.upcomingServices).toHaveLength(0);
  });

  it('returns upcoming services grouped by date after assigning customers', async () => {
    const task = await createTestTask(businessId, token, { timeAllotmentMinutes: 60 });
    const cycle = await createTestServiceCycle(businessId, token, [task.id]);

    const c1 = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });
    const c2 = await addCustomerToBusiness(businessId, token, { name: 'Bob', phoneNumber: '+13330002222' });

    await assignCycleToCustomer(businessId, c1.id, cycle.id, token, 2);
    await assignCycleToCustomer(businessId, c2.id, cycle.id, token, 2);

    const res = await request(app)
      .get(`/api/businesses/${businessId}/selections`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalCustomers).toBe(2);
    // Should have upcoming services within the next 30 days
    expect(res.body.summary.upcomingServices.length).toBeGreaterThan(0);

    const firstService = res.body.summary.upcomingServices[0];
    expect(firstService.serviceDate).toBeDefined();
    expect(firstService.customerSelectionsStatus.pending).toBe(2);
    expect(firstService.customerSelectionsStatus.submitted).toBe(0);
    expect(firstService.totalHoursForecast).toBeNull();
  });

  it('reflects submitted selections in forecast', async () => {
    const task = await createTestTask(businessId, token, { timeAllotmentMinutes: 60 });
    const cycle = await createTestServiceCycle(businessId, token, [task.id]);

    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });
    await assignCycleToCustomer(businessId, customer.id, cycle.id, token, 2);

    // Customer submits a selection
    const loginRes = await request(app)
      .post('/api/auth/customers/login')
      .send({ phoneNumber: '+13330001111' });
    const custToken = loginRes.body.token;
    const custId = loginRes.body.customer.id;

    const scRow = await knex('selection_cycles').where('customer_id', custId).orderBy('service_date').first();

    await request(app)
      .post(`/api/customers/${custId}/selection-cycle/${scRow.id}/submit`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ selectedTasks: [task.id], selectedTotalHours: 1 });

    const res = await request(app)
      .get(`/api/businesses/${businessId}/selections`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Find the service date that was just submitted
    const submittedService = res.body.summary.upcomingServices.find(
      s => s.customerSelectionsStatus.submitted > 0
    );
    expect(submittedService).toBeDefined();
    expect(submittedService.customerSelectionsStatus.submitted).toBe(1);
    expect(submittedService.totalHoursForecast).toBe(1);
    expect(submittedService.tasks[0].taskId).toBe(task.id);
    expect(submittedService.tasks[0].selectedByCustomers).toBe(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .get(`/api/businesses/${businessId}/selections`);

    expect(res.status).toBe(401);
  });

  it('returns 403 with another business token', async () => {
    const other = await createTestBusiness();

    const res = await request(app)
      .get(`/api/businesses/${businessId}/selections`)
      .set('Authorization', `Bearer ${other.token}`);

    expect(res.status).toBe(403);
  });
});

// ─── MARK SERVICE COMPLETE ────────────────────────────────────────────────────

describe('POST /api/businesses/:businessId/customers/:customerId/mark-service-complete', () => {
  it('marks a selection cycle as complete', async () => {
    const task = await createTestTask(businessId, token, { timeAllotmentMinutes: 60 });
    const cycle = await createTestServiceCycle(businessId, token, [task.id]);
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });
    await assignCycleToCustomer(businessId, customer.id, cycle.id, token, 2);

    const scRow = await knex('selection_cycles').where('customer_id', customer.id).first();

    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers/${customer.id}/mark-service-complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selectionCycleId: scRow.id, notes: 'All done' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.serviceCompletion.notes).toBe('All done');

    // Verify status updated in DB
    const updatedCycle = await knex('selection_cycles').where('id', scRow.id).first();
    expect(updatedCycle.status).toBe('completed');
  });

  it('returns 409 when marking the same service complete twice', async () => {
    const task = await createTestTask(businessId, token, { timeAllotmentMinutes: 60 });
    const cycle = await createTestServiceCycle(businessId, token, [task.id]);
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });
    await assignCycleToCustomer(businessId, customer.id, cycle.id, token, 2);

    const scRow = await knex('selection_cycles').where('customer_id', customer.id).first();

    await request(app)
      .post(`/api/businesses/${businessId}/customers/${customer.id}/mark-service-complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selectionCycleId: scRow.id });

    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers/${customer.id}/mark-service-complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selectionCycleId: scRow.id });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_COMPLETED');
  });

  it('returns 400 when selectionCycleId is missing', async () => {
    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });

    const res = await request(app)
      .post(`/api/businesses/${businessId}/customers/${customer.id}/mark-service-complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
