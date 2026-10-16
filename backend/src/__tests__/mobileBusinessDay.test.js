const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestServiceCycle,
  addCustomerToBusiness, assignCycleToCustomer,
} = require('./helpers');
const businessService = require('../services/businessService');

// Mobile-facing "today" paths use the business's zone (businesses.timezone,
// migration 029), not the server's UTC day. See WEB_PORTAL.md §2 "Time zones".
// Pinned at 2026-10-31 03:30 UTC = Fri Oct 30, 10:30pm CDT — UTC is already
// Saturday the 31st; the business is still on Friday.
const NOW = new Date('2026-10-31T03:30:00Z');

const biz = (req, token) => req.set('Authorization', `Bearer ${token}`);
const keyOf = 'to_char(service_date, \'YYYY-MM-DD\') as "dateKey"'; // host-TZ-proof

beforeEach(async () => { await truncateAllTables(); });
afterAll(async () => { await knex.destroy(); });

async function setupCycles(dates) {
  const { business, token } = await createTestBusiness();
  const template = await createTestServiceCycle(business.id, token, [{ name: 'Clean', timeAllotmentMinutes: 60 }]);
  const cycles = [];
  for (const [i, date] of dates.entries()) {
    const c = await addCustomerToBusiness(business.id, token, { name: `Co ${i}`, phoneNumber: `+1333555020${i}` });
    await assignCycleToCustomer(business.id, c.id, template.id, token, 2);
    const cycle = await knex('selection_cycles').where('customer_id', c.id).orderBy('id', 'asc').first();
    await knex('selection_cycles').where('id', cycle.id).update({ service_date: date, submission_deadline: date });
    // Push the customer's other generated cycle out of every window under test.
    await knex('selection_cycles').where('customer_id', c.id).whereNot('id', cycle.id).update({ service_date: '2030-01-01' });
    cycles.push({ ...cycle, customerId: c.id });
  }
  return { business, token, cycles };
}

describe('getJobsForTeamMember — business-local today', () => {
  it('keeps tonight\'s job (Central Friday) when UTC is already Saturday', async () => {
    const { business, token, cycles: [tonight, yesterday] } = await setupCycles(['2026-10-30', '2026-10-29']);
    const memberId = (await biz(request(app).post(`/api/businesses/${business.id}/team-members`), token)
      .send({ name: 'Ann', phoneNumber: '+13335559101', weeklyHours: 40 })).body.teamMember.id;
    for (const c of [tonight, yesterday]) {
      await biz(request(app).put(`/api/businesses/${business.id}/assignments/${c.id}`), token).send({ teamMemberId: memberId });
    }

    const jobs = await businessService.getJobsForTeamMember(memberId, { now: NOW });
    const ids = jobs.map((j) => j.selectionCycleId);

    expect(ids).toContain(tonight.id);
    expect(ids).not.toContain(yesterday.id);
  });
});

describe('getBusinessForecast — default window from business-local today', () => {
  it('spans the business\'s today..today+30 when no range is given', async () => {
    const { business, cycles: [today, lastDay, pastEnd] } = await setupCycles(['2026-10-30', '2026-11-29', '2026-11-30']);

    const summary = await businessService.getBusinessForecast(business.id, {}, { now: NOW });
    const ids = summary.upcomingServices.flatMap((d) => d.serviceCycles.flatMap((s) =>
      [...s.pendingCustomers, ...s.submittedCustomers].map((e) => e.selectionCycleId)));

    expect(ids).toContain(today.id);       // UTC today (Oct 31) would drop it
    expect(ids).toContain(lastDay.id);
    expect(ids).not.toContain(pastEnd.id);
  });

  it('leaves an explicit range untouched', async () => {
    const { business, cycles: [c] } = await setupCycles(['2026-10-29']);

    const summary = await businessService.getBusinessForecast(business.id, { from: '2026-10-29', to: '2026-10-29' }, { now: NOW });

    expect(summary.upcomingServices).toHaveLength(1);
    expect(summary.upcomingServices[0].serviceCycles[0].pendingCustomers[0].selectionCycleId).toBe(c.id);
  });
});

describe('generateUpcomingSelectionCycles — day-of-week default start', () => {
  async function generate(dayOfWeek, timezone) {
    const { business, token } = await createTestBusiness();
    if (timezone) await knex('businesses').where('id', business.id).update({ timezone });
    const c = await addCustomerToBusiness(business.id, token, { name: 'DOW Co', phoneNumber: '+13335550301' });
    const [svc] = await knex('customer_services').insert({
      customer_id: c.id, name: 'Weekly clean', frequency: 'weekly',
      days_before_service_deadline: 2, days_before_auto_repeat: 7, total_hours: 2, day_of_week: dayOfWeek,
    }).returning('*');

    await businessService.generateUpcomingSelectionCycles(c.id, svc, null, dayOfWeek, { now: NOW });

    return (await knex('selection_cycles').where('customer_service_id', svc.id).orderBy('service_date')
      .select(knex.raw(keyOf), knex.raw('to_char(submission_deadline, \'YYYY-MM-DD\') as "deadlineKey"')));
  }

  it('starts from the business\'s tomorrow (Sat Oct 31), not UTC\'s (Sun Nov 1)', async () => {
    const rows = await generate(6); // Saturday
    expect(rows.map((r) => r.dateKey)).toEqual(['2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21']);
    expect(rows[0].deadlineKey).toBe('2026-10-29');
  });

  it('rolls to the next matching weekday after tomorrow', async () => {
    const rows = await generate(5); // Friday — tomorrow is Saturday, so next Friday
    expect(rows[0].dateKey).toBe('2026-11-06');
  });

  it('uses a non-default business zone', async () => {
    const rows = await generate(0, 'Pacific/Auckland'); // Auckland is on Sat Oct 31 → tomorrow Sun Nov 1
    expect(rows[0].dateKey).toBe('2026-11-01');
  });
});
