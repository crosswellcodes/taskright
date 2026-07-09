const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness,
  createTestServiceCycle, addCustomerToBusiness, assignCycleToCustomer
} = require('./helpers');
const businessService = require('../services/businessService');

let businessId, bizToken, customerId, selectionCycleId, memberId;

beforeEach(async () => {
  await truncateAllTables();

  const biz = await createTestBusiness();
  businessId = biz.business.id;
  bizToken = biz.token;

  const cycle = await createTestServiceCycle(businessId, bizToken, [{ name: 'Mow lawn', timeAllotmentMinutes: 90 }]);

  const customer = await addCustomerToBusiness(businessId, bizToken, { name: 'Jane', phoneNumber: '+13330009999' });
  customerId = customer.id;

  await assignCycleToCustomer(businessId, customerId, cycle.id, bizToken, 3);
  const sc = await knex('selection_cycles').where('customer_id', customerId).orderBy('service_date', 'asc').first();
  selectionCycleId = sc.id;

  const memberRes = await request(app)
    .post(`/api/businesses/${businessId}/team-members`)
    .set('Authorization', `Bearer ${bizToken}`)
    .send({ name: 'Bob', phoneNumber: '+13330003333', weeklyHours: 40 });
  memberId = memberRes.body.teamMember.id;

  // Assign the member to the job so recordGeofenceEvent accepts events.
  await request(app)
    .put(`/api/businesses/${businessId}/assignments/${selectionCycleId}`)
    .set('Authorization', `Bearer ${bizToken}`)
    .send({ teamMemberId: memberId });
});
afterAll(async () => { await knex.destroy(); });

const auth = (req) => req.set('Authorization', `Bearer ${bizToken}`);

// Fire a full arrival→departure pair for the member+job. Returns the departure result.
async function fireDeparture(offsetHours = 2) {
  const base = Date.now();
  await businessService.recordGeofenceEvent(memberId, selectionCycleId, {
    eventType: 'arrival', occurredAt: new Date(base).toISOString(), lat: 1, lng: 1, method: 'auto',
  });
  return businessService.recordGeofenceEvent(memberId, selectionCycleId, {
    eventType: 'departure', occurredAt: new Date(base + offsetHours * 3600e3).toISOString(), lat: 1, lng: 1, method: 'auto',
  });
}

// ─── DEPARTURE TRIGGER ────────────────────────────────────────────────────────

describe('geofence departure → review token', () => {
  it('creates a review token on departure', async () => {
    const dep = await fireDeparture();
    expect(dep.reviewRequestSent).toBe(true);

    const row = await knex('review_tokens').where('selection_cycle_id', selectionCycleId).first();
    expect(row).toBeTruthy();
    expect(row.token).toHaveLength(36);
    expect(row.customer_id).toBe(customerId);
    expect(row.business_id).toBe(businessId);
    expect(row.sent_at).toBeTruthy();
    expect(row.submitted_at).toBeNull();
    expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('suppresses the token when the customer is opted out (Rule 2)', async () => {
    await auth(request(app).patch(`/api/businesses/${businessId}/customers/${customerId}`))
      .send({ reviewRequestsOptedOut: true });

    const dep = await fireDeparture();
    expect(dep.reviewRequestSent).toBe(false);
    const rows = await knex('review_tokens').where('selection_cycle_id', selectionCycleId);
    expect(rows).toHaveLength(0);
  });

  it('reuses the existing token on a second departure — no second SMS (Rule 3)', async () => {
    const first = await fireDeparture();
    expect(first.reviewRequestSent).toBe(true);
    const tokenAfterFirst = (await knex('review_tokens').where('selection_cycle_id', selectionCycleId).first()).token;

    const second = await fireDeparture();
    expect(second.reviewRequestSent).toBe(false);

    const rows = await knex('review_tokens').where('selection_cycle_id', selectionCycleId);
    expect(rows).toHaveLength(1);
    expect(rows[0].token).toBe(tokenAfterFirst);
  });
});

// ─── GET /api/review/:token ───────────────────────────────────────────────────

describe('GET /api/review/:token', () => {
  it('returns non-sensitive context and sets opened_at on first load', async () => {
    await fireDeparture();
    const token = (await knex('review_tokens').where('selection_cycle_id', selectionCycleId).first()).token;

    const res = await request(app).get(`/api/review/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.customerName).toBe('Jane');
    expect(res.body.businessName).toBeTruthy();
    expect(res.body.serviceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const row = await knex('review_tokens').where('token', token).first();
    expect(row.opened_at).toBeTruthy();
  });

  it('returns { valid: false } for a missing token', async () => {
    const res = await request(app).get('/api/review/does-not-exist');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('returns { valid: false } for an expired token (Rule 4)', async () => {
    await fireDeparture();
    const token = (await knex('review_tokens').where('selection_cycle_id', selectionCycleId).first()).token;
    await knex('review_tokens').where('token', token).update({ expires_at: new Date(Date.now() - 1000).toISOString() });

    const res = await request(app).get(`/api/review/${token}`);
    expect(res.body.valid).toBe(false);
  });
});

// ─── POST /api/review/:token ──────────────────────────────────────────────────

describe('POST /api/review/:token', () => {
  async function getToken() {
    await fireDeparture();
    return (await knex('review_tokens').where('selection_cycle_id', selectionCycleId).first()).token;
  }

  it('writes a feedbacks row (source=sms_request) and sets submitted_at', async () => {
    const token = await getToken();
    const res = await request(app).post(`/api/review/${token}`).send({ rating: 5, comment: 'Great job!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const fb = await knex('feedbacks').where('customer_id', customerId).where('selection_cycle_id', selectionCycleId).first();
    expect(fb).toBeTruthy();
    expect(fb.rating).toBe(5);
    expect(fb.feedback_text).toBe('Great job!');
    expect(fb.source).toBe('sms_request');

    const row = await knex('review_tokens').where('token', token).first();
    expect(row.submitted_at).toBeTruthy();
  });

  it('is idempotent — a resubmit does not write a second feedback row (Rule 5)', async () => {
    const token = await getToken();
    await request(app).post(`/api/review/${token}`).send({ rating: 4, comment: 'first' });
    const second = await request(app).post(`/api/review/${token}`).send({ rating: 1, comment: 'second' });
    expect(second.status).toBe(200);
    expect(second.body.success).toBe(true);

    const rows = await knex('feedbacks').where('customer_id', customerId).where('selection_cycle_id', selectionCycleId);
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(4); // unchanged by the second POST
    expect(rows[0].feedback_text).toBe('first');
  });

  it('rejects an expired token with 410 (Rule 4)', async () => {
    const token = await getToken();
    await knex('review_tokens').where('token', token).update({ expires_at: new Date(Date.now() - 1000).toISOString() });
    const res = await request(app).post(`/api/review/${token}`).send({ rating: 5 });
    expect(res.status).toBe(410);
  });

  it('rejects a missing token with 404', async () => {
    const res = await request(app).post('/api/review/nope').send({ rating: 5 });
    expect(res.status).toBe(404);
  });

  it('rejects an out-of-range rating with 400', async () => {
    const token = await getToken();
    const res = await request(app).post(`/api/review/${token}`).send({ rating: 6 });
    expect(res.status).toBe(400);
  });
});

// ─── OPT-OUT TOGGLE ───────────────────────────────────────────────────────────

describe('PATCH customer reviewRequestsOptedOut', () => {
  it('persists the opt-out flag and echoes it back', async () => {
    const res = await auth(request(app).patch(`/api/businesses/${businessId}/customers/${customerId}`))
      .send({ reviewRequestsOptedOut: true });
    expect(res.status).toBe(200);
    expect(res.body.customer.reviewRequestsOptedOut).toBe(true);

    const row = await knex('customers').where('id', customerId).first();
    expect(row.review_requests_opted_out).toBe(true);
  });

  it('surfaces reviewRequestsOptedOut on the customer detail payload', async () => {
    const before = await auth(request(app).get(`/api/businesses/${businessId}/customers/${customerId}`));
    expect(before.body.customer.reviewRequestsOptedOut).toBe(false);

    await auth(request(app).patch(`/api/businesses/${businessId}/customers/${customerId}`))
      .send({ reviewRequestsOptedOut: true });

    const after = await auth(request(app).get(`/api/businesses/${businessId}/customers/${customerId}`));
    expect(after.body.customer.reviewRequestsOptedOut).toBe(true);
  });
});
