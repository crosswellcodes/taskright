const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestServiceCycle
} = require('./helpers');

// Service Templates (the reusable library). Phase 2: a template owns its task menu
// as inline template_tasks rows — payload shape { id?, name, timeAllotmentMinutes }.
const TASK1 = { name: 'Vacuum', timeAllotmentMinutes: 20 };
const TASK2 = { name: 'Mop', timeAllotmentMinutes: 30 };

let businessId, token;

beforeEach(async () => {
  await truncateAllTables();
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  token = biz.token;
});
afterAll(async () => { await knex.destroy(); });

// ─── CREATE SERVICE TEMPLATE ──────────────────────────────────────────────────

describe('POST /api/businesses/:businessId/service-templates', () => {
  it('creates a template with an owned task menu', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-templates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Weekly Cleaning',
        frequency: 'weekly',
        daysBeforeServiceDeadline: 3,
        daysBeforeAutoRepeat: 1,
        tasks: [TASK1, TASK2]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.serviceTemplate.name).toBe('Weekly Cleaning');
    expect(res.body.serviceTemplate.frequency).toBe('weekly');
    expect(res.body.serviceTemplate.tasks).toHaveLength(2);
    expect(res.body.serviceTemplate.tasks[0]).toMatchObject({ name: 'Vacuum', timeAllotmentMinutes: 20 });
    expect(res.body.serviceTemplate.tasks[0].id).toBeDefined();
    expect(res.body.serviceTemplate.daysBeforeServiceDeadline).toBe(3);
  });

  it('creates a template with no tasks', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-templates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Empty Template',
        frequency: 'monthly',
        daysBeforeServiceDeadline: 7,
        daysBeforeAutoRepeat: 1,
        tasks: []
      });

    expect(res.status).toBe(201);
    expect(res.body.serviceTemplate.tasks).toHaveLength(0);
  });

  it('returns 400 for invalid frequency', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-templates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bad Template',
        frequency: 'daily',
        daysBeforeServiceDeadline: 3,
        daysBeforeAutoRepeat: 1,
        tasks: []
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-templates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        frequency: 'weekly',
        daysBeforeServiceDeadline: 3,
        daysBeforeAutoRepeat: 1
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed task (missing name)', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-templates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Template',
        frequency: 'weekly',
        daysBeforeServiceDeadline: 3,
        daysBeforeAutoRepeat: 1,
        tasks: [{ timeAllotmentMinutes: 20 }]
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-templates`)
      .send({ name: 'Template', frequency: 'weekly', daysBeforeServiceDeadline: 3, daysBeforeAutoRepeat: 1 });

    expect(res.status).toBe(401);
  });
});

// ─── GET SERVICE TEMPLATES ────────────────────────────────────────────────────

describe('GET /api/businesses/:businessId/service-templates', () => {
  it('returns all templates', async () => {
    await createTestServiceCycle(businessId, token, [TASK1], { name: 'Weekly' });
    await createTestServiceCycle(businessId, token, [], { name: 'Monthly', frequency: 'monthly' });

    const res = await request(app)
      .get(`/api/businesses/${businessId}/service-templates`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.serviceTemplates).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('includes a tasks array on each template', async () => {
    await createTestServiceCycle(businessId, token, [TASK1, TASK2]);

    const res = await request(app)
      .get(`/api/businesses/${businessId}/service-templates`)
      .set('Authorization', `Bearer ${token}`);

    const names = res.body.serviceTemplates[0].tasks.map(t => t.name);
    expect(names).toEqual(expect.arrayContaining(['Vacuum', 'Mop']));
  });
});

// ─── UPDATE SERVICE TEMPLATE ──────────────────────────────────────────────────

describe('PUT /api/businesses/:businessId/service-templates/:cycleId', () => {
  it('updates template name', async () => {
    const cycle = await createTestServiceCycle(businessId, token, [TASK1]);

    const res = await request(app)
      .put(`/api/businesses/${businessId}/service-templates/${cycle.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Template' });

    expect(res.status).toBe(200);
    expect(res.body.serviceTemplate.name).toBe('Renamed Template');
  });

  it('replaces the task menu', async () => {
    const cycle = await createTestServiceCycle(businessId, token, [TASK1]);

    const res = await request(app)
      .put(`/api/businesses/${businessId}/service-templates/${cycle.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tasks: [TASK2] });

    expect(res.status).toBe(200);
    expect(res.body.serviceTemplate.tasks).toHaveLength(1);
    expect(res.body.serviceTemplate.tasks[0]).toMatchObject({ name: 'Mop', timeAllotmentMinutes: 30 });
  });

  it('returns 404 for non-existent template', async () => {
    const res = await request(app)
      .put(`/api/businesses/${businessId}/service-templates/99999`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});
