const request = require('supertest');
const {
  app, knex, truncateAllTables, createTestBusiness, createTestServiceCycle,
  addCustomerToBusiness, assignCycleToCustomer,
} = require('./helpers');

// Web portal M6 (Money): GET /:id/profitability — business-wide rollup over
// COMPLETED Calls in a service_date range. Cost lines are seeded directly.

let businessId, token, memberId, cat;
const auth = (req, t = token) => req.set('Authorization', `Bearer ${t}`);
const get = (qs = '') => auth(request(app).get(`/api/businesses/${businessId}/profitability${qs}`));

// A customer with one service and its generated Calls (ids, oldest first).
async function customerWithCalls(name, phone) {
  const tpl = await createTestServiceCycle(businessId, token, [{ name: 'Clean', timeAllotmentMinutes: 60 }]);
  const c = await addCustomerToBusiness(businessId, token, { name, phoneNumber: phone });
  await assignCycleToCustomer(businessId, c.id, tpl.id, token, 2);
  const calls = await knex('selection_cycles').where('customer_id', c.id).orderBy('service_date');
  return { customer: c, callIds: calls.map(r => r.id), serviceId: calls[0].customer_service_id };
}

async function complete(callId, serviceDate, price) {
  await knex('selection_cycles').where('id', callId).update({ status: 'completed', service_date: serviceDate, price });
}

async function cost(callId, type, amount, extra = {}) {
  await knex('job_costs').insert({
    selection_cycle_id: callId, cost_category_id: cat[type], amount,
    team_member_id: type === 'labor' ? memberId : null,
    hours_actual: type === 'labor' ? 2 : null,
    source: extra.source || 'auto',
  });
}

beforeEach(async () => {
  await truncateAllTables();
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  token = biz.token;
  const m = await auth(request(app).post(`/api/businesses/${businessId}/team-members`))
    .send({ name: 'Ann', phoneNumber: '+13330009101', weeklyHours: 40, hourlyRate: 20 });
  memberId = m.body.teamMember.id;
  const cats = await knex('cost_categories').whereNull('business_id');
  cat = Object.fromEntries(cats.map(c => [c.type, c.id]));
});
afterAll(async () => { await knex.destroy(); });

describe('GET /api/businesses/:businessId/profitability', () => {
  it('returns a zeroed rollup (with the GAAP statement shape) when nothing is completed', async () => {
    const res = await get('?from=2026-01-01&to=2026-01-31');
    expect(res.status).toBe(200);
    const p = res.body.profitability;
    expect(p.range).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    expect(p.totals).toMatchObject({ revenue: 0, totalCost: 0, marginDollars: 0, marginPercent: null, completedJobCount: 0, unpricedJobCount: 0 });
    expect(p.byCategory.map(c => c.code)).toEqual([4000, 5000, 5100, 5200]);
    expect(p.jobs).toEqual([]);
  });

  it('rolls up completed jobs in range — totals, categories, customer, service, jobs', async () => {
    const a = await customerWithCalls('Alice', '+13330009201');
    const b = await customerWithCalls('Bob', '+13330009202');

    await complete(a.callIds[0], '2026-01-05', 200);   // labor 40 + materials 10 → margin 150
    await cost(a.callIds[0], 'labor', 40);
    await cost(a.callIds[0], 'materials', 10, { source: 'manual' });
    await complete(a.callIds[1], '2026-01-20', 100);   // overhead 30 → margin 70
    await cost(a.callIds[1], 'overhead', 30);
    await complete(b.callIds[0], '2026-01-10', null);  // unpriced, labor 25 → revenue 0
    await cost(b.callIds[0], 'labor', 25);
    await complete(b.callIds[1], '2026-02-02', 999);   // out of range — excluded
    await cost(b.callIds[1], 'labor', 1);

    const res = await get('?from=2026-01-01&to=2026-01-31');
    const p = res.body.profitability;

    expect(p.totals).toMatchObject({
      revenue: 300, laborCost: 65, materialsCost: 10, overheadCost: 30, totalCost: 105,
      marginDollars: 195, marginPercent: 65, completedJobCount: 3, unpricedJobCount: 1,
    });
    expect(Object.fromEntries(p.byCategory.map(c => [c.code, c.amount]))).toEqual({ 4000: 300, 5000: 65, 5100: 10, 5200: 30 });

    expect(p.byCustomer).toEqual([
      expect.objectContaining({ customerName: 'Alice', revenue: 300, totalCost: 80, marginDollars: 220, jobs: 2 }),
      expect.objectContaining({ customerName: 'Bob', revenue: 0, totalCost: 25, marginDollars: -25, marginPercent: null, jobs: 1 }),
    ]);
    expect(p.byService.find(s => s.serviceId === a.serviceId)).toMatchObject({ customerName: 'Alice', jobs: 2, revenue: 300 });

    // Newest first; per-job margin only when priced; manual-edit flag surfaces.
    expect(p.jobs.map(j => j.serviceDate)).toEqual(['2026-01-20', '2026-01-10', '2026-01-05']);
    expect(p.jobs[1]).toMatchObject({ customerName: 'Bob', price: null, totalCost: 25, marginDollars: null, marginPercent: null });
    expect(p.jobs[2]).toMatchObject({ price: 200, laborCost: 40, materialsCost: 10, marginDollars: 150, marginPercent: 75, hasManualEdits: true });
  });

  it('reports still-open Calls in the window as pipeline, not revenue', async () => {
    const a = await customerWithCalls('Alice', '+13330009203');
    await knex('selection_cycles').where('id', a.callIds[0]).update({ service_date: '2026-03-03', price: 80 });
    await knex('selection_cycles').where('id', a.callIds[1]).update({ service_date: '2026-03-10', price: 70 });

    const p = (await get('?from=2026-03-01&to=2026-03-31')).body.profitability;
    expect(p.totals.revenue).toBe(0);
    expect(p.pipeline).toEqual({ openJobCount: 2, expectedRevenue: 150 });
  });

  it('defaults to the current calendar month', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const { from, to } = res.body.profitability.range;
    expect(from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(to.slice(0, 7)).toBe(from.slice(0, 7));
  });

  it('validates the range (partial, inverted, > 366 days) and ownership', async () => {
    for (const qs of ['?from=2026-01-01', '?from=2026-02-01&to=2026-01-01', '?from=2025-01-01&to=2026-06-01']) {
      expect((await get(qs)).status).toBe(400);
    }
    const other = await createTestBusiness();
    const res = await auth(request(app).get(`/api/businesses/${businessId}/profitability`), other.token);
    expect(res.status).toBe(403);
  });

  it('never counts another business\'s jobs', async () => {
    const a = await customerWithCalls('Alice', '+13330009204');
    await complete(a.callIds[0], '2026-01-05', 200);
    const other = await createTestBusiness();
    const res = await auth(request(app).get(`/api/businesses/${other.business.id}/profitability?from=2026-01-01&to=2026-01-31`), other.token);
    expect(res.body.profitability.totals.completedJobCount).toBe(0);
  });
});
