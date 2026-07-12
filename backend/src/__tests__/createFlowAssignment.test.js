const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, addCustomerToBusiness,
} = require('./helpers');

// Create-Flow Team Assignment (CREATE_FLOW_ASSIGNMENT.md). Service-level fan-out:
// an optional assignee on service create (atomic — validate-first) + a standalone
// PUT .../services/:id/assignment. Both write service_assignments across the
// service's OPEN Calls only; ownership-validated; last-write-wins with the
// dashboard's per-call PUT /assignments/:callId.

const TASK = { name: 'Mow', timeAllotmentMinutes: 60 };

let businessId, bizToken, customerId, memberId, teamId;
let otherBizId, otherToken, otherMemberId, otherServiceId;

const futureDate = (days) => new Date(Date.now() + days * 864e5).toISOString().split('T')[0];
const bearer = (token) => (req) => req.set('Authorization', `Bearer ${token}`);

function createService(body = {}) {
  return bearer(bizToken)(request(app).post(`/api/businesses/${businessId}/customers/${customerId}/services`))
    .send({ name: 'Svc', frequency: 'weekly', tasks: [TASK], totalHours: 2, startDate: futureDate(7), ...body });
}

// Assignment rows for a service, joined to their Call's status.
function assignmentsForService(serviceId) {
  return knex('service_assignments as sa')
    .join('selection_cycles as sc', 'sa.selection_cycle_id', 'sc.id')
    .where('sc.customer_service_id', serviceId)
    .select('sa.selection_cycle_id', 'sa.team_member_id', 'sa.team_id', 'sc.status');
}

beforeAll(async () => {
  await truncateAllTables();

  const biz = await createTestBusiness();
  businessId = biz.business.id;
  bizToken = biz.token;
  const cust = await addCustomerToBusiness(businessId, bizToken, { name: 'Alice', phoneNumber: '+13330008000' });
  customerId = cust.id;

  const m = await bearer(bizToken)(request(app).post(`/api/businesses/${businessId}/team-members`))
    .send({ name: 'Bob', phoneNumber: '+13330008001', weeklyHours: 40 });
  memberId = m.body.teamMember.id;

  const g = await bearer(bizToken)(request(app).post(`/api/businesses/${businessId}/groups`))
    .send({ name: 'Crew A' });
  teamId = g.body.group.id;

  // Second business (cross-tenant ownership fixtures).
  const biz2 = await createTestBusiness();
  otherBizId = biz2.business.id;
  otherToken = biz2.token;
  const m2 = await bearer(otherToken)(request(app).post(`/api/businesses/${otherBizId}/team-members`))
    .send({ name: 'Zoe', phoneNumber: '+13330008009', weeklyHours: 40 });
  otherMemberId = m2.body.teamMember.id;
  const cust2 = await addCustomerToBusiness(otherBizId, otherToken, { name: 'Carl', phoneNumber: '+13330008010' });
  const s2 = await bearer(otherToken)(request(app).post(`/api/businesses/${otherBizId}/customers/${cust2.id}/services`))
    .send({ name: 'Other Svc', frequency: 'weekly', tasks: [TASK], totalHours: 2, startDate: futureDate(7) });
  otherServiceId = s2.body.service.id;
});
afterAll(async () => { await knex.destroy(); });

describe('Create with optional assignee (atomic)', () => {
  it('assignee {teamMemberId} assigns all open Calls to that member', async () => {
    const res = await createService({ assignee: { teamMemberId: memberId } });
    expect(res.status).toBe(201);
    const rows = await assignmentsForService(res.body.service.id);
    expect(rows.length).toBe(4);
    expect(rows.every(r => r.team_member_id === memberId && r.team_id === null)).toBe(true);
  });

  it('assignee {teamId} assigns all open Calls to that team', async () => {
    const res = await createService({ assignee: { teamId } });
    expect(res.status).toBe(201);
    const rows = await assignmentsForService(res.body.service.id);
    expect(rows.length).toBe(4);
    expect(rows.every(r => r.team_id === teamId && r.team_member_id === null)).toBe(true);
  });

  it('one_time create with assignee assigns the single Call', async () => {
    const res = await createService({ frequency: 'one_time', assignee: { teamMemberId: memberId } });
    expect(res.status).toBe(201);
    const rows = await assignmentsForService(res.body.service.id);
    expect(rows.length).toBe(1);
    expect(rows[0].team_member_id).toBe(memberId);
  });

  it('creates unassigned when the assignee has neither field (set-only, D2)', async () => {
    const res = await createService({ assignee: {} });
    expect(res.status).toBe(201);
    const rows = await assignmentsForService(res.body.service.id);
    expect(rows.length).toBe(0);
  });

  it('rejects an assignee with BOTH member and team (400, XOR)', async () => {
    const res = await createService({ assignee: { teamMemberId: memberId, teamId } });
    expect(res.status).toBe(400);
  });

  it('validate-first: a bad assignee (other business) fails the whole create — zero rows', async () => {
    const before = await knex('customer_services').where('customer_id', customerId).count('* as c').first();
    const res = await createService({ assignee: { teamMemberId: otherMemberId } });
    expect(res.status).toBe(404);
    const after = await knex('customer_services').where('customer_id', customerId).count('* as c').first();
    expect(Number(after.c)).toBe(Number(before.c)); // nothing half-created
  });
});

describe('PUT /customers/:cid/services/:id/assignment (standalone fan-out)', () => {
  it('reassigns all OPEN Calls (upsert overwrites) and never touches completed Calls', async () => {
    const res = await createService({ assignee: { teamMemberId: memberId } });
    const serviceId = res.body.service.id;

    // Complete one Call, leaving 3 open. Its assignment (member, from create) must survive.
    const calls = await knex('selection_cycles').where('customer_service_id', serviceId).orderBy('id');
    await knex('selection_cycles').where('id', calls[0].id).update({ status: 'completed' });

    const put = await bearer(bizToken)(
      request(app).put(`/api/businesses/${businessId}/customers/${customerId}/services/${serviceId}/assignment`)
    ).send({ teamId });
    expect(put.status).toBe(200);
    expect(put.body.assignedCount).toBe(3);

    const rows = await assignmentsForService(serviceId);
    const open = rows.filter(r => r.status === 'open');
    const completed = rows.filter(r => r.status === 'completed');
    expect(open.length).toBe(3);
    expect(open.every(r => r.team_id === teamId && r.team_member_id === null)).toBe(true);
    expect(completed.length).toBe(1);
    expect(completed[0].team_member_id).toBe(memberId); // completed Call untouched
  });

  it('rejects a service from another business (404)', async () => {
    const put = await bearer(bizToken)(
      request(app).put(`/api/businesses/${businessId}/customers/${customerId}/services/${otherServiceId}/assignment`)
    ).send({ teamMemberId: memberId });
    expect(put.status).toBe(404);
  });

  it('rejects an assignee from another business (404)', async () => {
    const res = await createService({});
    const put = await bearer(bizToken)(
      request(app).put(`/api/businesses/${businessId}/customers/${customerId}/services/${res.body.service.id}/assignment`)
    ).send({ teamMemberId: otherMemberId });
    expect(put.status).toBe(404);
  });

  it('requires exactly one of member/team (400 on neither)', async () => {
    const res = await createService({});
    const put = await bearer(bizToken)(
      request(app).put(`/api/businesses/${businessId}/customers/${customerId}/services/${res.body.service.id}/assignment`)
    ).send({});
    expect(put.status).toBe(400);
  });
});

describe('Dashboard per-call override still wins after create-flow assignment', () => {
  it('PUT /assignments/:callId overrides a single Call (last-write-wins), others untouched', async () => {
    const res = await createService({ assignee: { teamMemberId: memberId } });
    const serviceId = res.body.service.id;
    const calls = await knex('selection_cycles').where('customer_service_id', serviceId).orderBy('id');
    const targetCall = calls[0].id;

    const put = await bearer(bizToken)(request(app).put(`/api/businesses/${businessId}/assignments/${targetCall}`))
      .send({ teamId });
    expect(put.status).toBe(200);

    const overridden = await knex('service_assignments').where('selection_cycle_id', targetCall).first();
    expect(overridden.team_id).toBe(teamId);
    expect(overridden.team_member_id).toBeNull();

    const others = await knex('service_assignments as sa')
      .join('selection_cycles as sc', 'sa.selection_cycle_id', 'sc.id')
      .where('sc.customer_service_id', serviceId)
      .whereNot('sa.selection_cycle_id', targetCall);
    expect(others.every(r => r.team_member_id === memberId)).toBe(true);
  });
});
