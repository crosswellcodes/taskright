const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestCustomer, createTestTask,
  createTestServiceCycle, addCustomerToBusiness, assignCycleToCustomer
} = require('./helpers');

let businessId, bizToken, customerId, custToken, selectionCycleId, task1, task2;

beforeEach(async () => {
  await truncateAllTables();

  // Business setup
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  bizToken = biz.token;

  // Tasks (60 min each — 2 tasks = 2 hours, fits in 3-hour budget)
  task1 = await createTestTask(businessId, bizToken, { name: 'Task A', timeAllotmentMinutes: 60 });
  task2 = await createTestTask(businessId, bizToken, { name: 'Task B', timeAllotmentMinutes: 60 });

  // Service cycle
  const cycle = await createTestServiceCycle(businessId, bizToken, [task1.id, task2.id]);

  // Add customer via business owner
  const added = await addCustomerToBusiness(businessId, bizToken, { name: 'Alice', phoneNumber: '+13330001111' });
  customerId = added.id;

  // Assign cycle (3 hours = 180 min max)
  await assignCycleToCustomer(businessId, customerId, cycle.id, bizToken, 3);

  // Customer logs in
  const custRes = await createTestCustomer(businessId, { phoneNumber: '+13330001111' });
  // The customer already exists from addCustomerToBusiness, so we login instead
  const loginRes = await request(app)
    .post('/api/auth/customers/login')
    .send({ phoneNumber: '+13330001111' });
  custToken = loginRes.body.token;
  customerId = loginRes.body.customer.id;

  // Get the selection cycle ID
  const scRow = await knex('selection_cycles').where('customer_id', customerId).first();
  selectionCycleId = scRow.id;
});
afterAll(async () => { await knex.destroy(); });

// ─── CURRENT SELECTION CYCLE ──────────────────────────────────────────────────

describe('GET /api/customers/:customerId/selection-cycle/current', () => {
  it('returns the current open selection cycle with available tasks', async () => {
    const res = await request(app)
      .get(`/api/customers/${customerId}/selection-cycle/current`)
      .set('Authorization', `Bearer ${custToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.selectionCycle.status).toBe('open');
    expect(res.body.selectionCycle.totalHours).toBe(3);
    expect(res.body.selectionCycle.totalMinutesAvailable).toBe(180);
    expect(res.body.selectionCycle.availableTasks).toHaveLength(2);
    expect(res.body.selectionCycle.serviceDate).toBeDefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .get(`/api/customers/${customerId}/selection-cycle/current`);

    expect(res.status).toBe(401);
  });

  it('returns 403 with another customer token', async () => {
    const other = await createTestBusiness();
    const otherCust = await addCustomerToBusiness(other.business.id, other.token, { name: 'Bob', phoneNumber: '+13330009999' });
    const otherLogin = await request(app)
      .post('/api/auth/customers/login')
      .send({ phoneNumber: '+13330009999' });

    const res = await request(app)
      .get(`/api/customers/${customerId}/selection-cycle/current`)
      .set('Authorization', `Bearer ${otherLogin.body.token}`);

    expect(res.status).toBe(403);
  });
});

// ─── SUBMIT SELECTIONS ────────────────────────────────────────────────────────

describe('POST /api/customers/:customerId/selection-cycle/:selectionCycleId/submit', () => {
  it('submits valid selections successfully', async () => {
    const res = await request(app)
      .post(`/api/customers/${customerId}/selection-cycle/${selectionCycleId}/submit`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ selectedTasks: [task1.id], selectedTotalHours: 1 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.selection.status).toBe('submitted');
    expect(res.body.selection.selectedTasks).toContain(task1.id);
    expect(res.body.selection.message).toContain('Selection locked');
  });

  it('returns 400 when selected time exceeds limit', async () => {
    // task1 (60) + task2 (60) + hypothetical overage: add a 3rd task worth 70min
    // To trigger TIME_EXCEEDED, create a task > 180min total
    // 60 + 60 = 120min, within limit. We need a task that alone = 200min
    const bigTask = await createTestTask(businessId, bizToken, { name: 'Big Task', timeAllotmentMinutes: 200 });

    // Re-assign the cycle to include bigTask
    // Directly insert the task into the existing service cycle's task_assignments
    const cycleRow = await knex('customer_cycle_assignments').where('customer_id', customerId).first();
    await knex('task_assignments').insert({
      task_id: bigTask.id,
      service_cycle_id: cycleRow.service_cycle_id,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    });

    const res = await request(app)
      .post(`/api/customers/${customerId}/selection-cycle/${selectionCycleId}/submit`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ selectedTasks: [bigTask.id], selectedTotalHours: 3 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TIME_EXCEEDED');
    expect(res.body.availableMinutes).toBe(180);
    expect(res.body.selectedMinutes).toBe(200);
  });

  it('returns 409 when submitting twice', async () => {
    await request(app)
      .post(`/api/customers/${customerId}/selection-cycle/${selectionCycleId}/submit`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ selectedTasks: [task1.id], selectedTotalHours: 1 });

    const res = await request(app)
      .post(`/api/customers/${customerId}/selection-cycle/${selectionCycleId}/submit`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ selectedTasks: [task2.id], selectedTotalHours: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_SUBMITTED');
  });

  it('returns 400 when selectedTasks is empty', async () => {
    const res = await request(app)
      .post(`/api/customers/${customerId}/selection-cycle/${selectionCycleId}/submit`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ selectedTasks: [], selectedTotalHours: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a task not in this cycle', async () => {
    // Create a task not assigned to this cycle
    const outsideTask = await createTestTask(businessId, bizToken, { name: 'Outside Task', timeAllotmentMinutes: 10 });

    const res = await request(app)
      .post(`/api/customers/${customerId}/selection-cycle/${selectionCycleId}/submit`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ selectedTasks: [outsideTask.id], selectedTotalHours: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TASK');
  });

  it('returns 404 for non-existent selection cycle', async () => {
    const res = await request(app)
      .post(`/api/customers/${customerId}/selection-cycle/99999/submit`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ selectedTasks: [task1.id], selectedTotalHours: 1 });

    expect(res.status).toBe(404);
  });
});

// ─── SELECTION HISTORY ────────────────────────────────────────────────────────

describe('GET /api/customers/:customerId/selection-history', () => {
  it('returns empty history before any submissions', async () => {
    const res = await request(app)
      .get(`/api/customers/${customerId}/selection-history`)
      .set('Authorization', `Bearer ${custToken}`);

    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('returns submitted selections in history', async () => {
    await request(app)
      .post(`/api/customers/${customerId}/selection-cycle/${selectionCycleId}/submit`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ selectedTasks: [task1.id], selectedTotalHours: 1 });

    const res = await request(app)
      .get(`/api/customers/${customerId}/selection-history`)
      .set('Authorization', `Bearer ${custToken}`);

    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].selectedTasks).toContain(task1.id);
    // status is the selection_cycle status: 'open' until the service is marked complete
    expect(['open', 'completed']).toContain(res.body.history[0].status);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .get(`/api/customers/${customerId}/selection-history`);

    expect(res.status).toBe(401);
  });
});
