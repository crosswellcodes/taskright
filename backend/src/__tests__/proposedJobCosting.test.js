const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestServiceCycle,
  addCustomerToBusiness, assignCycleToCustomer,
} = require('./helpers');

// Proposed / expected job costing (SERVICE_CALL_LIFECYCLE.md §9): before a job runs,
// getJobCosts surfaces a proposed labor cost (hours × Σ assignee rates) and an
// expected-margin rollup. Service defined with total_hours = 3.

let businessId, bizToken, customerId, selectionCycleId, taskA, taskB;

const biz = (req) => req.set('Authorization', `Bearer ${bizToken}`);
const makeMember = async (name, phone, hourlyRate) =>
  (await biz(request(app).post(`/api/businesses/${businessId}/team-members`))
    .send({ name, phoneNumber: phone, weeklyHours: 40, hourlyRate })).body.teamMember.id;
const costs = async () =>
  (await biz(request(app).get(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`))).body.costs;

beforeEach(async () => {
  await truncateAllTables();

  const b = await createTestBusiness();
  businessId = b.business.id;
  bizToken = b.token;

  const cycle = await createTestServiceCycle(businessId, bizToken, [
    { name: 'Task A', timeAllotmentMinutes: 60 },
    { name: 'Task B', timeAllotmentMinutes: 60 },
  ]);
  const customer = await addCustomerToBusiness(businessId, bizToken, { name: 'Alice', phoneNumber: '+13330007700' });
  customerId = customer.id;
  await assignCycleToCustomer(businessId, customerId, cycle.id, bizToken, 3); // total_hours = 3

  const svc = await knex('customer_services').where('customer_id', customerId).first();
  const svcTasks = await knex('service_tasks').where('customer_service_id', svc.id).orderBy('id');
  taskA = svcTasks[0];
  taskB = svcTasks[1];

  const sc = await knex('selection_cycles').where('customer_id', customerId).orderBy('service_date', 'asc').first();
  selectionCycleId = sc.id;
});
afterAll(async () => { await knex.destroy(); });

const assignMember = (memberId) =>
  biz(request(app).put(`/api/businesses/${businessId}/assignments/${selectionCycleId}`)).send({ teamMemberId: memberId });
const assignTeam = (teamId) =>
  biz(request(app).put(`/api/businesses/${businessId}/assignments/${selectionCycleId}`)).send({ teamId });

async function makeTeam(name, memberIds) {
  const g = await biz(request(app).post(`/api/businesses/${businessId}/groups`)).send({ name });
  const teamId = g.body.group.id;
  await biz(request(app).put(`/api/businesses/${businessId}/groups/${teamId}/members`)).send({ memberIds });
  return teamId;
}

// ─── INDIVIDUAL ─────────────────────────────────────────────────────────────

describe('proposed labor — individual assignment', () => {
  it('= expectedHours × member rate, complete when rated', async () => {
    const ann = await makeMember('Ann', '+13330007701', 20);
    await assignMember(ann);

    const c = await costs();
    expect(c.expectedHours).toBe(3);
    expect(c.confirmedHours).toBeNull();
    expect(c.proposedLaborHours).toBe(3);
    expect(c.proposedLabor).toBe(60); // 3 × 20
    expect(c.expectedLaborIncomplete).toBe(false);
    expect(c.proposedLaborBreakdown).toEqual([
      { teamMemberId: ann, name: 'Ann', hourlyRate: 20 },
    ]);
  });

  it('switches to confirmed hours once the customer submits a smaller selection', async () => {
    const ann = await makeMember('Ann', '+13330007702', 20);
    await assignMember(ann);

    const login = await request(app).post('/api/auth/customers/login').send({ phoneNumber: '+13330007700' });
    await request(app)
      .post(`/api/customers/${customerId}/selection-cycle/${selectionCycleId}/submit`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ selectedTasks: [taskA.id], selectedTotalHours: 1 }); // 60 min = 1h

    const c = await costs();
    expect(c.confirmedHours).toBe(1);
    expect(c.proposedLaborHours).toBe(1); // uses confirmed, not the 3h budget
    expect(c.proposedLabor).toBe(20); // 1 × 20
  });
});

// ─── GROUP ──────────────────────────────────────────────────────────────────

describe('proposed labor — group assignment (PJC1: hours × Σ rates)', () => {
  it('sums every member rate × hours', async () => {
    const ann = await makeMember('Ann', '+13330007703', 20);
    const ben = await makeMember('Ben', '+13330007704', 30);
    const teamId = await makeTeam('Crew A', [ann, ben]);
    await assignTeam(teamId);

    const c = await costs();
    expect(c.proposedLabor).toBe(150); // 3 × (20 + 30)
    expect(c.expectedLaborIncomplete).toBe(false);
    expect(c.proposedLaborBreakdown).toHaveLength(2);
  });

  it('an unrated member counts as $0, flags incomplete, still shows a floor', async () => {
    const ann = await makeMember('Ann', '+13330007705', 20);
    const cal = await makeMember('Cal', '+13330007706', null); // no rate
    const teamId = await makeTeam('Crew B', [ann, cal]);
    await assignTeam(teamId);

    const c = await costs();
    expect(c.proposedLabor).toBe(60); // 3 × (20 + 0) — a floor
    expect(c.expectedLaborIncomplete).toBe(true);
    expect(c.proposedLaborBreakdown.find(m => m.name === 'Cal').hourlyRate).toBeNull();
  });
});

// ─── EXPECTED MARGIN + EDGE CASES ─────────────────────────────────────────────

describe('expected margin rollup + edges', () => {
  it('expectedMargin = price − (proposedLabor + materials + overhead)', async () => {
    const ann = await makeMember('Ann', '+13330007707', 20);
    await assignMember(ann);
    await biz(request(app).patch(`/api/businesses/${businessId}/jobs/${selectionCycleId}/price`)).send({ price: 200 });
    const materialsCat = await knex('cost_categories').where('code', 5100).where('is_system', true).first();
    await biz(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`))
      .send({ costCategoryId: materialsCat.id, amount: 30 });

    const c = await costs();
    expect(c.proposedLabor).toBe(60);
    expect(c.expectedTotalCost).toBe(90); // 60 labor + 30 materials
    expect(c.expectedMarginDollars).toBe(110); // 200 − 90
    expect(c.expectedMarginPercent).toBe(55); // 110 / 200
  });

  it('no assignment → proposedLabor null, incomplete, expected cost from materials/overhead only', async () => {
    const c = await costs();
    expect(c.proposedLabor).toBeNull();
    expect(c.expectedLaborIncomplete).toBe(true);
    expect(c.proposedLaborBreakdown).toEqual([]);
    expect(c.expectedTotalCost).toBe(0);
  });

  it('estimatedHours falls back to expectedHours when nothing is confirmed (Est column fix)', async () => {
    const c = await costs();
    expect(c.estimatedHours).toBe(3); // was 0 pre-selection before the fix
  });
});
