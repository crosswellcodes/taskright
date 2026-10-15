const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestServiceCycle,
  addCustomerToBusiness, assignCycleToCustomer,
} = require('./helpers');

// Web portal M1 (Home/Today) — GET /api/businesses/:businessId/home-summary.
// One aggregate call composing Action Center, today, a 7-day week strip, lean
// MTD revenue, recent reviews, and the on-the-clock board. See WEB_PORTAL.md §4.1.

const biz = (req, token) => req.set('Authorization', `Bearer ${token}`);
const todayStr = () => new Date().toISOString().split('T')[0];
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

async function firstCycleFor(customerId) {
  return knex('selection_cycles').where('customer_id', customerId).orderBy('id', 'asc').first();
}

beforeEach(async () => { await truncateAllTables(); });
afterAll(async () => { await knex.destroy(); });

describe('GET /api/businesses/:businessId/home-summary', () => {
  it('returns the empty shape for a business with no customers', async () => {
    const { business, token } = await createTestBusiness();

    const res = await request(app)
      .get(`/api/businesses/${business.id}/home-summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.actionCenter).toEqual({ awaitingConfirmation: [], pastDeadline: [], unassignedUpcoming: [], unreadMessages: [] });
    expect(res.body.summary.weekStrip).toHaveLength(7);
    expect(res.body.summary.revenue.monthToDate).toBe(0);
    expect(res.body.summary.recentReviews).toEqual([]);
    expect(res.body.summary.activeClocks).toEqual([]);
  });

  it('returns 403 when requesting another business\'s summary', async () => {
    const { business: a } = await createTestBusiness();
    const { token: tokenB } = await createTestBusiness();

    const res = await request(app)
      .get(`/api/businesses/${a.id}/home-summary`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
  });

  it('composes action center, today, week strip, revenue, reviews, and active clocks', async () => {
    const { business, token } = await createTestBusiness();
    const businessId = business.id;
    const template = await createTestServiceCycle(businessId, token, [{ name: 'Clean', timeAllotmentMinutes: 60 }]);

    // Today Co: due today, not submitted, not assigned.
    const todayCo = await addCustomerToBusiness(businessId, token, { name: 'Today Co', phoneNumber: '+13335550001' });
    await assignCycleToCustomer(businessId, todayCo.id, template.id, token, 2);
    const todayCycle = await firstCycleFor(todayCo.id);
    await knex('selection_cycles').where('id', todayCycle.id).update({ service_date: todayStr(), submission_deadline: daysFromNow(1) });

    // Overdue Co: deadline already passed, not submitted.
    const overdueCo = await addCustomerToBusiness(businessId, token, { name: 'Overdue Co', phoneNumber: '+13335550002' });
    await assignCycleToCustomer(businessId, overdueCo.id, template.id, token, 2);
    const overdueCycle = await firstCycleFor(overdueCo.id);
    await knex('selection_cycles').where('id', overdueCycle.id)
      .update({ service_date: daysFromNow(2), submission_deadline: daysFromNow(-1) });

    // Assigned Co: due within the week, assigned to a team member — excluded from unassignedUpcoming.
    const assignedCo = await addCustomerToBusiness(businessId, token, { name: 'Assigned Co', phoneNumber: '+13335550003' });
    await assignCycleToCustomer(businessId, assignedCo.id, template.id, token, 2);
    const assignedCycle = await firstCycleFor(assignedCo.id);
    await knex('selection_cycles').where('id', assignedCycle.id).update({ service_date: daysFromNow(3) });
    const member = (await biz(request(app).post(`/api/businesses/${businessId}/team-members`), token)
      .send({ name: 'Ann', phoneNumber: '+13335559001', weeklyHours: 40 })).body.teamMember.id;
    await biz(request(app).put(`/api/businesses/${businessId}/assignments/${assignedCycle.id}`), token)
      .send({ teamMemberId: member });

    // Completed Co: completed this month with a price — feeds MTD revenue.
    const completedCo = await addCustomerToBusiness(businessId, token, { name: 'Completed Co', phoneNumber: '+13335550004' });
    await assignCycleToCustomer(businessId, completedCo.id, template.id, token, 2);
    const completedCycle = await firstCycleFor(completedCo.id);
    await knex('selection_cycles').where('id', completedCycle.id)
      .update({ status: 'completed', service_date: todayStr(), price: 150 });
    await knex('feedbacks').insert({ customer_id: completedCo.id, selection_cycle_id: completedCycle.id, rating: 5, feedback_text: 'Great job!' });

    // Active clock: Ann currently on-site at Assigned Co's job.
    await knex('geofence_events').insert({
      selection_cycle_id: assignedCycle.id, team_member_id: member, event_type: 'arrival', method: 'auto',
      occurred_at: knex.raw('CURRENT_TIMESTAMP'),
    });

    const res = await request(app)
      .get(`/api/businesses/${businessId}/home-summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { summary } = res.body;

    const awaitingIds = summary.actionCenter.awaitingConfirmation.map((i) => i.selectionCycleId);
    expect(awaitingIds).toEqual(expect.arrayContaining([todayCycle.id, assignedCycle.id]));
    expect(awaitingIds).not.toContain(overdueCycle.id);

    const pastDeadlineIds = summary.actionCenter.pastDeadline.map((i) => i.selectionCycleId);
    expect(pastDeadlineIds).toEqual([overdueCycle.id]);

    const unassignedIds = summary.actionCenter.unassignedUpcoming.map((i) => i.selectionCycleId);
    expect(unassignedIds).toContain(todayCycle.id);
    expect(unassignedIds).not.toContain(assignedCycle.id);

    expect(summary.today.serviceDate).toBe(todayStr());
    expect(summary.today.items.map((i) => i.selectionCycleId)).toContain(todayCycle.id);

    expect(summary.weekStrip).toHaveLength(7);
    expect(summary.weekStrip[0].date).toBe(todayStr());

    expect(summary.revenue.monthToDate).toBe(150);

    expect(summary.recentReviews).toHaveLength(1);
    expect(summary.recentReviews[0]).toMatchObject({ rating: 5, feedbackText: 'Great job!', customerName: 'Completed Co' });

    expect(summary.activeClocks).toHaveLength(1);
    expect(summary.activeClocks[0]).toMatchObject({ teamMemberId: member, teamMemberName: 'Ann', selectionCycleId: assignedCycle.id, customerName: 'Assigned Co' });
  });
});
