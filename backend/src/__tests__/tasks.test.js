const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestTask, createTestServiceCycle
} = require('./helpers');

let businessId, token, otherToken;

beforeEach(async () => {
  await truncateAllTables();
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  token = biz.token;
  const other = await createTestBusiness();
  otherToken = other.token;
});
afterAll(async () => { await knex.destroy(); });

// ─── CREATE TASK ──────────────────────────────────────────────────────────────

describe('POST /api/businesses/:businessId/tasks', () => {
  it('creates a task and returns correct shape', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vacuum living room', timeAllotmentMinutes: 20 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.task.name).toBe('Vacuum living room');
    expect(res.body.task.timeAllotmentMinutes).toBe(20);
    expect(res.body.task.businessId).toBe(businessId);
    expect(res.body.task.isOptional).toBe(true);
    expect(res.body.task.id).toBeDefined();
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ timeAllotmentMinutes: 20 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when timeAllotmentMinutes is missing', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vacuum' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/tasks`)
      .send({ name: 'Vacuum', timeAllotmentMinutes: 20 });

    expect(res.status).toBe(401);
  });

  it('returns 403 with another business token', async () => {
    const res = await request(app)
      .post(`/api/businesses/${businessId}/tasks`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Vacuum', timeAllotmentMinutes: 20 });

    expect(res.status).toBe(403);
  });
});

// ─── GET TASKS ────────────────────────────────────────────────────────────────

describe('GET /api/businesses/:businessId/tasks', () => {
  it('returns all tasks for the business', async () => {
    await createTestTask(businessId, token, { name: 'Task A', timeAllotmentMinutes: 15 });
    await createTestTask(businessId, token, { name: 'Task B', timeAllotmentMinutes: 30 });

    const res = await request(app)
      .get(`/api/businesses/${businessId}/tasks`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('returns empty array when no tasks', async () => {
    const res = await request(app)
      .get(`/api/businesses/${businessId}/tasks`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(0);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get(`/api/businesses/${businessId}/tasks`);
    expect(res.status).toBe(401);
  });
});

// ─── UPDATE TASK ──────────────────────────────────────────────────────────────

describe('PUT /api/businesses/:businessId/tasks/:taskId', () => {
  it('updates task name and time', async () => {
    const task = await createTestTask(businessId, token);

    const res = await request(app)
      .put(`/api/businesses/${businessId}/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vacuum + hallway', timeAllotmentMinutes: 25 });

    expect(res.status).toBe(200);
    expect(res.body.task.name).toBe('Vacuum + hallway');
    expect(res.body.task.timeAllotmentMinutes).toBe(25);
  });

  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .put(`/api/businesses/${businessId}/tasks/99999`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
  });

  it('returns 403 for task belonging to another business', async () => {
    const task = await createTestTask(businessId, token);
    const other = await createTestBusiness();

    const res = await request(app)
      .put(`/api/businesses/${other.business.id}/tasks/${task.id}`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ name: 'Stolen' });

    expect(res.status).toBe(404);
  });
});

// ─── DELETE TASK ──────────────────────────────────────────────────────────────

describe('DELETE /api/businesses/:businessId/tasks/:taskId', () => {
  it('deletes a task successfully', async () => {
    const task = await createTestTask(businessId, token);

    const res = await request(app)
      .delete(`/api/businesses/${businessId}/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .delete(`/api/businesses/${businessId}/tasks/99999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 409 when task is assigned to a service cycle', async () => {
    const task = await createTestTask(businessId, token);
    await createTestServiceCycle(businessId, token, [task.id]);

    const res = await request(app)
      .delete(`/api/businesses/${businessId}/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TASK_IN_USE');
  });
});
