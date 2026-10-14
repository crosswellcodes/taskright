const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestServiceCycle, getServiceTasksForCustomer,
  addCustomerToBusiness, assignCycleToCustomer
} = require('./helpers');

// Phase 2: template menus are inline task objects.
const TASK = { name: 'Service task', timeAllotmentMinutes: 60 };

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
    const cycle = await createTestServiceCycle(businessId, token, [TASK]);

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
    expect(firstService.totalHours).toBe(4);
  });

  it('reflects submitted selections in forecast', async () => {
    const cycle = await createTestServiceCycle(businessId, token, [TASK]);

    const customer = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330001111' });
    await assignCycleToCustomer(businessId, customer.id, cycle.id, token, 2);

    // Customer submits a selection
    const loginRes = await request(app)
      .post('/api/auth/customers/login')
      .send({ phoneNumber: '+13330001111' });
    const custToken = loginRes.body.token;
    const custId = loginRes.body.customer.id;

    const scRow = await knex('selection_cycles').where('customer_id', custId).orderBy('service_date').first();
    const [svcTask] = await getServiceTasksForCustomer(custId);

    await request(app)
      .post(`/api/customers/${custId}/selection-cycle/${scRow.id}/submit`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ selectedTasks: [svcTask.id], selectedTotalHours: 1 });

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
    expect(submittedService.customerSelectionsStatus.pending).toBe(0);
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

// ─── FORECAST DATE RANGE (WEB_PORTAL M2 month calendar) ───────────────────────

describe('GET /api/businesses/:businessId/selections?from=&to=', () => {
  const get = (qs) => request(app)
    .get(`/api/businesses/${businessId}/selections${qs}`)
    .set('Authorization', `Bearer ${token}`);
  const dayKey = (s) => String(s).split('T')[0];
  const plusDays = (n) => new Date(Date.now() + n * 864e5).toISOString().split('T')[0];

  // Two Calls for one customer: one moved into the past + completed, one moved
  // beyond the default 30-day window.
  async function seedPastAndFar() {
    const cycle = await createTestServiceCycle(businessId, token, [TASK]);
    const c = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330003333' });
    await assignCycleToCustomer(businessId, c.id, cycle.id, token, 2);
    const [first, second] = await knex('selection_cycles').where('customer_id', c.id).orderBy('service_date');
    await knex('selection_cycles').where('id', first.id).update({ service_date: '2020-01-15', status: 'completed' });
    const far = plusDays(45);
    await knex('selection_cycles').where('id', second.id).update({ service_date: far });
    return { pastId: first.id, farId: second.id, far };
  }

  it('omitting the range keeps the default today..+30 window', async () => {
    const { pastId, farId } = await seedPastAndFar();
    const res = await get('');
    expect(res.status).toBe(200);
    const ids = res.body.summary.upcomingServices
      .flatMap(d => d.serviceCycles.flatMap(s => [...s.pendingCustomers, ...s.submittedCustomers]))
      .map(e => e.selectionCycleId);
    expect(ids).not.toContain(pastId);
    expect(ids).not.toContain(farId);
  });

  it('returns past Calls in range with lifecycleState completed', async () => {
    const { pastId } = await seedPastAndFar();
    const res = await get('?from=2020-01-01&to=2020-01-31');
    expect(res.status).toBe(200);
    expect(res.body.summary.upcomingServices).toHaveLength(1);
    const day = res.body.summary.upcomingServices[0];
    expect(dayKey(day.serviceDate)).toBe('2020-01-15');
    const entry = day.serviceCycles[0].pendingCustomers[0];
    expect(entry.selectionCycleId).toBe(pastId);
    expect(entry.lifecycleState).toBe('completed');
  });

  it('returns Calls beyond 30 days with lifecycleState proposed', async () => {
    const { farId, far } = await seedPastAndFar();
    const res = await get(`?from=${plusDays(40)}&to=${plusDays(50)}`);
    expect(res.status).toBe(200);
    const day = res.body.summary.upcomingServices.find(d => dayKey(d.serviceDate) === far);
    expect(day).toBeDefined();
    const entry = day.serviceCycles[0].pendingCustomers.find(e => e.selectionCycleId === farId);
    expect(entry.lifecycleState).toBe('proposed');
  });

  it('rejects a partial, malformed, inverted, or >62-day range with 400', async () => {
    for (const qs of ['?from=2026-01-01', '?from=2026-1-1&to=2026-01-31', '?from=2026-02-01&to=2026-01-01', '?from=2026-01-01&to=2026-03-15']) {
      const res = await get(qs);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });
});

// ─── PER-CALL ASSIGNMENT OWNERSHIP ────────────────────────────────────────────

describe('PUT /api/businesses/:businessId/assignments/:selectionCycleId ownership', () => {
  let callId, memberId;

  beforeEach(async () => {
    const cycle = await createTestServiceCycle(businessId, token, [TASK]);
    const c = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330004444' });
    await assignCycleToCustomer(businessId, c.id, cycle.id, token, 2);
    callId = (await knex('selection_cycles').where('customer_id', c.id).first()).id;
    const m = await request(app).post(`/api/businesses/${businessId}/team-members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bob', phoneNumber: '+13330004445', weeklyHours: 40 });
    memberId = m.body.teamMember.id;
  });

  it('assigns an owned member to an owned Call', async () => {
    const res = await request(app).put(`/api/businesses/${businessId}/assignments/${callId}`)
      .set('Authorization', `Bearer ${token}`).send({ teamMemberId: memberId });
    expect(res.status).toBe(200);
    const row = await knex('service_assignments').where('selection_cycle_id', callId).first();
    expect(row.team_member_id).toBe(memberId);
  });

  it('404s on another business\'s Call and leaves its assignment untouched', async () => {
    await request(app).put(`/api/businesses/${businessId}/assignments/${callId}`)
      .set('Authorization', `Bearer ${token}`).send({ teamMemberId: memberId });

    const other = await createTestBusiness();
    const m2 = await request(app).post(`/api/businesses/${other.business.id}/team-members`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ name: 'Zoe', phoneNumber: '+13330004446', weeklyHours: 40 });

    const res = await request(app).put(`/api/businesses/${other.business.id}/assignments/${callId}`)
      .set('Authorization', `Bearer ${other.token}`).send({ teamMemberId: m2.body.teamMember.id });
    expect(res.status).toBe(404);
    const row = await knex('service_assignments').where('selection_cycle_id', callId).first();
    expect(row.team_member_id).toBe(memberId);
    expect(row.business_id).toBe(businessId);
  });

  it('404s on an assignee owned by another business', async () => {
    const other = await createTestBusiness();
    const m2 = await request(app).post(`/api/businesses/${other.business.id}/team-members`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ name: 'Zoe', phoneNumber: '+13330004447', weeklyHours: 40 });

    const res = await request(app).put(`/api/businesses/${businessId}/assignments/${callId}`)
      .set('Authorization', `Bearer ${token}`).send({ teamMemberId: m2.body.teamMember.id });
    expect(res.status).toBe(404);
    expect(await knex('service_assignments').where('selection_cycle_id', callId).first()).toBeUndefined();
  });
});

// ─── MARK SERVICE COMPLETE ────────────────────────────────────────────────────

describe('POST /api/businesses/:businessId/customers/:customerId/mark-service-complete', () => {
  it('marks a selection cycle as complete', async () => {
    const cycle = await createTestServiceCycle(businessId, token, [TASK]);
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
    const cycle = await createTestServiceCycle(businessId, token, [TASK]);
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
