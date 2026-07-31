const request = require('supertest');
const app = require('../app');
const knex = require('../db');

// ─── DB LIFECYCLE ─────────────────────────────────────────────────────────────

async function truncateAllTables() {
  await knex.raw(`
    TRUNCATE TABLE
      otp_codes,
      messages,
      review_tokens,
      geofence_events,
      job_costs,
      feedbacks,
      service_completions,
      service_assignments,
      selections,
      selection_cycles,
      service_tasks,
      customer_services,
      template_tasks,
      service_templates,
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

// Phase 2: tasks are owned per-template/per-service (no global tasks table).
// A template's menu is passed inline as [{ name, timeAllotmentMinutes }].
async function createTestServiceCycle(businessId, token, tasks = [], overrides = {}) {
  const data = {
    name: overrides.name || 'Weekly Cleaning',
    frequency: overrides.frequency || 'weekly',
    daysBeforeServiceDeadline: overrides.daysBeforeServiceDeadline ?? 3,
    daysBeforeAutoRepeat: overrides.daysBeforeAutoRepeat ?? 1,
    tasks
  };

  const res = await request(app)
    .post(`/api/businesses/${businessId}/service-templates`)
    .set('Authorization', `Bearer ${token}`)
    .send(data);

  return res.body.serviceTemplate;
}

// Resolve the owned service_tasks rows for a customer's (first) Service — the
// canonical task ids selections must reference. Returns [{ id, name, timeAllotmentMinutes }].
async function getServiceTasksForCustomer(customerId) {
  const svc = await knex('customer_services').where('customer_id', customerId).orderBy('id').first();
  if (!svc) return [];
  const rows = await knex('service_tasks').where('customer_service_id', svc.id).orderBy('id', 'asc');
  return rows.map(r => ({ id: r.id, name: r.name, timeAllotmentMinutes: r.time_allotment_minutes }));
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

// Creates a per-customer Service seeded from a template (serviceCycleId = templateId).
// Returns the created customer_services row (res.body.service).
async function assignCycleToCustomer(businessId, customerId, serviceCycleId, token, totalHours = 3) {
  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const res = await request(app)
    .post(`/api/businesses/${businessId}/customers/${customerId}/services`)
    .set('Authorization', `Bearer ${token}`)
    .send({ templateId: serviceCycleId, totalHours, startDate });

  return res.body.service;
}

module.exports = {
  app,
  knex,
  truncateAllTables,
  createTestBusiness,
  createTestCustomer,
  createTestServiceCycle,
  getServiceTasksForCustomer,
  addCustomerToBusiness,
  assignCycleToCustomer
};
