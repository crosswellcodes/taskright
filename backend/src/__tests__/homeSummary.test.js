const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestServiceCycle,
  addCustomerToBusiness, assignCycleToCustomer,
} = require('./helpers');

// Web portal M1 (Home/Today) — GET /api/businesses/:businessId/home-summary.
// One aggregate call composing Action Center, today, a 7-day week strip, lean
// MTD revenue, recent reviews, and the on-the-clock board. See WEB_PORTAL.md §4.1.

const businessService = require('../services/businessService');
const { todayInZone, addDaysKey } = require('../utils/businessDate');

const biz = (req, token) => req.set('Authorization', `Bearer ${token}`);
// Business-local (default America/Chicago) — not UTC, or this flakes 7pm–midnight Central.
const todayStr = () => todayInZone('America/Chicago');
const daysFromNow = (n) => addDaysKey(todayStr(), n);

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

// Time-zone correctness (WEB_PORTAL.md "Time zones"): every Home date boundary
// is the business's local day. Pinned at 2026-10-31 03:30 UTC = Fri Oct 30,
// 10:30pm CDT — the UTC date is already the 31st, and in Central it's the
// last evening of October.
describe('getHomeSummary — business-local day', () => {
  const NOW = new Date('2026-10-31T03:30:00Z');

  async function cycleOn(businessId, token, template, name, phone, fields) {
    const c = await addCustomerToBusiness(businessId, token, { name, phoneNumber: phone });
    await assignCycleToCustomer(businessId, c.id, template.id, token, 2);
    const cycle = await firstCycleFor(c.id);
    await knex('selection_cycles').where('id', cycle.id).update(fields);
    return cycle;
  }

  it('uses the business zone (Central) for today, week strip, deadlines and MTD at 10:30pm', async () => {
    const { business, token } = await createTestBusiness();
    const template = await createTestServiceCycle(business.id, token, [{ name: 'Clean', timeAllotmentMinutes: 60 }]);

    const today = await cycleOn(business.id, token, template, 'Today Co', '+13335550101',
      { service_date: '2026-10-30', submission_deadline: '2026-10-30' });
    const tomorrow = await cycleOn(business.id, token, template, 'Tomorrow Co', '+13335550102',
      { service_date: '2026-10-31', submission_deadline: '2026-10-31' });
    await cycleOn(business.id, token, template, 'October Co', '+13335550103',
      { status: 'completed', service_date: '2026-10-15', price: 100 });
    await cycleOn(business.id, token, template, 'September Co', '+13335550104',
      { status: 'completed', service_date: '2026-09-30', price: 999 });

    const summary = await businessService.getHomeSummary(business.id, { now: NOW });

    expect(summary.timeZone).toBe('America/Chicago');
    expect(summary.today.serviceDate).toBe('2026-10-30');
    expect(summary.today.items.map((i) => i.selectionCycleId)).toEqual([today.id]);
    expect(summary.weekStrip.map((d) => d.date)).toEqual(
      ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    expect(summary.weekStrip[0].count).toBeGreaterThanOrEqual(1);
    expect(summary.weekStrip[1].count).toBeGreaterThanOrEqual(1);
    // A deadline of today is not past yet (UTC would already call it overdue).
    // (Each customer also gets a second, real-clock-dated cycle — assert only ours.)
    const pastIds = summary.actionCenter.pastDeadline.map((i) => i.selectionCycleId);
    expect(pastIds).not.toContain(today.id);
    expect(pastIds).not.toContain(tomorrow.id);
    expect(summary.actionCenter.awaitingConfirmation.map((i) => i.selectionCycleId))
      .toEqual(expect.arrayContaining([today.id, tomorrow.id]));
    // Still October in Central — MTD must not snap to November.
    expect(summary.revenue.monthToDate).toBe(100);
  });

  it('honors a non-default business zone', async () => {
    const { business } = await createTestBusiness();
    await knex('businesses').where('id', business.id).update({ timezone: 'Pacific/Auckland' });

    const summary = await businessService.getHomeSummary(business.id, { now: NOW });

    expect(summary.timeZone).toBe('Pacific/Auckland');
    expect(summary.today.serviceDate).toBe('2026-10-31'); // 4:30pm Sat in Auckland
  });

  it('falls back to America/Chicago for an invalid stored zone', async () => {
    const { business } = await createTestBusiness();
    await knex('businesses').where('id', business.id).update({ timezone: 'Not/AZone' });

    const summary = await businessService.getHomeSummary(business.id, { now: NOW });

    expect(summary.timeZone).toBe('America/Chicago');
    expect(summary.today.serviceDate).toBe('2026-10-30');
  });
});
