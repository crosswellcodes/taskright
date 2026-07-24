const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestServiceCycle,
  addCustomerToBusiness, assignCycleToCustomer,
} = require('./helpers');
const businessService = require('../services/businessService');
const { generateToken } = require('../utils/jwt');

// Geofence / Clock-In Transparency (GEOFENCE_TRANSPARENCY.md) — Tiers B & C.
// Tier B: getJobsForTeamMember exposes `autoTrackable` (customer has coords) so
// My Jobs can show an auto-vs-manual chip. Tier C: getActiveClockForTeamMember +
// GET /active-clock derive the member's currently-open clock-in read-only from
// geofence_events (latest event is an arrival with no later departure). No writes,
// no migration.

let businessId, bizToken, customerId, selectionCycleId;
let teamId, memberA, memberB;

const biz = (req) => req.set('Authorization', `Bearer ${bizToken}`);
const memberToken = (memberId) =>
  generateToken({ sub: String(memberId), type: 'team_member', teamMemberId: memberId, businessId }).token;

async function makeMember(name, phone, hourlyRate) {
  const res = await biz(request(app).post(`/api/businesses/${businessId}/team-members`))
    .send({ name, phoneNumber: phone, weeklyHours: 40, hourlyRate });
  return res.body.teamMember.id;
}

async function arrival(memberId, cycleId, whenMs = Date.now()) {
  return businessService.recordGeofenceEvent(memberId, cycleId, {
    eventType: 'arrival', occurredAt: new Date(whenMs).toISOString(), lat: 1, lng: 1, method: 'auto',
  });
}
async function departure(memberId, cycleId, whenMs = Date.now()) {
  return businessService.recordGeofenceEvent(memberId, cycleId, {
    eventType: 'departure', occurredAt: new Date(whenMs).toISOString(), lat: 1, lng: 1, method: 'auto',
  });
}

beforeEach(async () => {
  await truncateAllTables();

  const b = await createTestBusiness();
  businessId = b.business.id;
  bizToken = b.token;

  const cycle = await createTestServiceCycle(businessId, bizToken, [{ name: 'Mow', timeAllotmentMinutes: 90 }]);
  const customer = await addCustomerToBusiness(businessId, bizToken, { name: 'Alice Smith', phoneNumber: '+13330007700' });
  customerId = customer.id;
  await assignCycleToCustomer(businessId, customerId, cycle.id, bizToken, 3);
  const sc = await knex('selection_cycles').where('customer_id', customerId).orderBy('service_date', 'asc').first();
  selectionCycleId = sc.id;

  // A team of two members, assigned to the Call (so both can clock in — a cycle
  // has at most one assignment row, so a shared job must be a team job).
  memberA = await makeMember('Ann', '+13330007701', 20);
  memberB = await makeMember('Ben', '+13330007702', 30);
  const g = await biz(request(app).post(`/api/businesses/${businessId}/groups`)).send({ name: 'Crew A' });
  teamId = g.body.group.id;
  await biz(request(app).put(`/api/businesses/${businessId}/groups/${teamId}/members`))
    .send({ memberIds: [memberA, memberB] });
  await biz(request(app).put(`/api/businesses/${businessId}/assignments/${selectionCycleId}`))
    .send({ teamId });
});
afterAll(async () => { await knex.destroy(); });

// ─── TIER B — autoTrackable ─────────────────────────────────────────────────────

describe('Tier B — getJobsForTeamMember exposes autoTrackable', () => {
  it('is false when the customer has no coordinates', async () => {
    const jobs = await businessService.getJobsForTeamMember(memberA);
    const entry = jobs.find(j => j.selectionCycleId === selectionCycleId);
    expect(entry.autoTrackable).toBe(false);
  });

  it('is true once the customer is geocoded', async () => {
    await knex('customers').where('id', customerId).update({ lat: 42.1, lng: -78.2 });
    const jobs = await businessService.getJobsForTeamMember(memberA);
    const entry = jobs.find(j => j.selectionCycleId === selectionCycleId);
    expect(entry.autoTrackable).toBe(true);
  });

  it('the /jobs route passes autoTrackable + team fields through to the client', async () => {
    await knex('customers').where('id', customerId).update({ lat: 42.1, lng: -78.2 });
    const res = await request(app)
      .get(`/api/team-members/${memberA}/jobs`)
      .set('Authorization', `Bearer ${memberToken(memberA)}`);
    expect(res.status).toBe(200);
    const entry = res.body.jobs.find(j => j.selectionCycleId === selectionCycleId);
    expect(entry.autoTrackable).toBe(true);
    expect(entry.isTeamAssigned).toBe(true);
    expect(entry.teamName).toBe('Crew A');
  });
});

// ─── TIER C — active clock ──────────────────────────────────────────────────────

describe('Tier C — getActiveClockForTeamMember', () => {
  it('returns null when the member has no events', async () => {
    expect(await businessService.getActiveClockForTeamMember(memberA)).toBeNull();
  });

  it('returns the open cycle when the latest event is an arrival', async () => {
    await arrival(memberA, selectionCycleId);
    const active = await businessService.getActiveClockForTeamMember(memberA);
    expect(active).toMatchObject({ selectionCycleId, customerName: 'Alice Smith' });
    expect(active.arrivalAt).toBeTruthy();
  });

  it('returns null again after a departure', async () => {
    const t0 = Date.now();
    await arrival(memberA, selectionCycleId, t0);
    await departure(memberA, selectionCycleId, t0 + 3600e3);
    expect(await businessService.getActiveClockForTeamMember(memberA)).toBeNull();
  });

  it("ignores other members' events", async () => {
    await arrival(memberB, selectionCycleId);
    // memberA never clocked in — must not inherit memberB's open arrival.
    expect(await businessService.getActiveClockForTeamMember(memberA)).toBeNull();
    // memberB sees their own open clock.
    const activeB = await businessService.getActiveClockForTeamMember(memberB);
    expect(activeB.selectionCycleId).toBe(selectionCycleId);
  });

  it('a re-entry (arrive/depart/arrive) counts as clocked in', async () => {
    const t0 = Date.now();
    await arrival(memberA, selectionCycleId, t0);
    await departure(memberA, selectionCycleId, t0 + 1800e3);
    await arrival(memberA, selectionCycleId, t0 + 3600e3);
    const active = await businessService.getActiveClockForTeamMember(memberA);
    expect(active.selectionCycleId).toBe(selectionCycleId);
  });
});

describe('Tier C — GET /active-clock route', () => {
  it('returns activeClock: null when not clocked in', async () => {
    const res = await request(app)
      .get(`/api/team-members/${memberA}/active-clock`)
      .set('Authorization', `Bearer ${memberToken(memberA)}`);
    expect(res.status).toBe(200);
    expect(res.body.activeClock).toBeNull();
  });

  it('returns the active clock object once clocked in', async () => {
    await arrival(memberA, selectionCycleId);
    const res = await request(app)
      .get(`/api/team-members/${memberA}/active-clock`)
      .set('Authorization', `Bearer ${memberToken(memberA)}`);
    expect(res.status).toBe(200);
    expect(res.body.activeClock).toMatchObject({
      selectionCycleId, customerId, customerName: 'Alice Smith',
    });
    expect(res.body.activeClock.arrivalAt).toBeTruthy();
  });

  it("403s when the token member doesn't match the URL", async () => {
    const res = await request(app)
      .get(`/api/team-members/${memberA}/active-clock`)
      .set('Authorization', `Bearer ${memberToken(memberB)}`);
    expect(res.status).toBe(403);
  });
});
