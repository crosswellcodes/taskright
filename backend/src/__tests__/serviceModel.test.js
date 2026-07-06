const request = require('supertest');
const {
  app, knex, truncateAllTables,
  createTestBusiness, createTestTask, createTestServiceCycle, addCustomerToBusiness,
} = require('./helpers');

// Per-customer Service model (SERVICE_MODEL.md Component 1). Services are built
// directly on the customer profile; a template only seeds initial values.

let businessId, bizToken, customerId, task1, task2;

beforeAll(async () => {
  await truncateAllTables();
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  bizToken = biz.token;
  task1 = await createTestTask(businessId, bizToken, { name: 'Mow', timeAllotmentMinutes: 60 });
  task2 = await createTestTask(businessId, bizToken, { name: 'Edge', timeAllotmentMinutes: 30 });
  const customer = await addCustomerToBusiness(businessId, bizToken, { name: 'Alice', phoneNumber: '+13330009000' });
  customerId = customer.id;
});
afterAll(async () => { await knex.destroy(); });

const auth = (req) => req.set('Authorization', `Bearer ${bizToken}`);
const futureDate = (days) => new Date(Date.now() + days * 864e5).toISOString().split('T')[0];

describe('POST /customers/:id/services — create from scratch', () => {
  it('creates a Service, its own task menu, and generates Service Calls', async () => {
    const res = await auth(request(app).post(`/api/businesses/${businessId}/customers/${customerId}/services`))
      .send({
        name: 'Alice Weekly', frequency: 'weekly',
        daysBeforeServiceDeadline: 2, daysBeforeAutoRepeat: 1,
        taskIds: [task1.id, task2.id], totalHours: 3, startDate: futureDate(7),
      });
    expect(res.status).toBe(201);
    const serviceId = res.body.service.id;
    expect(res.body.service.name).toBe('Alice Weekly');
    expect(res.body.service.template_id).toBeNull();

    const menu = await knex('service_task_assignments').where('customer_service_id', serviceId);
    expect(menu.map(m => m.task_id).sort()).toEqual([task1.id, task2.id].sort());

    const calls = await knex('selection_cycles').where('customer_service_id', serviceId);
    expect(calls.length).toBe(4);
  });

  it('rejects a missing name / bad frequency / non-positive hours', async () => {
    const bad1 = await auth(request(app).post(`/api/businesses/${businessId}/customers/${customerId}/services`))
      .send({ frequency: 'weekly', totalHours: 2, startDate: futureDate(7) });
    expect(bad1.status).toBe(400);
    const bad2 = await auth(request(app).post(`/api/businesses/${businessId}/customers/${customerId}/services`))
      .send({ name: 'X', frequency: 'hourly', totalHours: 2, startDate: futureDate(7) });
    expect(bad2.status).toBe(400);
    const bad3 = await auth(request(app).post(`/api/businesses/${businessId}/customers/${customerId}/services`))
      .send({ name: 'X', frequency: 'weekly', totalHours: 0, startDate: futureDate(7) });
    expect(bad3.status).toBe(400);
  });

  it('allows multiple Services on one customer', async () => {
    const res = await auth(request(app).post(`/api/businesses/${businessId}/customers/${customerId}/services`))
      .send({ name: 'Alice Monthly', frequency: 'monthly', taskIds: [task1.id], totalHours: 5, startDate: futureDate(10) });
    expect(res.status).toBe(201);
    const services = await knex('customer_services').where('customer_id', customerId);
    expect(services.length).toBeGreaterThanOrEqual(2);
  });
});

describe('POST /customers/:id/services — seed from template', () => {
  it('copies template definition + menu, with overrides, and stays decoupled', async () => {
    const template = await createTestServiceCycle(businessId, bizToken, [task1.id, task2.id], { name: 'Std Biweekly', frequency: 'biweekly' });
    const res = await auth(request(app).post(`/api/businesses/${businessId}/customers/${customerId}/services`))
      .send({ templateId: template.id, name: 'Alice From Template', totalHours: 4, startDate: futureDate(14) });
    expect(res.status).toBe(201);
    const svc = res.body.service;
    expect(svc.template_id).toBe(template.id); // provenance only
    expect(svc.name).toBe('Alice From Template');   // override applied
    expect(svc.frequency).toBe('biweekly');         // seeded from template

    const menu = await knex('service_task_assignments').where('customer_service_id', svc.id);
    expect(menu.length).toBe(2);

    // Decoupled: editing the template does not touch the Service's menu.
    await auth(request(app).put(`/api/businesses/${businessId}/service-cycles/${template.id}`))
      .send({ taskIds: [] });
    const menuAfter = await knex('service_task_assignments').where('customer_service_id', svc.id);
    expect(menuAfter.length).toBe(2);
  });

  it('404s on an unknown template', async () => {
    const res = await auth(request(app).post(`/api/businesses/${businessId}/customers/${customerId}/services`))
      .send({ templateId: 999999, name: 'X', totalHours: 2, startDate: futureDate(7) });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /customers/:id/services/:serviceId — definition-only', () => {
  let serviceId;
  beforeAll(async () => {
    const res = await auth(request(app).post(`/api/businesses/${businessId}/customers/${customerId}/services`))
      .send({ name: 'Editable', frequency: 'weekly', daysBeforeServiceDeadline: 3, taskIds: [task1.id], totalHours: 3, startDate: futureDate(7) });
    serviceId = res.body.service.id;
  });

  it('updates name, tasks and hours without deleting Service Calls', async () => {
    const before = await knex('selection_cycles').where('customer_service_id', serviceId);
    const res = await auth(request(app).patch(`/api/businesses/${businessId}/customers/${customerId}/services/${serviceId}`))
      .send({ name: 'Renamed', taskIds: [task1.id, task2.id], totalHours: 6 });
    expect(res.status).toBe(200);
    expect(res.body.service.name).toBe('Renamed');
    expect(Number(res.body.service.total_hours)).toBe(6);

    const menu = await knex('service_task_assignments').where('customer_service_id', serviceId);
    expect(menu.length).toBe(2);
    const after = await knex('selection_cycles').where('customer_service_id', serviceId);
    expect(after.length).toBe(before.length); // no regeneration/deletion
  });

  it('recomputes open Service Calls\' submission_deadline on a deadline change', async () => {
    await auth(request(app).patch(`/api/businesses/${businessId}/customers/${customerId}/services/${serviceId}`))
      .send({ daysBeforeServiceDeadline: 5 });
    const calls = await knex('selection_cycles').where('customer_service_id', serviceId).where('status', 'open');
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      const sd = new Date(new Date(c.service_date).toISOString().split('T')[0] + 'T00:00:00Z');
      const dl = new Date(new Date(c.submission_deadline).toISOString().split('T')[0] + 'T00:00:00Z');
      expect(Math.round((sd - dl) / 864e5)).toBe(5);
    }
  });
});

describe('DELETE /customers/:id/services/:serviceId', () => {
  it('deletes a Service with only open calls', async () => {
    const res = await auth(request(app).post(`/api/businesses/${businessId}/customers/${customerId}/services`))
      .send({ name: 'Deletable', frequency: 'weekly', taskIds: [task1.id], totalHours: 2, startDate: futureDate(7) });
    const serviceId = res.body.service.id;
    const del = await auth(request(app).delete(`/api/businesses/${businessId}/customers/${customerId}/services/${serviceId}`));
    expect(del.status).toBe(200);
    const gone = await knex('customer_services').where('id', serviceId).first();
    expect(gone).toBeUndefined();
    const calls = await knex('selection_cycles').where('customer_service_id', serviceId);
    expect(calls.length).toBe(0); // cascaded
  });

  it('refuses (409) when a Service Call is completed', async () => {
    const res = await auth(request(app).post(`/api/businesses/${businessId}/customers/${customerId}/services`))
      .send({ name: 'HasHistory', frequency: 'weekly', taskIds: [task1.id], totalHours: 2, startDate: futureDate(7) });
    const serviceId = res.body.service.id;
    const call = await knex('selection_cycles').where('customer_service_id', serviceId).first();
    await knex('selection_cycles').where('id', call.id).update({ status: 'completed' });

    const del = await auth(request(app).delete(`/api/businesses/${businessId}/customers/${customerId}/services/${serviceId}`));
    expect(del.status).toBe(409);
    expect(del.body.code).toBe('HAS_HISTORY');
  });
});

describe('ownership', () => {
  it('404s creating a Service on another business\'s customer', async () => {
    const other = await createTestBusiness();
    const res = await request(app)
      .post(`/api/businesses/${other.business.id}/customers/${customerId}/services`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ name: 'X', frequency: 'weekly', totalHours: 2, startDate: futureDate(7) });
    expect(res.status).toBe(404);
  });
});
