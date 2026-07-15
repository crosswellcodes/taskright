const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestCustomer,
  createTestServiceCycle, getServiceTasksForCustomer,
  addCustomerToBusiness, assignCycleToCustomer
} = require('./helpers');

// SERVICE_CALL_LIFECYCLE.md §7 — the proposed → confirmed → completed derivation on
// GET /api/businesses/:businessId/selection-cycles/:selectionCycleId.

let businessId, bizToken, customerId, custToken, selectionCycleId, taskA, taskB;

beforeEach(async () => {
  await truncateAllTables();

  const biz = await createTestBusiness();
  businessId = biz.business.id;
  bizToken = biz.token;

  // Two-task menu: A = 60 min, B = 90 min.
  const cycle = await createTestServiceCycle(businessId, bizToken, [
    { name: 'Wipe counters', timeAllotmentMinutes: 60 },
    { name: 'Vacuum floors', timeAllotmentMinutes: 90 },
  ]);

  const added = await addCustomerToBusiness(businessId, bizToken, { name: 'Alice', phoneNumber: '+13330001111' });
  customerId = added.id;

  // Service definition: expected 3 total hours.
  await assignCycleToCustomer(businessId, customerId, cycle.id, bizToken, 3);

  const svcTasks = await getServiceTasksForCustomer(customerId);
  taskA = svcTasks[0];
  taskB = svcTasks[1];

  const loginRes = await request(app)
    .post('/api/auth/customers/login')
    .send({ phoneNumber: '+13330001111' });
  custToken = loginRes.body.token;
  customerId = loginRes.body.customer.id;

  const scRow = await knex('selection_cycles')
    .where('customer_id', customerId)
    .orderBy('service_date', 'asc')
    .first();
  selectionCycleId = scRow.id;

  // D2 expected-price copy (assign flow leaves price null when no price_per_visit set).
  await knex('selection_cycles').where('id', selectionCycleId).update({ price: 150 });
});
afterAll(async () => { await knex.destroy(); });

const getDetail = () =>
  request(app)
    .get(`/api/businesses/${businessId}/selection-cycles/${selectionCycleId}`)
    .set('Authorization', `Bearer ${bizToken}`);

const submit = (selectedTasks, selectedTotalHours) =>
  request(app)
    .post(`/api/customers/${customerId}/selection-cycle/${selectionCycleId}/submit`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ selectedTasks, selectedTotalHours });

// ─── PROPOSED ─────────────────────────────────────────────────────────────────

describe('lifecycleState: proposed (freshly-created Call, no selection)', () => {
  it('returns the full default menu flagged proposed, expected hours/price, null confirmed hours', async () => {
    const res = await getDetail();
    expect(res.status).toBe(200);
    const sc = res.body.serviceCall;

    expect(sc.lifecycleState).toBe('proposed');
    expect(sc.scopeIsAssumed).toBe(false);
    expect(sc.tasks).toHaveLength(2);
    expect(sc.tasks.every(t => t.source === 'proposed')).toBe(true);
    expect(sc.tasks.map(t => t.name)).toEqual(['Wipe counters', 'Vacuum floors']);
    expect(sc.expectedHours).toBe(3);
    expect(sc.confirmedHours).toBeNull();
    expect(sc.expectedPrice).toBe(150);
  });

  it('a draft (not submitted) selection is still proposed', async () => {
    // A draft is written by the customer's "save" path; simulate it directly.
    await knex('selections').insert({
      selection_cycle_id: selectionCycleId,
      customer_id: customerId,
      selected_tasks: JSON.stringify([taskA.id]),
      selected_total_hours: 1,
      status: 'draft',
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    });

    const res = await getDetail();
    expect(res.body.serviceCall.lifecycleState).toBe('proposed');
    expect(res.body.serviceCall.confirmedHours).toBeNull();
    expect(res.body.serviceCall.tasks.every(t => t.source === 'proposed')).toBe(true);
  });
});

// ─── CONFIRMED ────────────────────────────────────────────────────────────────

describe('lifecycleState: confirmed (customer submitted a selection)', () => {
  it('returns the selected subset with resolved names + confirmed hours', async () => {
    await submit([taskA.id], 1); // 60 min

    const res = await getDetail();
    const sc = res.body.serviceCall;

    expect(sc.lifecycleState).toBe('confirmed');
    expect(sc.scopeIsAssumed).toBe(false);
    expect(sc.tasks).toHaveLength(1);
    expect(sc.tasks[0].source).toBe('confirmed');
    expect(sc.tasks[0].name).toBe('Wipe counters');
    expect(sc.confirmedHours).toBe(1);
    expect(sc.expectedHours).toBe(3); // definition unchanged
  });

  it('resolves ids → real names (regression: never "Task N")', async () => {
    await submit([taskA.id, taskB.id], 2.5); // 150 min

    const res = await getDetail();
    const names = res.body.serviceCall.tasks.map(t => t.name);
    expect(names).toEqual(['Wipe counters', 'Vacuum floors']);
    expect(names.some(n => /^Task \d+$/.test(n))).toBe(false);
    expect(res.body.serviceCall.confirmedHours).toBe(2.5);
    // Backward-compat: raw selected_tasks ids still present for existing readers.
    expect(res.body.serviceCall.selectedTasks).toEqual([taskA.id, taskB.id]);
  });
});

// ─── COMPLETED ────────────────────────────────────────────────────────────────

describe('lifecycleState: completed', () => {
  const markComplete = () =>
    request(app)
      .post(`/api/businesses/${businessId}/customers/${customerId}/mark-service-complete`)
      .set('Authorization', `Bearer ${bizToken}`)
      .send({ selectionCycleId });

  it('with a submitted selection → confirmed scope, scopeIsAssumed=false', async () => {
    await submit([taskB.id], 1.5); // 90 min
    await markComplete();

    const res = await getDetail();
    const sc = res.body.serviceCall;
    expect(sc.lifecycleState).toBe('completed');
    expect(sc.scopeIsAssumed).toBe(false);
    expect(sc.tasks).toHaveLength(1);
    expect(sc.tasks[0].name).toBe('Vacuum floors');
    expect(sc.tasks[0].source).toBe('confirmed');
    expect(sc.confirmedHours).toBe(1.5);
  });

  it('without a submitted selection → falls back to the default menu, scopeIsAssumed=true (SCL7)', async () => {
    await markComplete();

    const res = await getDetail();
    const sc = res.body.serviceCall;
    expect(sc.lifecycleState).toBe('completed');
    expect(sc.scopeIsAssumed).toBe(true);
    expect(sc.tasks).toHaveLength(2); // the assumed default menu — never empty
    expect(sc.tasks.every(t => t.source === 'proposed')).toBe(true);
    expect(sc.confirmedHours).toBeNull();
  });
});

// ─── OWNERSHIP ────────────────────────────────────────────────────────────────

describe('ownership', () => {
  it("another business's Call → 404", async () => {
    const other = await createTestBusiness();
    const res = await request(app)
      .get(`/api/businesses/${other.business.id}/selection-cycles/${selectionCycleId}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});
