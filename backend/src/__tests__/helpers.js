const request = require('supertest');
const app = require('../app');
const knex = require('../db');

// ─── DB LIFECYCLE ─────────────────────────────────────────────────────────────

async function truncateAllTables() {
  await knex.raw(`
    TRUNCATE TABLE
      service_completions,
      selections,
      selection_cycles,
      customer_cycle_assignments,
      task_assignments,
      service_cycles,
      tasks,
      customers,
      businesses
    RESTART IDENTITY CASCADE
  `);
}

// ─── TEST FACTORIES ───────────────────────────────────────────────────────────

let businessCounter = 1;
let customerCounter = 1;

async function createTestBusiness(overrides = {}) {
  const data = {
    name: overrides.name || `Test Business ${businessCounter}`,
    phoneNumber: overrides.phoneNumber || `+1555000${String(businessCounter).padStart(4, '0')}`
  };
  businessCounter++;

  const res = await request(app)
    .post('/api/auth/businesses/signup')
    .send(data);

  return { business: res.body.business, token: res.body.token };
}

async function createTestCustomer(businessId, overrides = {}) {
  const data = {
    phoneNumber: overrides.phoneNumber || `+1444000${String(customerCounter).padStart(4, '0')}`,
    businessId
  };
  customerCounter++;

  const res = await request(app)
    .post('/api/auth/customers/signup')
    .send(data);

  return { customer: res.body.customer, token: res.body.token };
}

async function createTestTask(businessId, token, overrides = {}) {
  const data = {
    name: overrides.name || 'Vacuum living room',
    timeAllotmentMinutes: overrides.timeAllotmentMinutes || 20
  };

  const res = await request(app)
    .post(`/api/businesses/${businessId}/tasks`)
    .set('Authorization', `Bearer ${token}`)
    .send(data);

  return res.body.task;
}

async function createTestServiceCycle(businessId, token, taskIds = [], overrides = {}) {
  const data = {
    name: overrides.name || 'Weekly Cleaning',
    frequency: overrides.frequency || 'weekly',
    daysBeforeServiceDeadline: overrides.daysBeforeServiceDeadline ?? 3,
    daysBeforeAutoRepeat: overrides.daysBeforeAutoRepeat ?? 1,
    taskIds
  };

  const res = await request(app)
    .post(`/api/businesses/${businessId}/service-cycles`)
    .set('Authorization', `Bearer ${token}`)
    .send(data);

  return res.body.serviceCycle;
}

async function addCustomerToBusiness(businessId, token, overrides = {}) {
  const data = {
    name: overrides.name || 'Alice Smith',
    phoneNumber: overrides.phoneNumber || `+1333000${String(customerCounter).padStart(4, '0')}`
  };
  customerCounter++;

  const res = await request(app)
    .post(`/api/businesses/${businessId}/customers`)
    .set('Authorization', `Bearer ${token}`)
    .send(data);

  return res.body.customer;
}

async function assignCycleToCustomer(businessId, customerId, serviceCycleId, token, totalHours = 3) {
  const res = await request(app)
    .post(`/api/businesses/${businessId}/customers/${customerId}/assign-cycle`)
    .set('Authorization', `Bearer ${token}`)
    .send({ serviceCycleId, totalHours });

  return res.body.assignment;
}

module.exports = {
  app,
  knex,
  truncateAllTables,
  createTestBusiness,
  createTestCustomer,
  createTestTask,
  createTestServiceCycle,
  addCustomerToBusiness,
  assignCycleToCustomer
};
