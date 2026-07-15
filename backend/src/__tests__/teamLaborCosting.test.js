const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestServiceCycle,
  addCustomerToBusiness, assignCycleToCustomer,
} = require('./helpers');
const businessService = require('../services/businessService');

// Team Labor Costing (TEAM_LABOR_COSTING.md). A group assignment now means
// "every member of the team is individually on this job." The four member-facing
// resolvers (getJobsForTeamMember / getJobDetail / completeJobForTeamMember /
// recordGeofenceEvent) admit a member assigned individually OR via team_memberships,
// so a group Call flows through the existing per-member labor machinery unchanged:
// geofence → per-member labor at each member's own rate → Rule-6 upsert →
// laborLines[] → profitability. No migration; no new cost model.

let businessId, bizToken, customerId, selectionCycleId;
let teamId, memberA, memberB, outsider;
let laborCategoryId;

const auth = (token) => (req) => req.set('Authorization', `Bearer ${token}`);
const biz = (req) => req.set('Authorization', `Bearer ${bizToken}`);

async function makeMember(name, phone, hourlyRate) {
  const res = await biz(request(app).post(`/api/businesses/${businessId}/team-members`))
    .send({ name, phoneNumber: phone, weeklyHours: 40, hourlyRate });
  return res.body.teamMember.id;
}

// A full arrival→departure pair `hours` apart. Returns the departure result.
async function clockInOut(memberId, cycleId, hours, startMs = Date.now()) {
  await businessService.recordGeofenceEvent(memberId, cycleId, {
    eventType: 'arrival', occurredAt: new Date(startMs).toISOString(), lat: 1, lng: 1, method: 'auto',
  });
  return businessService.recordGeofenceEvent(memberId, cycleId, {
    eventType: 'departure', occurredAt: new Date(startMs + hours * 3600e3).toISOString(), lat: 1, lng: 1, method: 'auto',
  });
}

beforeEach(async () => {
  await truncateAllTables();

  const b = await createTestBusiness();
  businessId = b.business.id;
  bizToken = b.token;

  const cycle = await createTestServiceCycle(businessId, bizToken, [{ name: 'Mow', timeAllotmentMinutes: 90 }]);
  const customer = await addCustomerToBusiness(businessId, bizToken, { name: 'Alice', phoneNumber: '+13330005500' });
  customerId = customer.id;
  await assignCycleToCustomer(businessId, customerId, cycle.id, bizToken, 3);
  const sc = await knex('selection_cycles').where('customer_id', customerId).orderBy('service_date', 'asc').first();
  selectionCycleId = sc.id;

  // Two members with rates, one outsider (not on the team).
  memberA = await makeMember('Ann', '+13330005501', 20);
  memberB = await makeMember('Ben', '+13330005502', 30);
  outsider = await makeMember('Odell', '+13330005503', 25);

  // A team containing A and B; assign the Call to the team (not to any individual).
  const g = await biz(request(app).post(`/api/businesses/${businessId}/groups`)).send({ name: 'Crew A' });
  teamId = g.body.group.id;
  await biz(request(app).put(`/api/businesses/${businessId}/groups/${teamId}/members`))
    .send({ memberIds: [memberA, memberB] });
  await biz(request(app).put(`/api/businesses/${businessId}/assignments/${selectionCycleId}`))
    .send({ teamId });

  laborCategoryId = (await knex('cost_categories').where('code', 5000).where('is_system', true).first()).id;
});
afterAll(async () => { await knex.destroy(); });

// ─── VISIBILITY ───────────────────────────────────────────────────────────────

describe('visibility — group members see the Call, non-members do not', () => {
  it('a member of the assigned team sees the group Call in their job list', async () => {
    const jobs = await businessService.getJobsForTeamMember(memberA);
    const entry = jobs.find(j => j.selectionCycleId === selectionCycleId);
    expect(entry).toBeTruthy();
    expect(entry.isTeamAssigned).toBe(true);
    expect(entry.teamName).toBe('Crew A');
  });

  it('every member of the team sees the same Call', async () => {
    const jobsB = await businessService.getJobsForTeamMember(memberB);
    expect(jobsB.some(j => j.selectionCycleId === selectionCycleId)).toBe(true);
  });

  it('a non-member does not see the group Call', async () => {
    const jobs = await businessService.getJobsForTeamMember(outsider);
    expect(jobs.some(j => j.selectionCycleId === selectionCycleId)).toBe(false);
  });
});

// ─── GATES ────────────────────────────────────────────────────────────────────

describe('gates — getJobDetail / geofence / complete accept a group member, 404 a non-member', () => {
  it('getJobDetail returns the Call for a group member', async () => {
    const detail = await businessService.getJobDetail(memberA, selectionCycleId);
    expect(detail.selectionCycleId).toBe(selectionCycleId);
  });

  it('getJobDetail 404s for a non-member', async () => {
    await expect(businessService.getJobDetail(outsider, selectionCycleId))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('recordGeofenceEvent 404s for a non-member', async () => {
    await expect(businessService.recordGeofenceEvent(outsider, selectionCycleId, {
      eventType: 'arrival', occurredAt: new Date().toISOString(), lat: 1, lng: 1, method: 'auto',
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('completeJobForTeamMember 404s for a non-member', async () => {
    await expect(businessService.completeJobForTeamMember(outsider, selectionCycleId, null))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── AUTO LABOR ───────────────────────────────────────────────────────────────

describe('auto labor — group members produce per-member labor at their own rate', () => {
  it('a single group member: geofence pair creates one labor line at their rate', async () => {
    const dep = await clockInOut(memberA, selectionCycleId, 2); // 2h × $20
    expect(dep.laborCostCreated).toBe(true);

    const costs = await businessService.getJobCosts(businessId, selectionCycleId);
    expect(costs.laborLines).toHaveLength(1);
    const line = costs.laborLines[0];
    expect(line.teamMemberId).toBe(memberA);
    expect(line.hoursActual).toBe(2);
    expect(line.hourlyRate).toBe(20);
    expect(line.amount).toBe(40);
    expect(line.source).toBe('auto');
  });

  it('two group members: two labor lines, labor total is their sum, each keyed correctly', async () => {
    await clockInOut(memberA, selectionCycleId, 2); // 2h × $20 = 40
    await clockInOut(memberB, selectionCycleId, 3); // 3h × $30 = 90

    const costs = await businessService.getJobCosts(businessId, selectionCycleId);
    expect(costs.laborLines).toHaveLength(2);

    const byMember = Object.fromEntries(costs.laborLines.map(l => [l.teamMemberId, l]));
    expect(byMember[memberA].amount).toBe(40);
    expect(byMember[memberB].amount).toBe(90);
    expect(costs.totalCost).toBe(130);
  });

  it('labor feeds margin: price − group labor = margin', async () => {
    await biz(request(app).patch(`/api/businesses/${businessId}/jobs/${selectionCycleId}/price`)).send({ price: 200 });
    await clockInOut(memberA, selectionCycleId, 2); // 40
    await clockInOut(memberB, selectionCycleId, 3); // 90

    const costs = await businessService.getJobCosts(businessId, selectionCycleId);
    expect(costs.totalCost).toBe(130);
    expect(costs.marginDollars).toBe(70);
    expect(costs.marginPercent).toBe(35);
  });

  it('null-rate member (TL2): labor amount 0.00 with hours recorded', async () => {
    await biz(request(app).put(`/api/businesses/${businessId}/team-members/${memberB}`)).send({ hourlyRate: null });
    const dep = await clockInOut(memberB, selectionCycleId, 4);
    expect(dep.laborCostCreated).toBe(true);

    const costs = await businessService.getJobCosts(businessId, selectionCycleId);
    const line = costs.laborLines.find(l => l.teamMemberId === memberB);
    expect(line.amount).toBe(0);
    expect(line.hoursActual).toBe(4);
    expect(line.hourlyRate).toBeNull();
  });
});

// ─── FIRST-WINS COMPLETION (TL3) ────────────────────────────────────────────────

describe('completion — first-to-complete wins, others get benign 409', () => {
  it('member A completes; member B gets ALREADY_COMPLETED; one completion row; B can still record labor', async () => {
    await businessService.completeJobForTeamMember(memberA, selectionCycleId, 'done');
    const cycle = await knex('selection_cycles').where('id', selectionCycleId).first();
    expect(cycle.status).toBe('completed');

    await expect(businessService.completeJobForTeamMember(memberB, selectionCycleId, null))
      .rejects.toMatchObject({ code: 'ALREADY_COMPLETED', statusCode: 409 });

    const rows = await knex('service_completions').where('selection_cycle_id', selectionCycleId);
    expect(rows).toHaveLength(1);

    // Hours worked count regardless of who closed the Call.
    const dep = await clockInOut(memberB, selectionCycleId, 1); // 1h × $30
    expect(dep.laborCostCreated).toBe(true);
    const costs = await businessService.getJobCosts(businessId, selectionCycleId);
    expect(costs.laborLines.find(l => l.teamMemberId === memberB).amount).toBe(30);
  });
});

// ─── DEDUP (TL4) ────────────────────────────────────────────────────────────────

// service_assignments.selection_cycle_id is UNIQUE, so a Call can never carry
// both an individual AND a team assignment at once — the both-assigned case in
// the spec is structurally impossible. What matters is that the broadened
// OR-predicate never *multiplies* a matching member: one job entry, one labor row.
describe('dedup — the broadened predicate yields one entry / one labor row per member', () => {
  it('an individually-assigned member who is also in a team appears once', async () => {
    // Reassign the Call to memberA individually (memberA is also in Crew A).
    await biz(request(app).put(`/api/businesses/${businessId}/assignments/${selectionCycleId}`))
      .send({ teamMemberId: memberA });

    const jobs = await businessService.getJobsForTeamMember(memberA);
    const entries = jobs.filter(j => j.selectionCycleId === selectionCycleId);
    expect(entries).toHaveLength(1);
    expect(entries[0].isTeamAssigned).toBe(false); // individual assignment

    await clockInOut(memberA, selectionCycleId, 2);
    const rows = await knex('job_costs')
      .where('selection_cycle_id', selectionCycleId)
      .where('team_member_id', memberA)
      .where('cost_category_id', laborCategoryId);
    expect(rows).toHaveLength(1);
  });

  it('a group member appears once and gets one labor row across repeated departures', async () => {
    const base = Date.now();
    await clockInOut(memberA, selectionCycleId, 2, base);
    // A duplicate/late departure re-fires; Rule-6 upsert keeps it to one row.
    await businessService.recordGeofenceEvent(memberA, selectionCycleId, {
      eventType: 'departure', occurredAt: new Date(base + 2 * 3600e3).toISOString(), lat: 1, lng: 1, method: 'auto',
    });

    const jobs = await businessService.getJobsForTeamMember(memberA);
    expect(jobs.filter(j => j.selectionCycleId === selectionCycleId)).toHaveLength(1);
    const rows = await knex('job_costs')
      .where('selection_cycle_id', selectionCycleId)
      .where('team_member_id', memberA)
      .where('cost_category_id', laborCategoryId);
    expect(rows).toHaveLength(1);
  });
});

// ─── REGRESSION ─────────────────────────────────────────────────────────────────

describe('regression — individual-only assignment still lists / gates / labors', () => {
  it('an individually-assigned member (in no team) is listed, gated in, and labored', async () => {
    // Fresh Call assigned to the outsider individually.
    await biz(request(app).put(`/api/businesses/${businessId}/assignments/${selectionCycleId}`))
      .send({ teamMemberId: outsider });

    const jobs = await businessService.getJobsForTeamMember(outsider);
    const entry = jobs.find(j => j.selectionCycleId === selectionCycleId);
    expect(entry).toBeTruthy();
    expect(entry.isTeamAssigned).toBe(false);

    const detail = await businessService.getJobDetail(outsider, selectionCycleId);
    expect(detail.selectionCycleId).toBe(selectionCycleId);

    const dep = await clockInOut(outsider, selectionCycleId, 2); // 2h × $25
    expect(dep.laborCostCreated).toBe(true);
    const costs = await businessService.getJobCosts(businessId, selectionCycleId);
    expect(costs.laborLines).toHaveLength(1);
    expect(costs.laborLines[0].amount).toBe(50);

    // And the members formerly on the team no longer see this Call.
    const jobsA = await businessService.getJobsForTeamMember(memberA);
    expect(jobsA.some(j => j.selectionCycleId === selectionCycleId)).toBe(false);
  });
});
