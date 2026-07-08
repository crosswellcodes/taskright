const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestTask,
  createTestServiceCycle, addCustomerToBusiness, assignCycleToCustomer
} = require('./helpers');
const businessService = require('../services/businessService');

let businessId, bizToken, customerId, assignmentId, selectionCycleId, memberId, laborCategoryId, task1;

beforeEach(async () => {
  await truncateAllTables();

  const biz = await createTestBusiness();
  businessId = biz.business.id;
  bizToken = biz.token;

  task1 = await createTestTask(businessId, bizToken, { name: 'Mow lawn', timeAllotmentMinutes: 90 });
  const cycle = await createTestServiceCycle(businessId, bizToken, [task1.id]);

  const customer = await addCustomerToBusiness(businessId, bizToken, { name: 'Alice', phoneNumber: '+13330002222' });
  customerId = customer.id;

  await assignCycleToCustomer(businessId, customerId, cycle.id, bizToken, 3);
  const cca = await knex('customer_services').where('customer_id', customerId).first();
  assignmentId = cca.id;
  const sc = await knex('selection_cycles').where('customer_id', customerId).orderBy('service_date', 'asc').first();
  selectionCycleId = sc.id;

  const memberRes = await request(app)
    .post(`/api/businesses/${businessId}/team-members`)
    .set('Authorization', `Bearer ${bizToken}`)
    .send({ name: 'Bob', phoneNumber: '+13330003333', weeklyHours: 40 });
  memberId = memberRes.body.teamMember.id;

  const cat = await knex('cost_categories').where('code', 5000).where('is_system', true).first();
  laborCategoryId = cat.id;
});
afterAll(async () => { await knex.destroy(); });

const auth = (req) => req.set('Authorization', `Bearer ${bizToken}`);

// ─── COST CATEGORIES ──────────────────────────────────────────────────────────

describe('GET /api/businesses/:id/cost-categories', () => {
  it('returns the four GAAP system categories', async () => {
    const res = await auth(request(app).get(`/api/businesses/${businessId}/cost-categories`));
    expect(res.status).toBe(200);
    const codes = res.body.categories.map(c => c.code).sort();
    expect(codes).toEqual([4000, 5000, 5100, 5200]);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/businesses/${businessId}/cost-categories`);
    expect(res.status).toBe(401);
  });
});

// ─── TEAM MEMBER HOURLY RATE ──────────────────────────────────────────────────

describe('PUT team-members with hourlyRate', () => {
  it('persists the hourly rate', async () => {
    const res = await auth(request(app).put(`/api/businesses/${businessId}/team-members/${memberId}`))
      .send({ hourlyRate: 42.5 });
    expect(res.status).toBe(200);
    expect(Number(res.body.teamMember.hourlyRate)).toBe(42.5);
    const row = await knex('team_members').where('id', memberId).first();
    expect(Number(row.hourly_rate)).toBe(42.5);
  });
});

// ─── JOB PRICE ────────────────────────────────────────────────────────────────

describe('PATCH /jobs/:selectionCycleId/price', () => {
  it('sets the job price', async () => {
    const res = await auth(request(app).patch(`/api/businesses/${businessId}/jobs/${selectionCycleId}/price`))
      .send({ price: 250 });
    expect(res.status).toBe(200);
    expect(Number(res.body.selectionCycle.price)).toBe(250);
  });

  it('rejects a negative price', async () => {
    const res = await auth(request(app).patch(`/api/businesses/${businessId}/jobs/${selectionCycleId}/price`))
      .send({ price: -5 });
    expect(res.status).toBe(400);
  });

  it('404s for a job owned by another business', async () => {
    const other = await createTestBusiness();
    const res = await request(app)
      .patch(`/api/businesses/${other.business.id}/jobs/${selectionCycleId}/price`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ price: 100 });
    expect(res.status).toBe(404);
  });
});

// ─── ASSIGNMENT PRICE (D2 feed) ───────────────────────────────────────────────

describe('PATCH /customers/:customerId/assignments/:assignmentId', () => {
  it('sets pricePerVisit on the assignment', async () => {
    const res = await auth(request(app).patch(`/api/businesses/${businessId}/customers/${customerId}/assignments/${assignmentId}`))
      .send({ pricePerVisit: 175 });
    expect(res.status).toBe(200);
    const row = await knex('customer_services').where('id', assignmentId).first();
    expect(Number(row.price_per_visit)).toBe(175);
  });

  it('propagates to newly generated cycles (D2 creation-time copy)', async () => {
    const cycle2 = await createTestServiceCycle(businessId, bizToken, [task1.id], { name: 'Biweekly' });
    const startDate = new Date(Date.now() + 14 * 864e5).toISOString().split('T')[0];
    await request(app)
      .post(`/api/businesses/${businessId}/customers/${customerId}/services`)
      .set('Authorization', `Bearer ${bizToken}`)
      .send({ templateId: cycle2.id, totalHours: 2, startDate });

    const cca2 = await knex('customer_services')
      .where('customer_id', customerId).where('template_id', cycle2.id).first();
    await auth(request(app).patch(`/api/businesses/${businessId}/customers/${customerId}/assignments/${cca2.id}`))
      .send({ pricePerVisit: 88 });

    // Clear the cycles that were generated before the price existed, then
    // re-run generation — now the recurring price should copy onto each cycle.
    await knex('selection_cycles').where('customer_id', customerId).where('customer_service_id', cca2.id).delete();
    const svc = await knex('customer_services').where('id', cca2.id).first();
    await businessService.generateUpcomingSelectionCycles(customerId, svc, startDate, null);

    const cycles = await knex('selection_cycles')
      .where('customer_id', customerId).where('customer_service_id', cca2.id);
    expect(cycles.length).toBeGreaterThan(0);
    for (const c of cycles) {
      expect(Number(c.price)).toBe(88);
    }
  });

  it('exposes assignmentId + pricePerVisit on customer detail assignedCycles', async () => {
    // CustomerDetailScreen needs the assignment row id (to PATCH) and current
    // recurring price (to display) — both surfaced on assignedCycles.
    await auth(request(app).patch(`/api/businesses/${businessId}/customers/${customerId}/assignments/${assignmentId}`))
      .send({ pricePerVisit: 175 });
    const res = await auth(request(app).get(`/api/businesses/${businessId}/customers/${customerId}`));
    expect(res.status).toBe(200);
    const cyc = res.body.customer.assignedCycles.find(c => c.assignmentId === assignmentId);
    expect(cyc).toBeTruthy();
    expect(Number(cyc.pricePerVisit)).toBe(175);
  });
});

// ─── MANUAL COST LINES (D1) ───────────────────────────────────────────────────

describe('POST /jobs/:selectionCycleId/costs', () => {
  it('adds a materials line stamped source=manual', async () => {
    const cat = await knex('cost_categories').where('code', 5100).first();
    const res = await auth(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`))
      .send({ costCategoryId: cat.id, amount: 50 });
    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe('manual');
    expect(Number(res.body.data.amount)).toBe(50);
  });

  it('rejects a labor line missing teamMemberId/hoursActual', async () => {
    const res = await auth(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`))
      .send({ costCategoryId: laborCategoryId, amount: 100 });
    expect(res.status).toBe(400);
  });

  it('rejects teamMemberId on a non-labor line', async () => {
    const cat = await knex('cost_categories').where('code', 5200).first();
    const res = await auth(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`))
      .send({ costCategoryId: cat.id, amount: 20, teamMemberId: memberId, hoursActual: 1 });
    expect(res.status).toBe(400);
  });

  it('409s on a duplicate labor line for the same member (Rule 6)', async () => {
    const body = { costCategoryId: laborCategoryId, amount: 100, teamMemberId: memberId, hoursActual: 2 };
    const first = await auth(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`)).send(body);
    expect(first.status).toBe(201);
    const dup = await auth(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`)).send(body);
    expect(dup.status).toBe(409);
  });
});

describe('PATCH /jobs/:selectionCycleId/costs/:costId', () => {
  it('updates the amount and marks the row manual', async () => {
    const cat = await knex('cost_categories').where('code', 5100).first();
    const created = await auth(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`))
      .send({ costCategoryId: cat.id, amount: 50 });
    const costId = created.body.data.id;
    const res = await auth(request(app).patch(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs/${costId}`))
      .send({ amount: 75 });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.amount)).toBe(75);
    expect(res.body.data.source).toBe('manual');
  });
});

describe('DELETE /jobs/:selectionCycleId/costs/:costId', () => {
  it('removes the cost line', async () => {
    const cat = await knex('cost_categories').where('code', 5100).first();
    const created = await auth(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`))
      .send({ costCategoryId: cat.id, amount: 50 });
    const costId = created.body.data.id;
    const res = await auth(request(app).delete(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs/${costId}`));
    expect(res.status).toBe(200);
    const row = await knex('job_costs').where('id', costId).first();
    expect(row).toBeUndefined();
  });
});

// ─── D1: manual labor survives an auto geofence recompute ──────────────────────

describe('D1 — geofence recompute skips manual labor rows', () => {
  it('does not overwrite an owner-corrected labor line', async () => {
    // Assign the member to the job so recordGeofenceEvent accepts events.
    await auth(request(app).put(`/api/businesses/${businessId}/assignments/${selectionCycleId}`))
      .send({ teamMemberId: memberId });
    await auth(request(app).put(`/api/businesses/${businessId}/team-members/${memberId}`))
      .send({ hourlyRate: 20 });

    // Owner enters a manual labor correction.
    const created = await auth(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`))
      .send({ costCategoryId: laborCategoryId, amount: 999, teamMemberId: memberId, hoursActual: 5 });
    expect(created.status).toBe(201);

    // A full arrival→departure pair fires afterward (would auto-compute ~2h × $20).
    const base = Date.now();
    await businessService.recordGeofenceEvent(memberId, selectionCycleId, {
      eventType: 'arrival', occurredAt: new Date(base).toISOString(), lat: 1, lng: 1, method: 'auto',
    });
    const dep = await businessService.recordGeofenceEvent(memberId, selectionCycleId, {
      eventType: 'departure', occurredAt: new Date(base + 2 * 3600e3).toISOString(), lat: 1, lng: 1, method: 'auto',
    });
    expect(dep.laborCostCreated).toBe(false); // manual row was protected

    const row = await knex('job_costs')
      .where('selection_cycle_id', selectionCycleId).where('team_member_id', memberId).first();
    expect(Number(row.amount)).toBe(999);
    expect(Number(row.hours_actual)).toBe(5);
    expect(row.source).toBe('manual');
  });
});

// ─── JOB COSTS PAYLOAD ────────────────────────────────────────────────────────

describe('GET /jobs/:selectionCycleId/costs', () => {
  it('computes totals and margin when price is set', async () => {
    await auth(request(app).patch(`/api/businesses/${businessId}/jobs/${selectionCycleId}/price`)).send({ price: 200 });
    const materials = await knex('cost_categories').where('code', 5100).first();
    const overhead = await knex('cost_categories').where('code', 5200).first();
    const matCreated = await auth(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`))
      .send({ costCategoryId: materials.id, amount: 50 });
    const ovhCreated = await auth(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`))
      .send({ costCategoryId: overhead.id, amount: 30 });

    const res = await auth(request(app).get(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`));
    expect(res.status).toBe(200);
    const c = res.body.costs;
    expect(c.price).toBe(200);
    expect(c.materialsAmount).toBe(50);
    expect(c.overheadAmount).toBe(30);
    expect(c.totalCost).toBe(80);
    expect(c.marginDollars).toBe(120);
    expect(c.marginPercent).toBe(60);
    expect(c.estimatedHours).toBe(0); // no selection submitted
    // Single-line ids let the UI PATCH the existing materials/overhead value.
    expect(c.materialsCostId).toBe(matCreated.body.data.id);
    expect(c.overheadCostId).toBe(ovhCreated.body.data.id);
  });

  it('returns null margin when price is not set (Rule 3)', async () => {
    const res = await auth(request(app).get(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`));
    expect(res.status).toBe(200);
    expect(res.body.costs.price).toBeNull();
    expect(res.body.costs.marginDollars).toBeNull();
    expect(res.body.costs.marginPercent).toBeNull();
  });

  it('returns null materials/overhead cost ids when no such lines exist', async () => {
    const res = await auth(request(app).get(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`));
    expect(res.status).toBe(200);
    expect(res.body.costs.materialsCostId).toBeNull();
    expect(res.body.costs.overheadCostId).toBeNull();
  });
});

// ─── PROFITABILITY ────────────────────────────────────────────────────────────

describe('GET /customers/:customerId/profitability', () => {
  it('aggregates over completed cycles only', async () => {
    // Open cycle with a cost should be excluded until completed.
    await auth(request(app).patch(`/api/businesses/${businessId}/jobs/${selectionCycleId}/price`)).send({ price: 300 });
    const materials = await knex('cost_categories').where('code', 5100).first();
    await auth(request(app).post(`/api/businesses/${businessId}/jobs/${selectionCycleId}/costs`))
      .send({ costCategoryId: materials.id, amount: 100 });

    let res = await auth(request(app).get(`/api/businesses/${businessId}/customers/${customerId}/profitability`));
    expect(res.status).toBe(200);
    expect(res.body.profitability.completedJobCount).toBe(0);

    await knex('selection_cycles').where('id', selectionCycleId).update({ status: 'completed' });

    res = await auth(request(app).get(`/api/businesses/${businessId}/customers/${customerId}/profitability`));
    const p = res.body.profitability;
    expect(p.completedJobCount).toBe(1);
    expect(p.totalRevenue).toBe(300);
    expect(p.totalCost).toBe(100);
    expect(p.totalMarginDollars).toBe(200);
    expect(p.jobs).toHaveLength(1);
  });
});
