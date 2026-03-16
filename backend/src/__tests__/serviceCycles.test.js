const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestTask, createTestServiceCycle
} = require('./helpers');

let businessId, token, task1, task2;

beforeEach(async () => {
  await truncateAllTables();
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  token = biz.token;
  task1 = await createTestTask(businessId, token, { name: 'Vacuum', timeAllotmentMinutes: 20 });
  task2 = await createTestTask(businessId, token, { name: 'Mop', timeAllotmentMinutes: 30 });
});
afterAll(async () => { await knex.destroy(); });

// ─── CREATE SERVICE CYCLE ─────────────────────────────────────────────────────

describe('POST /api/businesses/:businessId/service-cycles', () => {
  it('creates a service cycle with assigned tasks', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-cycles`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Weekly Cleaning',
        frequency: 'weekly',
        daysBeforeServiceDeadline: 3,
        daysBeforeAutoRepeat: 1,
        taskIds: [task1.id, task2.id]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.serviceCycle.name).toBe('Weekly Cleaning');
    expect(res.body.serviceCycle.frequency).toBe('weekly');
    expect(res.body.serviceCycle.assignedTasks).toHaveLength(2);
    expect(res.body.serviceCycle.daysBeforeServiceDeadline).toBe(3);
  });

  it('creates a service cycle with no tasks', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-cycles`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Empty Cycle',
        frequency: 'monthly',
        daysBeforeServiceDeadline: 7,
        daysBeforeAutoRepeat: 1,
        taskIds: []
      });

    expect(res.status).toBe(201);
    expect(res.body.serviceCycle.assignedTasks).toHaveLength(0);
  });

  it('returns 400 for invalid frequency', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-cycles`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bad Cycle',
        frequency: 'daily',
        daysBeforeServiceDeadline: 3,
        daysBeforeAutoRepeat: 1,
        taskIds: []
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-cycles`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        frequency: 'weekly',
        daysBeforeServiceDeadline: 3,
        daysBeforeAutoRepeat: 1
      });

    expect(res.status).toBe(400);
  });

  it('returns 404 when a taskId does not exist', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-cycles`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Cycle',
        frequency: 'weekly',
        daysBeforeServiceDeadline: 3,
        daysBeforeAutoRepeat: 1,
        taskIds: [99999]
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TASK_NOT_FOUND');
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/service-cycles`)
      .send({ name: 'Cycle', frequency: 'weekly', daysBeforeServiceDeadline: 3, daysBeforeAutoRepeat: 1 });

    expect(res.status).toBe(401);
  });
});

// ─── GET SERVICE CYCLES ───────────────────────────────────────────────────────

describe('GET /api/businesses/:businessId/service-cycles', () => {
  it('returns all service cycles', async () => {
    await createTestServiceCycle(businessId, token, [task1.id], { name: 'Weekly' });
    await createTestServiceCycle(businessId, token, [], { name: 'Monthly', frequency: 'monthly' });

    const res = await request(app)
      .get(`/api/businesses/${businessId}/service-cycles`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.serviceCycles).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('includes assignedTasks array on each cycle', async () => {
    await createTestServiceCycle(businessId, token, [task1.id, task2.id]);

    const res = await request(app)
      .get(`/api/businesses/${businessId}/service-cycles`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.serviceCycles[0].assignedTasks).toEqual(
      expect.arrayContaining([task1.id, task2.id])
    );
  });
});

// ─── UPDATE SERVICE CYCLE ─────────────────────────────────────────────────────

describe('PUT /api/businesses/:businessId/service-cycles/:cycleId', () => {
  it('updates cycle name', async () => {
    const cycle = await createTestServiceCycle(businessId, token, [task1.id]);

    const res = await request(app)
      .put(`/api/businesses/${businessId}/service-cycles/${cycle.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Cycle' });

    expect(res.status).toBe(200);
    expect(res.body.serviceCycle.name).toBe('Renamed Cycle');
  });

  it('updates assigned tasks', async () => {
    const cycle = await createTestServiceCycle(businessId, token, [task1.id]);

    const res = await request(app)
      .put(`/api/businesses/${businessId}/service-cycles/${cycle.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ taskIds: [task2.id] });

    expect(res.status).toBe(200);
    expect(res.body.serviceCycle.assignedTasks).toEqual([task2.id]);
  });

  it('returns 404 for non-existent cycle', async () => {
    const res = await request(app)
      .put(`/api/businesses/${businessId}/service-cycles/99999`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});
