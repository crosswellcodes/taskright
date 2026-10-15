const request = require('supertest');
const {
  app, knex, truncateAllTables, createTestBusiness, createTestServiceCycle,
  addCustomerToBusiness, assignCycleToCustomer,
} = require('./helpers');
const businessService = require('../services/businessService');

// Web portal M5 (Team): invite status on the member list, validated member
// edits, group-membership ownership hardening, the active-clocks board, and the
// ranged assignments feed for the week board.

let businessId, token, memberId;
const auth = (req, t = token) => req.set('Authorization', `Bearer ${t}`);

async function makeMember(bizId, t, name, phoneNumber) {
  const res = await auth(request(app).post(`/api/businesses/${bizId}/team-members`), t)
    .send({ name, phoneNumber, weeklyHours: 40 });
  return res.body.teamMember;
}

beforeEach(async () => {
  await truncateAllTables();
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  token = biz.token;
  memberId = (await makeMember(businessId, token, 'Ann', '+13330008101')).id;
});
afterAll(async () => { await knex.destroy(); });

describe('GET /team-members — invite status', () => {
  it('shows a pending member\'s invite code, and hides it once accepted', async () => {
    const pending = await auth(request(app).get(`/api/businesses/${businessId}/team-members`));
    const ann = pending.body.teamMembers.find(m => m.id === memberId);
    expect(ann.inviteAccepted).toBe(false);
    expect(ann.inviteCode).toMatch(/\S+/);

    await knex('team_members').where('id', memberId).update({ invite_accepted: true, invite_code: null });
    const accepted = await auth(request(app).get(`/api/businesses/${businessId}/team-members`));
    expect(accepted.body.teamMembers[0]).toMatchObject({ inviteAccepted: true, inviteCode: null });
  });
});

describe('PUT /team-members/:id — validation', () => {
  const put = (body) => auth(request(app).put(`/api/businesses/${businessId}/team-members/${memberId}`)).send(body);

  it('rejects an empty name, a non-E.164 phone, and out-of-range hours', async () => {
    for (const body of [{ name: '  ' }, { phoneNumber: '4025550100' }, { weeklyHours: 0 }, { weeklyHours: 200 }]) {
      const res = await put(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('409s when the new phone belongs to another member of the business', async () => {
    await makeMember(businessId, token, 'Ben', '+13330008102');
    const res = await put({ phoneNumber: '+13330008102' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_TEAM_MEMBER');
  });

  it('still saves a valid edit', async () => {
    const res = await put({ name: ' Annie ', phoneNumber: '+13330008109', weeklyHours: 30, hourlyRate: 22.5 });
    expect(res.status).toBe(200);
    expect(res.body.teamMember).toMatchObject({ name: 'Annie', phoneNumber: '+13330008109', weeklyHours: 30, hourlyRate: 22.5 });
  });
});

describe('PUT /groups/:id/members — ownership', () => {
  let groupId;
  beforeEach(async () => {
    const g = await auth(request(app).post(`/api/businesses/${businessId}/groups`)).send({ name: 'Crew' });
    groupId = g.body.group.id;
  });

  it('404s when a member belongs to another business, leaving the group unchanged', async () => {
    await auth(request(app).put(`/api/businesses/${businessId}/groups/${groupId}/members`)).send({ memberIds: [memberId] });
    const other = await createTestBusiness();
    const foreign = await makeMember(other.business.id, other.token, 'Zoe', '+13330008199');

    const res = await auth(request(app).put(`/api/businesses/${businessId}/groups/${groupId}/members`))
      .send({ memberIds: [memberId, foreign.id] });
    expect(res.status).toBe(404);
    const rows = await knex('team_memberships').where('team_id', groupId);
    expect(rows.map(r => r.team_member_id)).toEqual([memberId]);
  });

  it('400s on non-numeric ids; dedupes repeated ids', async () => {
    const bad = await auth(request(app).put(`/api/businesses/${businessId}/groups/${groupId}/members`)).send({ memberIds: ['x'] });
    expect(bad.status).toBe(400);

    const ok = await auth(request(app).put(`/api/businesses/${businessId}/groups/${groupId}/members`)).send({ memberIds: [memberId, memberId] });
    expect(ok.status).toBe(200);
    expect(await knex('team_memberships').where('team_id', groupId).count('* as n').first()).toEqual({ n: '1' });
  });
});

describe('Active clocks + ranged assignments', () => {
  let callIds;
  beforeEach(async () => {
    const cycle = await createTestServiceCycle(businessId, token, [{ name: 'Mow', timeAllotmentMinutes: 60 }]);
    const c = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330008150' });
    await assignCycleToCustomer(businessId, c.id, cycle.id, token, 2);
    callIds = (await knex('selection_cycles').where('customer_id', c.id).orderBy('service_date')).map(r => r.id);
    await auth(request(app).put(`/api/businesses/${businessId}/assignments/${callIds[0]}`)).send({ teamMemberId: memberId });
  });

  it('GET /active-clocks lists a clocked-in member, and drops them after departure', async () => {
    const empty = await auth(request(app).get(`/api/businesses/${businessId}/active-clocks`));
    expect(empty.status).toBe(200);
    expect(empty.body.activeClocks).toEqual([]);

    await businessService.recordGeofenceEvent(memberId, callIds[0], { eventType: 'arrival', method: 'manual', lat: null, lng: null, occurredAt: new Date(Date.now() - 60000).toISOString() });
    const on = await auth(request(app).get(`/api/businesses/${businessId}/active-clocks`));
    expect(on.body.activeClocks).toEqual([
      expect.objectContaining({ teamMemberId: memberId, teamMemberName: 'Ann', selectionCycleId: callIds[0], customerName: 'Alice' }),
    ]);

    await businessService.recordGeofenceEvent(memberId, callIds[0], { eventType: 'departure', method: 'manual', lat: null, lng: null, occurredAt: new Date().toISOString() });
    const off = await auth(request(app).get(`/api/businesses/${businessId}/active-clocks`));
    expect(off.body.activeClocks).toEqual([]);
  });

  it('GET /assignments?from=&to= returns assignments in range with serviceDate', async () => {
    const sc = await knex('selection_cycles').where('id', callIds[0]).first();
    const day = new Date(sc.service_date).toISOString().split('T')[0];
    const res = await auth(request(app).get(`/api/businesses/${businessId}/assignments?from=${day}&to=${day}`));
    expect(res.status).toBe(200);
    expect(res.body.assignments).toEqual([
      expect.objectContaining({ selectionCycleId: callIds[0], serviceDate: day, teamMemberId: memberId, teamMemberName: 'Ann' }),
    ]);
  });

  it('GET /assignments still requires serviceDate or a valid range', async () => {
    expect((await auth(request(app).get(`/api/businesses/${businessId}/assignments`))).status).toBe(400);
    expect((await auth(request(app).get(`/api/businesses/${businessId}/assignments?from=2026-01-01`))).status).toBe(400);
    expect((await auth(request(app).get(`/api/businesses/${businessId}/assignments?from=2026-01-01&to=2026-04-01`))).status).toBe(400);
  });
});
