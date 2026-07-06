const request = require('supertest');
const app = require('../app');
const knex = require('../db');

// ─── DB LIFECYCLE ─────────────────────────────────────────────────────────────

async function truncateAllTables() {
  await knex.raw(`
    TRUNCATE TABLE
      messages,
      review_tokens,
      geofence_events,
      job_costs,
      feedbacks,
      service_completions,
      service_assignments,
      selections,
      selection_cycles,
      service_task_assignments,
      customer_services,
      template_task_assignments,
      service_templates,
      tasks,
      team_memberships,
      team_members,
      teams,
      customers,
      businesses
    RESTART IDENTITY CASCADE
  `);

  // cost_categories FK-references businesses, so TRUNCATE ... CASCADE above wipes
  // the migration's seeded GAAP system rows. Restore them so job-costing logic
  // (labor category lookup, etc.) has its system defaults.
  const seeded = await knex('cost_categories').whereNull('business_id').first();
  if (!seeded) {
    await knex('cost_categories').insert([
      { business_id: null, code: 4000, name: 'Service Revenue',      type: 'revenue',   is_system: true },
      { business_id: null, code: 5000, name: 'Direct Labor',         type: 'labor',     is_system: true },
      { business_id: null, code: 5100, name: 'Materials / Supplies', type: 'materials', is_system: true },
      { business_id: null, code: 5200, name: 'Job Overhead',         type: 'overhead',  is_system: true },
    ]);
  }
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
  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const res = await request(app)
    .post(`/api/businesses/${businessId}/customers/${customerId}/assign-cycle`)
    .set('Authorization', `Bearer ${token}`)
    .send({ serviceCycleId, totalHours, startDate });

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
