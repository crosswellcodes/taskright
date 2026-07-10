const knex = require('../db');
const crypto = require('crypto');
const https = require('https');
const notificationService = require('./notificationService');

// ─── GEOCODING ───────────────────────────────────────────────────────────────

function geocodeAddress(customerId, address) {
  if (!address || !process.env.MAPBOX_ACCESS_TOKEN) return;
  const encoded = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${process.env.MAPBOX_ACCESS_TOKEN}&country=US&limit=1`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode !== 200) {
        // e.g. 401 expired token, 429 rate limit — body is HTML/error JSON, not
        // a geocoding result. Log the status + a snippet so the cause is visible.
        console.error(`Geocode HTTP ${res.statusCode} for customer ${customerId}:`, data.slice(0, 200));
        return;
      }
      try {
        const json = JSON.parse(data);
        const feature = json.features && json.features[0];
        if (!feature) return;
        const [lng, lat] = feature.center;
        knex('customers').where('id', customerId).update({
          lat,
          lng,
          geocoded_at: knex.raw('CURRENT_TIMESTAMP'),
        }).catch(e => console.error('Geocode DB update failed:', e.message));
      } catch (e) {
        console.error('Geocode parse failed:', e.message);
      }
    });
  }).on('error', e => console.error('Geocode request failed:', e.message));
}

// ─── AUTH / BUSINESS ACCOUNT ────────────────────────────────────────────────

function generateJoinCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Create a new business
 */
async function createBusiness(name, phoneNumber, schedulingFormat = 'date_based', entityType = 'sole_prop') {
  const existingBusiness = await knex('businesses')
    .where('phone_number', phoneNumber)
    .first();

  if (existingBusiness) {
    const error = new Error('Phone number already registered');
    error.code = 'DUPLICATE_PHONE';
    error.statusCode = 409;
    throw error;
  }

  // Generate a unique 6-char join code for customer invite links
  let joinCode;
  let collision = true;
  while (collision) {
    joinCode = generateJoinCode();
    const existing = await knex('businesses').where('join_code', joinCode).first();
    collision = !!existing;
  }

  const inserted = await knex('businesses')
    .insert({
      name: name.trim(),
      phone_number: phoneNumber,
      scheduling_format: schedulingFormat,
      entity_type: entityType,
      join_code: joinCode,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })
    .returning('*');

  return inserted[0];
}

async function getBusinessByJoinCode(joinCode) {
  return await knex('businesses')
    .where('join_code', joinCode.toUpperCase())
    .select('id', 'name', 'join_code')
    .first();
}

async function getBusinessById(id) {
  return await knex('businesses').where('id', id).first();
}

async function getBusinessByPhone(phoneNumber) {
  return await knex('businesses').where('phone_number', phoneNumber).first();
}

// ─── TASKS (owned, not global) ───────────────────────────────────────────────
// Phase 2 (SERVICE_TASK_OWNERSHIP.md): the global `tasks` table is retired.
// Tasks are now owned rows on `service_tasks` (per customer_services) and
// `template_tasks` (per service_templates). Shape at every boundary:
//   { id?, name, timeAllotmentMinutes }

// Normalize a service_tasks / template_tasks row to the API task shape.
function taskShape(row) {
  return { id: row.id, name: row.name, timeAllotmentMinutes: row.time_allotment_minutes };
}

// Validate an incoming task payload ({ id?, name, timeAllotmentMinutes }[]).
function validateTasks(tasks) {
  if (tasks === undefined) return;
  if (!Array.isArray(tasks)) {
    throw Object.assign(new Error('tasks must be an array'), { code: 'VALIDATION_ERROR', statusCode: 400 });
  }
  for (const t of tasks) {
    if (!t || typeof t.name !== 'string' || !t.name.trim()) {
      throw Object.assign(new Error('each task requires a non-empty name'), { code: 'VALIDATION_ERROR', statusCode: 400 });
    }
    if (typeof t.timeAllotmentMinutes !== 'number' || t.timeAllotmentMinutes < 0) {
      throw Object.assign(new Error('each task requires a non-negative timeAllotmentMinutes'), { code: 'VALIDATION_ERROR', statusCode: 400 });
    }
  }
}

// ─── SERVICE TEMPLATES (business-global reusable library) ────────────────────
// Formerly "service cycles". These are decoupled templates you optionally seed a
// customer's Service from. Editing a template never touches existing services.

// Insert a template's task menu (owned template_tasks rows). Returns task shapes.
async function insertTemplateTasks(templateId, tasks) {
  if (!tasks || tasks.length === 0) return [];
  const rows = await knex('template_tasks')
    .insert(tasks.map(t => ({
      template_id: templateId,
      name: String(t.name).trim(),
      time_allotment_minutes: t.timeAllotmentMinutes,
      is_optional: true,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })))
    .returning('*');
  return rows.map(taskShape);
}

async function createServiceTemplate(businessId, name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, tasks = []) {
  validateTasks(tasks);

  const inserted = await knex('service_templates')
    .insert({
      business_id: businessId,
      name: name.trim(),
      frequency,
      days_before_service_deadline: daysBeforeServiceDeadline,
      days_before_auto_repeat: daysBeforeAutoRepeat,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })
    .returning('*');

  const cycle = inserted[0];
  const assignedTasks = await insertTemplateTasks(cycle.id, tasks);

  return { cycle, assignedTasks };
}

async function getServiceTemplatesByBusiness(businessId) {
  const cycles = await knex('service_templates')
    .where('business_id', businessId)
    .orderBy('created_at', 'asc');

  for (const cycle of cycles) {
    const rows = await knex('template_tasks').where('template_id', cycle.id).orderBy('id', 'asc');
    cycle.assignedTasks = rows.map(taskShape);
  }

  return cycles;
}

async function getServiceTemplateById(cycleId) {
  return await knex('service_templates').where('id', cycleId).first();
}

async function updateServiceTemplate(cycleId, data) {
  const updates = { updated_at: knex.raw('CURRENT_TIMESTAMP') };
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.frequency !== undefined) updates.frequency = data.frequency;
  if (data.daysBeforeServiceDeadline !== undefined) {
    updates.days_before_service_deadline = data.daysBeforeServiceDeadline;
  }
  if (data.daysBeforeAutoRepeat !== undefined) {
    updates.days_before_auto_repeat = data.daysBeforeAutoRepeat;
  }

  const updated = await knex('service_templates').where('id', cycleId).update(updates).returning('*');
  const cycle = updated[0];

  // Templates carry no live references (nothing keys off template_tasks.id), so a
  // wholesale replace is safe here — unlike service_tasks, which selections point at.
  if (data.tasks !== undefined) {
    validateTasks(data.tasks);
    await knex('template_tasks').where('template_id', cycleId).delete();
    cycle.assignedTasks = await insertTemplateTasks(cycleId, data.tasks);
  }

  return cycle;
}

async function deleteServiceTemplate(cycleId) {
  await knex('service_templates').where('id', cycleId).delete();
}

// ─── CUSTOMER MANAGEMENT ─────────────────────────────────────────────────────

async function deleteCustomer(customerId) {
  await knex('customers').where('id', customerId).delete();
}

async function addCustomer(businessId, name, phoneNumber) {
  const existing = await knex('customers')
    .where('business_id', businessId)
    .where('phone_number', phoneNumber)
    .first();

  if (existing) {
    const error = new Error('Customer with this phone already exists');
    error.code = 'DUPLICATE_CUSTOMER';
    error.statusCode = 409;
    throw error;
  }

  const inserted = await knex('customers')
    .insert({
      business_id: businessId,
      name: name.trim(),
      phone_number: phoneNumber,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })
    .returning('*');

  const customer = inserted[0];

  // No geocoding here: addCustomer never inserts an address, so customer.address
  // is always null. Geocoding fires from updateCustomerDetails() when an address
  // is actually set.

  return customer;
}

async function getCustomersByBusiness(businessId) {
  const customers = await knex('customers')
    .where('business_id', businessId)
    .orderBy('created_at', 'asc');

  for (const customer of customers) {
    // A customer's Services are now self-describing (definition lives on the row).
    const services = await knex('customer_services as cs')
      .where('cs.customer_id', customer.id)
      .select('cs.id', 'cs.name', 'cs.frequency', 'cs.total_hours');

    customer.assignedCycles = services.map(a => ({
      id: a.id,
      name: a.name,
      frequency: a.frequency,
      totalHours: a.total_hours == null ? null : Number(a.total_hours)
    }));
  }

  return customers;
}

async function getCustomerDetails(customerId) {
  const customer = await knex('customers').where('id', customerId).first();
  if (!customer) return null;

  const services = await knex('customer_services as cs')
    .where('cs.customer_id', customerId)
    .select('cs.id', 'cs.name', 'cs.frequency', 'cs.total_hours',
            'cs.template_id', 'cs.price_per_visit');

  customer.assignedCycles = services.map(a => ({
    id: a.id,
    serviceCycleId: a.id,          // the Service row id (self-contained definition)
    templateId: a.template_id,     // provenance only (nullable, decoupled)
    serviceCycleName: a.name,
    frequency: a.frequency,
    totalHours: a.total_hours == null ? null : Number(a.total_hours),
    // Job costing: the Service row id doubles as the "assignment" id so the
    // CustomerDetailScreen can PATCH .../assignments/:assignmentId (D2 source).
    assignmentId: a.id,
    pricePerVisit: a.price_per_visit
  }));

  const upcomingServiceRows = await knex('selection_cycles')
    .where('customer_id', customerId)
    .where('status', 'open')
    .orderBy('service_date', 'asc')
    .limit(5);

  const upcomingServices = [];
  for (const s of upcomingServiceRows) {
    const cycle = s.customer_service_id
      ? await knex('customer_services').where('id', s.customer_service_id).first()
      : null;
    upcomingServices.push({
      id: s.id,
      serviceCycleName: cycle ? cycle.name : null,
      serviceDate: s.service_date,
      submissionDeadline: s.submission_deadline,
      status: s.status
    });
  }
  customer.upcomingServices = upcomingServices;

  const lastSelection = await knex('selections')
    .where('customer_id', customerId)
    .where('status', 'submitted')
    .orderBy('submitted_at', 'desc')
    .first();

  customer.lastSelection = lastSelection ? {
    selectedTasks: lastSelection.selected_tasks,
    selectedTotalHours: lastSelection.selected_total_hours == null ? null : Number(lastSelection.selected_total_hours),
    submittedAt: lastSelection.submitted_at
  } : null;

  customer.email = customer.email || null;
  customer.address = customer.address || null;
  customer.notes = customer.notes || null;

  return customer;
}

async function updateCustomerDetails(customerId, data) {
  const updates = { updated_at: knex.raw('CURRENT_TIMESTAMP') };
  if (data.email !== undefined) updates.email = data.email || null;
  if (data.address !== undefined) updates.address = data.address || null;
  if (data.notes !== undefined) updates.notes = data.notes || null;
  if (data.reviewRequestsOptedOut !== undefined) updates.review_requests_opted_out = !!data.reviewRequestsOptedOut;
  const updated = await knex('customers').where('id', customerId).update(updates).returning('*');
  const customer = updated[0];

  // Re-geocode fire-and-forget whenever address changes
  if (data.address !== undefined && data.address) {
    geocodeAddress(customerId, data.address);
  }

  return customer;
}

// ─── CYCLE ASSIGNMENT ────────────────────────────────────────────────────────

// Create a per-customer Service. The definition (name/frequency/deadlines/tasks)
// lives on the row itself; `templateId` is provenance only (nullable, decoupled).
// Copies the given task list into the Service's own menu, generates the upcoming
// Service Calls, and fires the welcome SMS. Wrapped by createCustomerServiceForBusiness
// (from-scratch or template-seeded).
// Insert a Service's task menu (owned service_tasks rows). Returns task shapes.
async function insertServiceTasks(serviceId, tasks) {
  if (!tasks || tasks.length === 0) return [];
  const rows = await knex('service_tasks')
    .insert(tasks.map(t => ({
      customer_service_id: serviceId,
      name: String(t.name).trim(),
      time_allotment_minutes: t.timeAllotmentMinutes,
      is_optional: true,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })))
    .returning('*');
  return rows.map(taskShape);
}

// Diff-upsert a Service's task menu WITHOUT churning ids (SERVICE_TASK_OWNERSHIP §2.2).
// selections.selected_tasks references service_tasks.id, so a wholesale delete+
// reinsert would orphan live selections. Instead:
//   item with a valid existing id → UPDATE in place
//   item without id (or with a foreign id) → INSERT
//   existing row absent from payload → DELETE
async function diffUpsertServiceTasks(serviceId, tasks) {
  const existing = await knex('service_tasks')
    .where('customer_service_id', serviceId).select('id');
  const existingIds = new Set(existing.map(r => r.id));
  const keepIds = new Set();

  for (const t of tasks) {
    const name = String(t.name).trim();
    if (t.id != null && existingIds.has(t.id)) {
      await knex('service_tasks')
        .where('id', t.id).where('customer_service_id', serviceId)
        .update({
          name,
          time_allotment_minutes: t.timeAllotmentMinutes,
          updated_at: knex.raw('CURRENT_TIMESTAMP')
        });
      keepIds.add(t.id);
    } else {
      const [row] = await knex('service_tasks')
        .insert({
          customer_service_id: serviceId,
          name,
          time_allotment_minutes: t.timeAllotmentMinutes,
          is_optional: true,
          created_at: knex.raw('CURRENT_TIMESTAMP'),
          updated_at: knex.raw('CURRENT_TIMESTAMP')
        })
        .returning('id');
      keepIds.add(row.id);
    }
  }

  const toDelete = [...existingIds].filter(id => !keepIds.has(id));
  if (toDelete.length > 0) {
    await knex('service_tasks').whereIn('id', toDelete).delete();
  }
}

async function createCustomerService(customerId, {
  templateId = null, name, frequency,
  daysBeforeServiceDeadline, daysBeforeAutoRepeat,
  tasks = [], totalHours, startDate = null, dayOfWeek = null, pricePerVisit = null,
}) {
  const [service] = await knex('customer_services')
    .insert({
      customer_id: customerId,
      template_id: templateId,
      name: name.trim(),
      frequency,
      days_before_service_deadline: daysBeforeServiceDeadline,
      days_before_auto_repeat: daysBeforeAutoRepeat,
      total_hours: totalHours,
      price_per_visit: pricePerVisit,
      start_date: startDate,
      day_of_week: dayOfWeek,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })
    .returning('*');

  await insertServiceTasks(service.id, tasks);

  await generateUpcomingSelectionCycles(customerId, service, startDate, dayOfWeek);

  // Fire-and-forget: welcome SMS — don't block creation on notification success
  (async () => {
    try {
      const customer = await knex('customers').where('id', customerId).first();
      const [business, firstCycle] = await Promise.all([
        knex('businesses').where('id', customer.business_id).first(),
        knex('selection_cycles')
          .where('customer_service_id', service.id)
          .orderBy('service_date', 'asc')
          .first()
      ]);
      const firstServiceDate = firstCycle ? new Date(firstCycle.service_date).toISOString().split('T')[0] : null;
      await notificationService.sendWelcomeNotification(business, customer.phone_number, business.name, firstServiceDate);
    } catch (e) {
      console.error('Welcome SMS failed:', e.message);
    }
  })();

  return service;
}

// ─── PER-CUSTOMER SERVICE CRUD (customer-profile creation flow) ──────────────
// 'one_time' is an ad-hoc single-visit sale — generates exactly one Service Call
// (see generateUpcomingSelectionCycles) and never recurs.
const VALID_FREQUENCIES = ['one_time', 'weekly', 'biweekly', 'monthly', 'yearly'];

// Resolve a Service belonging to this business (via the customer) or throw 404.
async function getOwnedCustomerService(businessId, serviceId) {
  const svc = await knex('customer_services as cs')
    .join('customers as c', 'cs.customer_id', 'c.id')
    .where('cs.id', serviceId)
    .where('c.business_id', businessId)
    .select('cs.*')
    .first();
  if (!svc) {
    throw Object.assign(new Error('Service not found'), { code: 'NOT_FOUND', statusCode: 404 });
  }
  return svc;
}

// Build a per-customer Service directly on the profile. Optionally seed defaults
// from a template (templateId); any explicitly-provided field overrides the seed.
// Decoupled after creation — the template's tasks are COPIED into this Service's
// own service_tasks (no live link back).
async function createCustomerServiceForBusiness(businessId, customerId, input = {}) {
  let seed = {};
  let templateId = null;
  if (input.templateId != null) {
    const template = await knex('service_templates')
      .where('id', input.templateId).where('business_id', businessId).first();
    if (!template) {
      throw Object.assign(new Error('Service template not found'), { code: 'TEMPLATE_NOT_FOUND', statusCode: 404 });
    }
    templateId = template.id;
    const tTasks = await knex('template_tasks').where('template_id', template.id).orderBy('id', 'asc');
    seed = {
      name: template.name,
      frequency: template.frequency,
      daysBeforeServiceDeadline: template.days_before_service_deadline,
      daysBeforeAutoRepeat: template.days_before_auto_repeat,
      // Copy-on-instantiate: drop template_tasks ids so these become fresh service_tasks.
      tasks: tTasks.map(r => ({ name: r.name, timeAllotmentMinutes: r.time_allotment_minutes })),
    };
  }

  const name = input.name != null ? input.name : seed.name;
  const frequency = input.frequency != null ? input.frequency : seed.frequency;
  const daysBeforeServiceDeadline = input.daysBeforeServiceDeadline != null
    ? input.daysBeforeServiceDeadline : (seed.daysBeforeServiceDeadline != null ? seed.daysBeforeServiceDeadline : 3);
  const daysBeforeAutoRepeat = input.daysBeforeAutoRepeat != null
    ? input.daysBeforeAutoRepeat : (seed.daysBeforeAutoRepeat != null ? seed.daysBeforeAutoRepeat : 1);
  const tasks = input.tasks != null ? input.tasks : (seed.tasks || []);
  const totalHours = input.totalHours;

  if (!name || !String(name).trim()) {
    throw Object.assign(new Error('name is required'), { code: 'VALIDATION_ERROR', statusCode: 400 });
  }
  if (!VALID_FREQUENCIES.includes(frequency)) {
    throw Object.assign(new Error('frequency must be one of weekly|biweekly|monthly|yearly'), { code: 'VALIDATION_ERROR', statusCode: 400 });
  }
  if (typeof totalHours !== 'number' || totalHours <= 0) {
    throw Object.assign(new Error('totalHours is required and must be a positive number'), { code: 'VALIDATION_ERROR', statusCode: 400 });
  }
  validateTasks(tasks);

  return createCustomerService(customerId, {
    templateId,
    name,
    frequency,
    daysBeforeServiceDeadline,
    daysBeforeAutoRepeat,
    tasks,
    totalHours,
    startDate: input.startDate != null ? input.startDate : null,
    dayOfWeek: input.dayOfWeek != null ? input.dayOfWeek : null,
    pricePerVisit: input.pricePerVisit != null ? input.pricePerVisit : null,
  });
}

// Definition-only edit (C1 decision). Never regenerates or deletes Service Calls.
// A deadline change recomputes submission_deadline on OPEN calls (cheap, safe).
async function updateCustomerService(businessId, serviceId, data = {}) {
  const svc = await getOwnedCustomerService(businessId, serviceId);

  const updates = { updated_at: knex.raw('CURRENT_TIMESTAMP') };
  if (data.name !== undefined) {
    if (!data.name || !String(data.name).trim()) {
      throw Object.assign(new Error('name cannot be empty'), { code: 'VALIDATION_ERROR', statusCode: 400 });
    }
    updates.name = String(data.name).trim();
  }
  if (data.frequency !== undefined) {
    if (!VALID_FREQUENCIES.includes(data.frequency)) {
      throw Object.assign(new Error('frequency must be one of weekly|biweekly|monthly|yearly'), { code: 'VALIDATION_ERROR', statusCode: 400 });
    }
    updates.frequency = data.frequency;
  }
  if (data.totalHours !== undefined) {
    if (typeof data.totalHours !== 'number' || data.totalHours <= 0) {
      throw Object.assign(new Error('totalHours must be a positive number'), { code: 'VALIDATION_ERROR', statusCode: 400 });
    }
    updates.total_hours = data.totalHours;
  }
  if (data.pricePerVisit !== undefined) updates.price_per_visit = data.pricePerVisit;
  if (data.daysBeforeServiceDeadline !== undefined) updates.days_before_service_deadline = data.daysBeforeServiceDeadline;
  if (data.daysBeforeAutoRepeat !== undefined) updates.days_before_auto_repeat = data.daysBeforeAutoRepeat;
  if (data.startDate !== undefined) updates.start_date = data.startDate;
  if (data.dayOfWeek !== undefined) updates.day_of_week = data.dayOfWeek;

  const [updated] = await knex('customer_services').where('id', serviceId).update(updates).returning('*');

  if (data.tasks !== undefined) {
    validateTasks(data.tasks);
    await diffUpsertServiceTasks(serviceId, data.tasks);
  }

  // Deadline change → recompute submission_deadline on OPEN calls only.
  if (data.daysBeforeServiceDeadline !== undefined
      && data.daysBeforeServiceDeadline !== svc.days_before_service_deadline) {
    const openCalls = await knex('selection_cycles')
      .where('customer_service_id', serviceId).where('status', 'open');
    for (const call of openCalls) {
      // pg may return date columns as Date or string; normalize to YYYY-MM-DD first.
      const sdStr = new Date(call.service_date).toISOString().split('T')[0];
      const serviceMs = new Date(sdStr + 'T00:00:00Z').getTime();
      const deadline = new Date(serviceMs - data.daysBeforeServiceDeadline * 864e5)
        .toISOString().split('T')[0];
      await knex('selection_cycles').where('id', call.id)
        .update({ submission_deadline: deadline, updated_at: knex.raw('CURRENT_TIMESTAMP') });
    }
  }

  return updated;
}

// Delete a Service. Refuses if any of its Service Calls are completed (preserves
// job-costing / review history). Otherwise cascades away the open calls.
async function deleteCustomerService(businessId, serviceId) {
  await getOwnedCustomerService(businessId, serviceId);
  const completed = await knex('selection_cycles')
    .where('customer_service_id', serviceId).where('status', 'completed').first();
  if (completed) {
    throw Object.assign(
      new Error('Cannot delete a Service with completed Service Calls'),
      { code: 'HAS_HISTORY', statusCode: 409 }
    );
  }
  await knex('customer_services').where('id', serviceId).delete(); // cascades open calls + menu
}

// Full definition of one Service (for the C2 builder / edit view).
async function getCustomerServiceDetail(businessId, serviceId) {
  const svc = await getOwnedCustomerService(businessId, serviceId);
  const taskRows = await knex('service_tasks')
    .where('customer_service_id', serviceId).orderBy('id', 'asc');
  return {
    id: svc.id,
    customerId: svc.customer_id,
    templateId: svc.template_id,
    name: svc.name,
    frequency: svc.frequency,
    daysBeforeServiceDeadline: svc.days_before_service_deadline,
    daysBeforeAutoRepeat: svc.days_before_auto_repeat,
    totalHours: svc.total_hours == null ? null : Number(svc.total_hours),
    pricePerVisit: svc.price_per_visit,
    startDate: svc.start_date,
    dayOfWeek: svc.day_of_week,
    tasks: taskRows.map(taskShape),
  };
}

function addDays(date, n) {
  return new Date(date.getTime() + n * 24 * 60 * 60 * 1000);
}

async function generateUpcomingSelectionCycles(customerId, serviceCycle, startDate, dayOfWeek = null) {
  // `serviceCycle` is now the customer_services row (the Service itself), which
  // carries the definition + recurring price directly.
  // D2 (Business Rule 4): pre-fill each Service Call's price from the Service's
  // recurring price so job-costing margins aren't "Price not set" on first load.
  const pricePerVisit = serviceCycle.price_per_visit != null ? serviceCycle.price_per_visit : null;

  let currentDate;

  if (dayOfWeek !== null) {
    if (startDate) {
      // User picked a specific starting date from the inline calendar — honour it
      currentDate = new Date(startDate);
    } else {
      // No specific date chosen — default to the next occurrence of this weekday from tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const daysUntil = (dayOfWeek - tomorrow.getDay() + 7) % 7;
      currentDate = addDays(tomorrow, daysUntil);
    }
  } else {
    // Date-based format: start from the chosen date
    currentDate = new Date(startDate);
  }

  // Ad-hoc one-time sales get a single Service Call; recurring services get 4 upcoming.
  const callsToGenerate = serviceCycle.frequency === 'one_time' ? 1 : 4;

  for (let i = 0; i < callsToGenerate; i++) {
    const serviceDate = currentDate.toISOString().split('T')[0];
    const deadlineMs = currentDate.getTime() - serviceCycle.days_before_service_deadline * 24 * 60 * 60 * 1000;
    const submissionDeadline = new Date(deadlineMs).toISOString().split('T')[0];

    const existingCycle = await knex('selection_cycles')
      .where('customer_id', customerId)
      .where('customer_service_id', serviceCycle.id)
      .where('service_date', serviceDate)
      .first();

    if (!existingCycle) {
      await knex('selection_cycles').insert({
        customer_service_id: serviceCycle.id,
        customer_id: customerId,
        service_date: serviceDate,
        submission_deadline: submissionDeadline,
        status: 'open',
        price: pricePerVisit,
        created_at: knex.raw('CURRENT_TIMESTAMP'),
        updated_at: knex.raw('CURRENT_TIMESTAMP')
      });
    }

    // Advance to next service date
    if (dayOfWeek !== null) {
      // Day-of-week: always advance by fixed day multiples to keep the same weekday
      if (serviceCycle.frequency === 'weekly')        currentDate = addDays(currentDate, 7);
      else if (serviceCycle.frequency === 'biweekly') currentDate = addDays(currentDate, 14);
      else if (serviceCycle.frequency === 'monthly')  currentDate = addDays(currentDate, 28);  // 4 weeks
      else if (serviceCycle.frequency === 'yearly')   currentDate = addDays(currentDate, 364); // 52 weeks
      else                                            currentDate = addDays(currentDate, 7);
    } else {
      // Date-based: use calendar month/year increments
      if (serviceCycle.frequency === 'weekly') {
        currentDate = addDays(currentDate, 7);
      } else if (serviceCycle.frequency === 'biweekly') {
        currentDate = addDays(currentDate, 14);
      } else if (serviceCycle.frequency === 'monthly') {
        currentDate = new Date(currentDate);
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (serviceCycle.frequency === 'yearly') {
        currentDate = new Date(currentDate);
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      } else {
        currentDate = addDays(currentDate, 7);
      }
    }
  }
}

// ─── UPCOMING SELECTIONS (business view) ─────────────────────────────────────

async function getUpcomingCustomerSelections(customerId) {
  const selectionCycle = await knex('selection_cycles')
    .where('customer_id', customerId)
    .where('status', 'open')
    .orderBy('service_date', 'asc')
    .first();

  if (!selectionCycle) return null;

  const serviceCycle = selectionCycle.customer_service_id
    ? await knex('customer_services').where('id', selectionCycle.customer_service_id).first()
    : null;

  const availableTasks = await knex('service_tasks')
    .where('customer_service_id', selectionCycle.customer_service_id)
    .orderBy('id', 'asc');

  const assignment = serviceCycle; // the Service row carries total_hours directly

  const currentSelection = await knex('selections')
    .where('selection_cycle_id', selectionCycle.id)
    .where('customer_id', customerId)
    .first();

  return {
    selectionCycleId: selectionCycle.id,
    customerId,
    serviceCycleName: serviceCycle ? serviceCycle.name : null,
    serviceDate: selectionCycle.service_date,
    submissionDeadline: selectionCycle.submission_deadline,
    status: selectionCycle.status,
    availableTasks: availableTasks.map(t => ({
      id: t.id,
      name: t.name,
      timeAllotmentMinutes: t.time_allotment_minutes
    })),
    totalHours: assignment ? Number(assignment.total_hours) : null,
    currentSelection: currentSelection ? {
      selectedTasks: currentSelection.selected_tasks,
      selectedTotalHours: currentSelection.selected_total_hours == null ? null : Number(currentSelection.selected_total_hours),
      status: currentSelection.status
    } : null
  };
}

// ─── FEEDBACK ────────────────────────────────────────────────────────────────

async function getLatestFeedbackForCustomer(businessId, customerId) {
  // Verify this customer belongs to this business
  const customer = await knex('customers')
    .where('id', customerId)
    .where('business_id', businessId)
    .first();
  if (!customer) return null;

  const row = await knex('feedbacks')
    .join('selection_cycles', 'feedbacks.selection_cycle_id', 'selection_cycles.id')
    .join('customers', 'selection_cycles.customer_id', 'customers.id')
    .where('feedbacks.customer_id', customerId)
    .where('customers.business_id', businessId)
    .where('selection_cycles.status', 'completed')
    .orderBy('selection_cycles.service_date', 'desc')
    .select(
      'feedbacks.id',
      'feedbacks.feedback_text',
      'feedbacks.photo_filenames',
      'feedbacks.business_notes',
      'selection_cycles.service_date',
      'feedbacks.created_at'
    )
    .first();

  if (!row) return null;

  return {
    id: row.id,
    feedbackText: row.feedback_text,
    photoFilenames: row.photo_filenames || [],
    businessNotes: row.business_notes || null,
    serviceDate: row.service_date,
    submittedAt: row.created_at,
  };
}

async function updateFeedbackBusinessNotes(feedbackId, businessId, notes) {
  // Verify this feedback belongs to the business
  const row = await knex('feedbacks')
    .join('selection_cycles', 'feedbacks.selection_cycle_id', 'selection_cycles.id')
    .join('customers', 'selection_cycles.customer_id', 'customers.id')
    .where('feedbacks.id', feedbackId)
    .where('customers.business_id', businessId)
    .select('feedbacks.id')
    .first();

  if (!row) {
    const err = new Error('Feedback not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  await knex('feedbacks')
    .where('id', feedbackId)
    .update({ business_notes: notes || null, updated_at: knex.raw('CURRENT_TIMESTAMP') });

  return { id: feedbackId, businessNotes: notes || null };
}

// ─── FORECAST ────────────────────────────────────────────────────────────────

async function getBusinessForecast(businessId) {
  const today = new Date();
  const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const todayStr = today.toISOString().split('T')[0];
  const thirtyDaysStr = thirtyDaysLater.toISOString().split('T')[0];

  const customers = await knex('customers').where('business_id', businessId);
  const customerIds = customers.map(c => c.id);

  if (customerIds.length === 0) {
    return { totalCustomers: 0, upcomingServices: [] };
  }

  const selectionCycles = await knex('selection_cycles')
    .whereIn('customer_id', customerIds)
    .where('service_date', '>=', todayStr)
    .where('service_date', '<=', thirtyDaysStr)
    .orderBy('service_date', 'asc');

  // Group by service_date, then by customer_service_id (the per-customer Service)
  const dateGrouped = {};
  for (const sc of selectionCycles) {
    // Normalize to plain YYYY-MM-DD string (pg returns date columns as Date objects)
    const dateKey = typeof sc.service_date === 'string'
      ? sc.service_date.split('T')[0]
      : sc.service_date.toISOString().split('T')[0];
    if (!dateGrouped[dateKey]) {
      dateGrouped[dateKey] = { serviceDate: sc.service_date, cycleGroups: {} };
    }
    if (!dateGrouped[dateKey].cycleGroups[sc.customer_service_id]) {
      dateGrouped[dateKey].cycleGroups[sc.customer_service_id] = {
        serviceCycleId: sc.customer_service_id,
        selectionCycles: [],
      };
    }
    dateGrouped[dateKey].cycleGroups[sc.customer_service_id].selectionCycles.push(sc);
  }

  const upcomingServices = [];
  for (const dateGroup of Object.values(dateGrouped)) {
    let totalSubmitted = 0;
    let totalPending = 0;
    let totalHours = 0;
    const serviceCycles = [];

    for (const cycleGroup of Object.values(dateGroup.cycleGroups)) {
      const serviceCycle = await knex('customer_services').where('id', cycleGroup.serviceCycleId).first();
      const cycleSelectionIds = cycleGroup.selectionCycles.map(sc => sc.id);
      const cycleCustomerIds = cycleGroup.selectionCycles.map(sc => sc.customer_id);

      const submissions = await knex('selections')
        .whereIn('selection_cycle_id', cycleSelectionIds)
        .where('status', 'submitted');

      const submittedCustomerIds = new Set(submissions.map(s => s.customer_id));

      const submitted = submissions.length;
      const pending = cycleGroup.selectionCycles.length - submitted;

      totalSubmitted += submitted;
      totalPending += pending;

      // Each Service carries its own hours; a Service belongs to one customer.
      totalHours += (parseFloat(serviceCycle && serviceCycle.total_hours) || 0);

      const pendingCustomers = customers
        .filter(c => cycleCustomerIds.includes(c.id) && !submittedCustomerIds.has(c.id))
        .map(c => {
          const sc = cycleGroup.selectionCycles.find(s => s.customer_id === c.id);
          return { id: c.id, name: c.name, selectionCycleId: sc ? sc.id : null };
        });

      const submittedCustomers = customers
        .filter(c => cycleCustomerIds.includes(c.id) && submittedCustomerIds.has(c.id))
        .map(c => {
          const sc = cycleGroup.selectionCycles.find(s => s.customer_id === c.id);
          return { id: c.id, name: c.name, selectionCycleId: sc ? sc.id : null };
        });

      serviceCycles.push({
        id: cycleGroup.serviceCycleId,
        name: serviceCycle ? serviceCycle.name : null,
        pendingCustomers,
        submittedCustomers,
      });
    }

    upcomingServices.push({
      serviceDate: dateGroup.serviceDate,
      customerSelectionsStatus: { submitted: totalSubmitted, pending: totalPending },
      totalHours,
      serviceCycles,
    });
  }

  return { totalCustomers: customers.length, upcomingServices };
}

// ─── SERVICE COMPLETION ──────────────────────────────────────────────────────

async function markServiceComplete(selectionCycleId, customerId, notes) {
  const existing = await knex('service_completions')
    .where('selection_cycle_id', selectionCycleId)
    .where('customer_id', customerId)
    .first();

  if (existing) {
    const error = new Error('Service already marked as complete');
    error.code = 'ALREADY_COMPLETED';
    error.statusCode = 409;
    throw error;
  }

  const inserted = await knex('service_completions')
    .insert({
      selection_cycle_id: selectionCycleId,
      customer_id: customerId,
      completed_at: knex.raw('CURRENT_TIMESTAMP'),
      notes: notes || null,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })
    .returning('*');

  await knex('selection_cycles')
    .where('id', selectionCycleId)
    .update({ status: 'completed', updated_at: knex.raw('CURRENT_TIMESTAMP') });

  // Fire-and-forget: completion SMS with next service date
  (async () => {
    try {
      const customer = await knex('customers').where('id', customerId).first();
      const [business, nextCycle] = await Promise.all([
        knex('businesses').where('id', customer.business_id).first(),
        knex('selection_cycles')
          .where('customer_id', customerId)
          .where('status', 'open')
          .orderBy('service_date', 'asc')
          .first()
      ]);
      const nextDate = nextCycle ? new Date(nextCycle.service_date).toISOString().split('T')[0] : null;
      const nextDeadline = nextCycle ? new Date(nextCycle.submission_deadline).toISOString().split('T')[0] : null;
      await notificationService.sendServiceCompletionNotification(business, customer.phone_number, nextDate, nextDeadline);
    } catch (e) {
      console.error('Completion SMS failed:', e.message);
    }
  })();

  return inserted[0];
}

// ─── TEAM MEMBERS ─────────────────────────────────────────────────────────────

function generateInviteCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function addTeamMember(businessId, name, phoneNumber, weeklyHours, hourlyRate = null) {
  const existing = await knex('team_members')
    .where('business_id', businessId)
    .where('phone_number', phoneNumber)
    .first();
  if (existing) {
    const error = new Error('Team member with this phone already exists');
    error.code = 'DUPLICATE_TEAM_MEMBER';
    error.statusCode = 409;
    throw error;
  }
  const inviteCode = generateInviteCode();
  const inserted = await knex('team_members')
    .insert({
      business_id: businessId,
      name: name.trim(),
      phone_number: phoneNumber,
      weekly_hours: weeklyHours,
      hourly_rate: hourlyRate,
      invite_code: inviteCode,
      invite_accepted: false,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    })
    .returning('*');
  return inserted[0];
}

async function getTeamMemberByPhone(phoneNumber) {
  return knex('team_members')
    .where('phone_number', phoneNumber)
    .first();
}

async function acceptTeamMemberInvite(phoneNumber, inviteCode) {
  const member = await knex('team_members')
    .where('phone_number', phoneNumber)
    .first();

  if (!member) {
    const err = new Error('No team member found with that phone number');
    err.code = 'TEAM_MEMBER_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  if (member.invite_accepted) {
    const err = new Error('Invite already accepted — please log in');
    err.code = 'INVITE_ALREADY_ACCEPTED';
    err.statusCode = 409;
    throw err;
  }
  if (member.invite_code !== inviteCode) {
    const err = new Error('Invalid invite code');
    err.code = 'INVALID_INVITE_CODE';
    err.statusCode = 401;
    throw err;
  }

  const [updated] = await knex('team_members')
    .where('id', member.id)
    .update({
      invite_accepted: true,
      invite_code: null,
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    })
    .returning('*');

  return updated;
}

async function getTeamMembersByBusiness(businessId) {
  return knex('team_members as m')
    .leftJoin('team_memberships as tm', 'm.id', 'tm.team_member_id')
    .leftJoin('teams as t', 'tm.team_id', 't.id')
    .where('m.business_id', businessId)
    .groupBy('m.id', 'm.name', 'm.phone_number', 'm.weekly_hours', 'm.hourly_rate', 'm.created_at', 'm.updated_at')
    .select(
      'm.id', 'm.name', 'm.phone_number', 'm.weekly_hours', 'm.hourly_rate', 'm.created_at',
      knex.raw(`COALESCE(
        json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
        FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) as groups`)
    )
    .orderBy('m.created_at', 'asc');
}

async function updateTeamMember(memberId, businessId, updates) {
  const row = await knex('team_members')
    .where('id', memberId)
    .where('business_id', businessId)
    .first();
  if (!row) {
    const err = new Error('Team member not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  const [updated] = await knex('team_members')
    .where('id', memberId)
    .where('business_id', businessId)
    .update({
      name: updates.name !== undefined ? updates.name : row.name,
      phone_number: updates.phoneNumber !== undefined ? updates.phoneNumber : row.phone_number,
      weekly_hours: updates.weeklyHours !== undefined ? updates.weeklyHours : row.weekly_hours,
      hourly_rate: updates.hourlyRate !== undefined ? updates.hourlyRate : row.hourly_rate,
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    })
    .returning('*');
  return updated;
}

async function deleteTeamMember(memberId, businessId) {
  await knex('team_members')
    .where('id', memberId)
    .where('business_id', businessId)
    .delete();
}

// ─── SERVICE ASSIGNMENTS ─────────────────────────────────────────────────────

async function getAssignmentsForDate(businessId, serviceDate) {
  return knex('service_assignments as sa')
    .join('selection_cycles as sc', 'sa.selection_cycle_id', 'sc.id')
    .leftJoin('team_members as tm', 'sa.team_member_id', 'tm.id')
    .leftJoin('teams as t', 'sa.team_id', 't.id')
    .where('sa.business_id', businessId)
    .where('sc.service_date', serviceDate)
    .select(
      'sa.selection_cycle_id',
      'sc.customer_id',
      'sa.team_member_id',
      'tm.name as team_member_name',
      'sa.team_id',
      't.name as team_name'
    );
}

// assignee: { teamMemberId: number } | { teamId: number }
async function upsertServiceAssignment(businessId, selectionCycleId, assignee) {
  const updates = {
    team_member_id: assignee.teamMemberId ?? null,
    team_id: assignee.teamId ?? null,
    updated_at: knex.raw('CURRENT_TIMESTAMP'),
  };
  const existing = await knex('service_assignments')
    .where('selection_cycle_id', selectionCycleId)
    .first();
  if (existing) {
    return knex('service_assignments')
      .where('selection_cycle_id', selectionCycleId)
      .update(updates);
  }
  return knex('service_assignments').insert({
    business_id: businessId,
    selection_cycle_id: selectionCycleId,
    ...updates,
    created_at: knex.raw('CURRENT_TIMESTAMP'),
  });
}

async function removeServiceAssignment(businessId, selectionCycleId) {
  return knex('service_assignments')
    .where('business_id', businessId)
    .where('selection_cycle_id', selectionCycleId)
    .delete();
}

// ─── TEAM GROUPS ─────────────────────────────────────────────────────────────

async function createTeamGroup(businessId, name) {
  const [group] = await knex('teams')
    .insert({ business_id: businessId, name, created_at: knex.raw('CURRENT_TIMESTAMP'), updated_at: knex.raw('CURRENT_TIMESTAMP') })
    .returning('*');
  return group;
}

async function getTeamGroups(businessId) {
  return knex('teams as t')
    .leftJoin('team_memberships as tm', 't.id', 'tm.team_id')
    .leftJoin('team_members as m', 'tm.team_member_id', 'm.id')
    .where('t.business_id', businessId)
    .groupBy('t.id', 't.name', 't.business_id', 't.created_at', 't.updated_at')
    .select(
      't.id', 't.name', 't.created_at',
      knex.raw('COUNT(tm.team_member_id)::int as member_count'),
      knex.raw(`COALESCE(
        json_agg(json_build_object('id', m.id, 'name', m.name) ORDER BY m.name)
        FILTER (WHERE m.id IS NOT NULL),
        '[]'
      ) as members`)
    )
    .orderBy('t.created_at', 'asc');
}

async function getTeamGroupWithMembers(teamId, businessId) {
  const group = await knex('teams').where('id', teamId).where('business_id', businessId).first();
  if (!group) {
    const err = new Error('Team not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  const members = await knex('team_members as m')
    .join('team_memberships as tm', 'm.id', 'tm.team_member_id')
    .where('tm.team_id', teamId)
    .select('m.id', 'm.name', 'm.phone_number', 'm.weekly_hours');
  return { ...group, members };
}

async function updateTeamGroup(teamId, businessId, name) {
  const [updated] = await knex('teams')
    .where('id', teamId)
    .where('business_id', businessId)
    .update({ name, updated_at: knex.raw('CURRENT_TIMESTAMP') })
    .returning('*');
  if (!updated) {
    const err = new Error('Team not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  return updated;
}

async function deleteTeamGroup(teamId, businessId) {
  await knex('teams')
    .where('id', teamId)
    .where('business_id', businessId)
    .delete();
}

async function setTeamGroupMembers(teamId, businessId, memberIds) {
  const group = await knex('teams').where('id', teamId).where('business_id', businessId).first();
  if (!group) {
    const err = new Error('Team not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  await knex.transaction(async (trx) => {
    await trx('team_memberships').where('team_id', teamId).delete();
    if (memberIds.length > 0) {
      await trx('team_memberships').insert(
        memberIds.map(memberId => ({
          team_id: teamId,
          team_member_id: memberId,
          created_at: knex.raw('CURRENT_TIMESTAMP'),
        }))
      );
    }
  });
}

// ─── RESCHEDULE ───────────────────────────────────────────────────────────────

async function rescheduleSelectionCycle(selectionCycleId, businessId, newServiceDate) {
  const sc = await knex('selection_cycles')
    .join('customers', 'selection_cycles.customer_id', 'customers.id')
    .where('selection_cycles.id', selectionCycleId)
    .where('customers.business_id', businessId)
    .select('selection_cycles.*')
    .first();

  if (!sc) {
    const err = new Error('Selection cycle not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  if (sc.status === 'completed') {
    const err = new Error('Cannot reschedule a completed service call');
    err.code = 'ALREADY_COMPLETED';
    err.statusCode = 409;
    throw err;
  }

  const [updated] = await knex('selection_cycles')
    .where('id', selectionCycleId)
    .update({ service_date: newServiceDate, updated_at: knex.raw('CURRENT_TIMESTAMP') })
    .returning('*');
  return updated;
}

// ─── TEAM MEMBER JOB VIEWS ────────────────────────────────────────────────────

async function getJobsForTeamMember(teamMemberId) {
  const today = new Date().toISOString().split('T')[0];
  return knex('service_assignments as sa')
    .join('selection_cycles as sc', 'sa.selection_cycle_id', 'sc.id')
    .join('customers as c', 'sc.customer_id', 'c.id')
    .leftJoin('customer_services as svc', 'sc.customer_service_id', 'svc.id')
    .leftJoin('selections as sel', function() {
      this.on('sel.selection_cycle_id', 'sc.id')
          .andOn('sel.customer_id', 'sc.customer_id');
    })
    .where('sa.team_member_id', teamMemberId)
    .where('sc.service_date', '>=', today)
    .orderBy('sc.service_date', 'asc')
    .select(
      'sc.id as selectionCycleId',
      'sc.service_date as serviceDate',
      'sc.submission_deadline as submissionDeadline',
      'sc.status',
      'c.id as customerId',
      'c.name as customerName',
      'c.address as customerAddress',
      'svc.name as serviceCycleName',
      'sel.selected_tasks as selectedTasks',
      'sel.status as selectionStatus',
    );
}

async function getJobDetail(teamMemberId, selectionCycleId) {
  // Verify this team member is assigned to this job
  const assignment = await knex('service_assignments')
    .where('team_member_id', teamMemberId)
    .where('selection_cycle_id', selectionCycleId)
    .first();

  if (!assignment) {
    const err = new Error('Job not found or not assigned to this team member');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const row = await knex('selection_cycles as sc')
    .join('customers as c', 'sc.customer_id', 'c.id')
    .leftJoin('customer_services as svc', 'sc.customer_service_id', 'svc.id')
    .leftJoin('selections as sel', function() {
      this.on('sel.selection_cycle_id', 'sc.id')
          .andOn('sel.customer_id', 'sc.customer_id');
    })
    .leftJoin('service_completions as comp', 'comp.selection_cycle_id', 'sc.id')
    .where('sc.id', selectionCycleId)
    .select(
      'sc.id as selectionCycleId',
      'sc.service_date as serviceDate',
      'sc.submission_deadline as submissionDeadline',
      'sc.status',
      'c.id as customerId',
      'c.name as customerName',
      'c.phone_number as customerPhone',
      'c.address as customerAddress',
      'c.notes as customerNotes',
      'c.lat as customerLat',
      'c.lng as customerLng',
      'svc.name as serviceCycleName',
      'sc.customer_note as customerNote',
      'sel.selected_tasks as selectedTasks',
      'sel.status as selectionStatus',
      'comp.completed_at as completedAt',
      'comp.notes as completionNotes',
    )
    .first();

  return row;
}

async function getServiceCallDetail(businessId, selectionCycleId) {
  const row = await knex('selection_cycles as sc')
    .join('customers as c', 'sc.customer_id', 'c.id')
    .leftJoin('customer_services as svc', 'sc.customer_service_id', 'svc.id')
    .leftJoin('selections as sel', function() {
      this.on('sel.selection_cycle_id', 'sc.id')
          .andOn('sel.customer_id', 'sc.customer_id');
    })
    .leftJoin('service_completions as comp', 'comp.selection_cycle_id', 'sc.id')
    .leftJoin('service_assignments as sa', 'sa.selection_cycle_id', 'sc.id')
    .leftJoin('team_members as tm', 'sa.team_member_id', 'tm.id')
    .leftJoin('teams as t', 'sa.team_id', 't.id')
    .where('sc.id', selectionCycleId)
    .where('c.business_id', businessId)
    .select(
      'sc.id as selectionCycleId',
      'sc.service_date as serviceDate',
      'sc.submission_deadline as submissionDeadline',
      'sc.status',
      'c.id as customerId',
      'c.name as customerName',
      'svc.name as serviceCycleName',
      'sel.selected_tasks as selectedTasks',
      'sel.status as selectionStatus',
      'comp.completed_at as completedAt',
      'comp.notes as completionNotes',
      'tm.id as teamMemberId',
      'tm.name as teamMemberName',
      'tm.phone_number as teamMemberPhone',
      't.id as teamId',
      't.name as teamName',
    )
    .first();

  return row || null;
}

async function completeJobForTeamMember(teamMemberId, selectionCycleId, notes) {
  // Verify this team member is assigned to this job
  const assignment = await knex('service_assignments')
    .where('team_member_id', teamMemberId)
    .where('selection_cycle_id', selectionCycleId)
    .first();

  if (!assignment) {
    const err = new Error('Job not found or not assigned to this team member');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  // Look up the cycle to get customer_id and check current status
  const cycle = await knex('selection_cycles').where('id', selectionCycleId).first();
  if (!cycle) {
    const err = new Error('Selection cycle not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  if (cycle.status === 'completed') {
    const err = new Error('Service already marked as complete');
    err.code = 'ALREADY_COMPLETED';
    err.statusCode = 409;
    throw err;
  }

  const existing = await knex('service_completions')
    .where('selection_cycle_id', selectionCycleId)
    .first();

  if (existing) {
    const err = new Error('Service already marked as complete');
    err.code = 'ALREADY_COMPLETED';
    err.statusCode = 409;
    throw err;
  }

  const [inserted] = await knex('service_completions')
    .insert({
      selection_cycle_id: selectionCycleId,
      customer_id: cycle.customer_id,
      completed_at: knex.raw('CURRENT_TIMESTAMP'),
      notes: notes || null,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    })
    .returning('*');

  await knex('selection_cycles')
    .where('id', selectionCycleId)
    .update({ status: 'completed', updated_at: knex.raw('CURRENT_TIMESTAMP') });

  return inserted;
}

// ─── SMS KEYWORD HELPERS ─────────────────────────────────────────────────────

async function confirmCustomerSelection(customerId) {
  const cycle = await knex('selection_cycles')
    .where('customer_id', customerId)
    .where('status', 'open')
    .orderBy('service_date', 'asc')
    .first();

  if (!cycle) return { status: 'no_cycle' };

  const serviceDate = new Date(cycle.service_date).toISOString().split('T')[0];

  const existing = await knex('selections')
    .where('selection_cycle_id', cycle.id)
    .where('customer_id', customerId)
    .first();

  if (existing && existing.status === 'submitted') {
    return { status: 'already_confirmed', serviceDate };
  }

  if (existing && existing.status === 'draft') {
    await knex('selections').where('id', existing.id).update({
      status: 'submitted',
      submitted_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    });
    return { status: 'confirmed', serviceDate };
  }

  // No selection yet — auto-repeat from last submitted
  const previous = await knex('selections')
    .where('customer_id', customerId)
    .where('status', 'submitted')
    .orderBy('submitted_at', 'desc')
    .first();

  if (!previous) return { status: 'no_previous', serviceDate };

  await knex('selections').insert({
    selection_cycle_id: cycle.id,
    customer_id: customerId,
    selected_tasks: JSON.stringify(Array.isArray(previous.selected_tasks) ? previous.selected_tasks : previous.selected_tasks),
    selected_total_hours: previous.selected_total_hours,
    status: 'submitted',
    submitted_at: knex.raw('CURRENT_TIMESTAMP'),
    created_at: knex.raw('CURRENT_TIMESTAMP'),
    updated_at: knex.raw('CURRENT_TIMESTAMP'),
  });

  return { status: 'confirmed', serviceDate };
}

async function generateSelectionToken(selectionCycleId) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await knex('selection_cycles').where('id', selectionCycleId).update({
    selection_token: token,
    selection_token_expires_at: expiresAt,
    updated_at: knex.raw('CURRENT_TIMESTAMP'),
  });

  return token;
}

async function getSelectionByToken(token) {
  const cycle = await knex('selection_cycles')
    .where('selection_token', token)
    .where('selection_token_expires_at', '>', knex.raw('CURRENT_TIMESTAMP'))
    .first();

  if (!cycle) return null;

  const customer = await knex('customers').where('id', cycle.customer_id).first();
  const business = await knex('businesses').where('id', customer.business_id).first();

  const tasks = await knex('service_tasks')
    .where('customer_service_id', cycle.customer_service_id)
    .orderBy('id', 'asc')
    .select('id', 'name', 'time_allotment_minutes');

  const selection = await knex('selections')
    .where('selection_cycle_id', cycle.id)
    .where('customer_id', cycle.customer_id)
    .first();

  const currentTaskIds = selection && selection.selected_tasks
    ? (Array.isArray(selection.selected_tasks) ? selection.selected_tasks : JSON.parse(selection.selected_tasks))
    : tasks.map(t => t.id);

  return {
    cycleId: cycle.id,
    serviceDate: new Date(cycle.service_date).toISOString().split('T')[0],
    businessName: business.name,
    availableTasks: tasks,
    currentTaskIds,
  };
}

async function submitSelectionByToken(token, selectedTaskIds) {
  const cycle = await knex('selection_cycles')
    .where('selection_token', token)
    .where('selection_token_expires_at', '>', knex.raw('CURRENT_TIMESTAMP'))
    .first();

  if (!cycle) {
    throw Object.assign(new Error('Invalid or expired selection link'), { code: 'INVALID_TOKEN', statusCode: 404 });
  }

  const availableTasks = await knex('service_tasks')
    .where('customer_service_id', cycle.customer_service_id)
    .select('id', 'time_allotment_minutes');

  const availableIds = availableTasks.map(t => t.id);
  const invalid = selectedTaskIds.filter(id => !availableIds.includes(id));
  if (invalid.length > 0) {
    throw Object.assign(new Error('One or more selected tasks are not available for this cycle'), { code: 'INVALID_TASKS', statusCode: 400 });
  }

  const selectedDetails = availableTasks.filter(t => selectedTaskIds.includes(t.id));
  const totalMinutes = selectedDetails.reduce((sum, t) => sum + t.time_allotment_minutes, 0);
  const selectedTotalHours = Math.round((totalMinutes / 60) * 10) / 10;

  const existing = await knex('selections')
    .where('selection_cycle_id', cycle.id)
    .where('customer_id', cycle.customer_id)
    .first();

  if (existing) {
    await knex('selections').where('id', existing.id).update({
      selected_tasks: JSON.stringify(selectedTaskIds),
      selected_total_hours: selectedTotalHours,
      status: 'submitted',
      submitted_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    });
  } else {
    await knex('selections').insert({
      selection_cycle_id: cycle.id,
      customer_id: cycle.customer_id,
      selected_tasks: JSON.stringify(selectedTaskIds),
      selected_total_hours: selectedTotalHours,
      status: 'submitted',
      submitted_at: knex.raw('CURRENT_TIMESTAMP'),
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    });
  }

  return { serviceDate: new Date(cycle.service_date).toISOString().split('T')[0] };
}

// ─── GEOFENCE EVENTS ─────────────────────────────────────────────────────────

async function recordGeofenceEvent(teamMemberId, selectionCycleId, { eventType, occurredAt, lat, lng, method }) {
  // Verify this team member is actually assigned to this job before recording
  // events or creating labor costs — matches getJobDetail/completeJobForTeamMember.
  // The route's requireTeamMember only proves the JWT matches the URL's memberId.
  const assignment = await knex('service_assignments')
    .where('team_member_id', teamMemberId)
    .where('selection_cycle_id', selectionCycleId)
    .first();

  if (!assignment) {
    const err = new Error('Job not found or not assigned to this team member');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const event = await knex('geofence_events')
    .insert({
      selection_cycle_id: selectionCycleId,
      team_member_id: teamMemberId,
      event_type: eventType,
      occurred_at: occurredAt,
      lat,
      lng,
      method,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
    })
    .returning('*')
    .then(rows => rows[0]);

  let laborCostCreated = false;
  let reviewRequestSent = false;

  if (eventType === 'departure') {
    // Recompute total on-site hours from the FULL event history for this
    // member+job, not just the latest interval. Pair each arrival with the
    // next departure and sum only the durations actually on-site. This is
    // idempotent — a GPS-jitter re-entry (arrive/depart/arrive/depart) can
    // neither lose the earlier interval nor double-count on a re-fired event.
    const events = await knex('geofence_events')
      .where('team_member_id', teamMemberId)
      .where('selection_cycle_id', selectionCycleId)
      .whereIn('event_type', ['arrival', 'departure'])
      .orderBy('occurred_at', 'asc');

    let totalMsec = 0;
    let openArrivalMsec = null;
    for (const ev of events) {
      if (ev.event_type === 'arrival') {
        // Latest unpaired arrival wins (a duplicate arrival just resets the clock)
        openArrivalMsec = new Date(ev.occurred_at).getTime();
      } else if (ev.event_type === 'departure' && openArrivalMsec != null) {
        totalMsec += Math.max(0, new Date(ev.occurred_at).getTime() - openArrivalMsec);
        openArrivalMsec = null;
      }
    }

    // Only create/update the labor line if at least one arrival/departure
    // pair exists. A lone departure with no prior arrival records the event
    // but leaves labor for the business owner to add manually.
    const hasPairedInterval = events.some(e => e.event_type === 'arrival');
    if (hasPairedInterval) {
      const hoursActual = Math.round((totalMsec / (1000 * 60 * 60)) * 100) / 100;

      const member = await knex('team_members').where('id', teamMemberId).first();
      const hourlyRate = member ? member.hourly_rate : null;
      const amount = hourlyRate ? Math.round(hoursActual * parseFloat(hourlyRate) * 100) / 100 : 0.00;

      // Get Direct Labor category id (code 5000)
      const laborCategory = await knex('cost_categories').where('code', 5000).where('is_system', true).first();
      if (laborCategory) {
        // Rule 6: upsert — update if a labor row already exists for this member+job
        const existing = await knex('job_costs')
          .where('selection_cycle_id', selectionCycleId)
          .where('team_member_id', teamMemberId)
          .where('cost_category_id', laborCategory.id)
          .first();

        if (existing) {
          // D1: never let an auto recompute clobber an owner's manual
          // correction. A late/duplicate departure leaves the manual row as-is.
          if (existing.source !== 'manual') {
            await knex('job_costs').where('id', existing.id).update({
              amount,
              hours_actual: hoursActual,
              updated_at: knex.raw('CURRENT_TIMESTAMP'),
            });
            laborCostCreated = true;
          }
        } else {
          await knex('job_costs').insert({
            selection_cycle_id: selectionCycleId,
            cost_category_id: laborCategory.id,
            amount,
            team_member_id: teamMemberId,
            hours_actual: hoursActual,
            source: 'auto',
            created_at: knex.raw('CURRENT_TIMESTAMP'),
            updated_at: knex.raw('CURRENT_TIMESTAMP'),
          });
          laborCostCreated = true;
        }
      }
    }

    // Review Requests (Rule 1): a departure event triggers a one-per-job review
    // request. maybeCreateReviewRequest honors opt-out (Rule 2) + token reuse
    // (Rule 3) and fires the SMS fire-and-forget. Guarded so a failure here never
    // blocks geofence recording or the labor-cost result.
    try {
      const reviewToken = await maybeCreateReviewRequest(selectionCycleId);
      reviewRequestSent = reviewToken != null;
    } catch (err) {
      console.error('Review request creation failed:', err.message);
    }
  }

  return { event, laborCostCreated, reviewRequestSent };
}

// ─── JOB COSTING ─────────────────────────────────────────────────────────────

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Verify a selection cycle belongs to this business (via the customer) and
// return the cycle row. Mirrors the ownership check in rescheduleSelectionCycle.
async function assertCycleOwnedByBusiness(selectionCycleId, businessId) {
  const cycle = await knex('selection_cycles as sc')
    .join('customers as c', 'sc.customer_id', 'c.id')
    .where('sc.id', selectionCycleId)
    .where('c.business_id', businessId)
    .select('sc.*')
    .first();
  if (!cycle) {
    const err = new Error('Job not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  return cycle;
}

// GET /cost-categories — system defaults (business_id NULL) + this business's customs.
async function getCostCategories(businessId) {
  return knex('cost_categories')
    .whereNull('business_id')
    .orWhere('business_id', businessId)
    .orderBy('code', 'asc');
}

// PATCH /jobs/:selectionCycleId/price — set/override job price (Rule 5, ad hoc).
async function setJobPrice(businessId, selectionCycleId, price) {
  await assertCycleOwnedByBusiness(selectionCycleId, businessId);
  const [updated] = await knex('selection_cycles')
    .where('id', selectionCycleId)
    .update({ price, updated_at: knex.raw('CURRENT_TIMESTAMP') })
    .returning('*');
  return updated;
}

// PATCH /customers/:customerId/assignments/:assignmentId — set recurring price.
// Feeds D2: future generateUpcomingSelectionCycles() calls copy this forward.
async function setAssignmentPrice(businessId, customerId, assignmentId, pricePerVisit) {
  // "assignmentId" is now the customer_services (Service) row id.
  const assignment = await knex('customer_services as cs')
    .join('customers as c', 'cs.customer_id', 'c.id')
    .where('cs.id', assignmentId)
    .where('cs.customer_id', customerId)
    .where('c.business_id', businessId)
    .select('cs.*')
    .first();
  if (!assignment) {
    const err = new Error('Assignment not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  const [updated] = await knex('customer_services')
    .where('id', assignmentId)
    .update({ price_per_visit: pricePerVisit, updated_at: knex.raw('CURRENT_TIMESTAMP') })
    .returning('*');
  return updated;
}

// Enforce the spec's labor cross-table rule at the app layer (v1 decision):
// a labor-type line requires team_member_id + hours_actual; non-labor lines
// must not carry them.
async function validateCostLineShape(costCategoryId, businessId, teamMemberId, hoursActual) {
  const category = await knex('cost_categories')
    .where('id', costCategoryId)
    .where(function () { this.whereNull('business_id').orWhere('business_id', businessId); })
    .first();
  if (!category) {
    const err = new Error('Cost category not found');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }
  if (category.type === 'labor') {
    if (teamMemberId == null || hoursActual == null) {
      const err = new Error('Labor lines require teamMemberId and hoursActual');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }
  } else if (teamMemberId != null || hoursActual != null) {
    const err = new Error('Only labor lines may set teamMemberId/hoursActual');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    throw err;
  }
  return category;
}

// POST /costs — manual entry/correction. Always stamps source='manual' (D1).
async function addJobCost(businessId, selectionCycleId, { costCategoryId, amount, teamMemberId = null, hoursActual = null }) {
  await assertCycleOwnedByBusiness(selectionCycleId, businessId);
  await validateCostLineShape(costCategoryId, businessId, teamMemberId, hoursActual);

  // Rule 6: at most one labor row per member+job+category. Surface a clean 409
  // rather than letting the partial unique index throw a raw DB error.
  if (teamMemberId != null) {
    const dup = await knex('job_costs')
      .where('selection_cycle_id', selectionCycleId)
      .where('team_member_id', teamMemberId)
      .where('cost_category_id', costCategoryId)
      .first();
    if (dup) {
      const err = new Error('A labor line already exists for this member on this job');
      err.code = 'ALREADY_EXISTS';
      err.statusCode = 409;
      throw err;
    }
  }

  const [row] = await knex('job_costs')
    .insert({
      selection_cycle_id: selectionCycleId,
      cost_category_id: costCategoryId,
      amount,
      team_member_id: teamMemberId,
      hours_actual: hoursActual,
      source: 'manual',
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    })
    .returning('*');
  return row;
}

// PATCH /costs/:costId — correct amount (and hours for labor). Marks manual (D1)
// so a later auto recompute won't clobber it.
async function updateJobCost(businessId, selectionCycleId, costId, { amount, hoursActual }) {
  await assertCycleOwnedByBusiness(selectionCycleId, businessId);
  const existing = await knex('job_costs')
    .where('id', costId)
    .where('selection_cycle_id', selectionCycleId)
    .first();
  if (!existing) {
    const err = new Error('Cost line not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  const updates = { source: 'manual', updated_at: knex.raw('CURRENT_TIMESTAMP') };
  if (amount !== undefined) updates.amount = amount;
  if (hoursActual !== undefined) updates.hours_actual = hoursActual;
  const [row] = await knex('job_costs').where('id', costId).update(updates).returning('*');
  return row;
}

// DELETE /costs/:costId
async function deleteJobCost(businessId, selectionCycleId, costId) {
  await assertCycleOwnedByBusiness(selectionCycleId, businessId);
  const deleted = await knex('job_costs')
    .where('id', costId)
    .where('selection_cycle_id', selectionCycleId)
    .delete();
  if (!deleted) {
    const err = new Error('Cost line not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  return true;
}

// Rule 7: estimated hours = sum of time_allotment_minutes over selected tasks,
// in decimal hours. Derived at query time — never stored.
async function computeEstimatedHours(selectionCycle) {
  const selection = await knex('selections')
    .where('selection_cycle_id', selectionCycle.id)
    .where('customer_id', selectionCycle.customer_id)
    .first();
  if (!selection || !Array.isArray(selection.selected_tasks) || selection.selected_tasks.length === 0) {
    return 0;
  }
  const tasks = await knex('service_tasks').whereIn('id', selection.selected_tasks);
  const minutes = tasks.reduce((sum, t) => sum + (t.time_allotment_minutes || 0), 0);
  return round2(minutes / 60);
}

// GET /jobs/:selectionCycleId/costs — the full per-job costing payload.
async function getJobCosts(businessId, selectionCycleId) {
  const cycle = await assertCycleOwnedByBusiness(selectionCycleId, businessId);

  const lines = await knex('job_costs as jc')
    .join('cost_categories as cat', 'jc.cost_category_id', 'cat.id')
    .leftJoin('team_members as tm', 'jc.team_member_id', 'tm.id')
    .where('jc.selection_cycle_id', selectionCycleId)
    .select(
      'jc.id',
      'jc.amount',
      'jc.hours_actual',
      'jc.team_member_id',
      'jc.source',
      'cat.type',
      'tm.name as member_name',
      'tm.hourly_rate',
    );

  const laborLines = lines
    .filter((l) => l.type === 'labor')
    .map((l) => ({
      costId: l.id,
      teamMemberId: l.team_member_id,
      memberName: l.member_name,
      hoursActual: l.hours_actual != null ? round2(l.hours_actual) : null,
      hourlyRate: l.hourly_rate != null ? round2(l.hourly_rate) : null,
      amount: round2(l.amount),
      source: l.source,
    }));

  const materialsLines = lines.filter((l) => l.type === 'materials');
  const overheadLines = lines.filter((l) => l.type === 'overhead');
  const materialsAmount = round2(materialsLines.reduce((s, l) => s + Number(l.amount), 0));
  const overheadAmount = round2(overheadLines.reduce((s, l) => s + Number(l.amount), 0));
  // v1 keeps materials/overhead to a single line per job, so the UI can drive a
  // single editable field: POST when the id is null, PATCH the existing line otherwise.
  const materialsCostId = materialsLines.length ? materialsLines[0].id : null;
  const overheadCostId = overheadLines.length ? overheadLines[0].id : null;
  const laborTotal = round2(laborLines.reduce((s, l) => s + l.amount, 0));
  const totalCost = round2(laborTotal + materialsAmount + overheadAmount);

  const price = cycle.price != null ? round2(cycle.price) : null;
  // Rule 3: margin only when price is set; UI renders "Price not set" otherwise.
  const marginDollars = price != null ? round2(price - totalCost) : null;
  const marginPercent = price != null && price !== 0 ? round2((marginDollars / price) * 100) : null;

  const estimatedHours = await computeEstimatedHours(cycle);

  return {
    selectionCycleId: cycle.id,
    serviceDate: cycle.service_date,
    status: cycle.status,
    price,
    estimatedHours,
    laborLines,
    materialsAmount,
    materialsCostId,
    overheadAmount,
    overheadCostId,
    totalCost,
    marginDollars,
    marginPercent,
  };
}

// GET /customers/:customerId/profitability — aggregate over COMPLETED cycles only.
async function getCustomerProfitability(businessId, customerId) {
  const customer = await knex('customers')
    .where('id', customerId)
    .where('business_id', businessId)
    .first();
  if (!customer) {
    const err = new Error('Customer not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const cycles = await knex('selection_cycles')
    .where('customer_id', customerId)
    .where('status', 'completed')
    .orderBy('service_date', 'asc');

  const cycleIds = cycles.map((c) => c.id);
  const costRows = cycleIds.length
    ? await knex('job_costs').whereIn('selection_cycle_id', cycleIds)
    : [];
  const costByCycle = {};
  for (const r of costRows) {
    costByCycle[r.selection_cycle_id] = (costByCycle[r.selection_cycle_id] || 0) + Number(r.amount);
  }

  let totalRevenue = 0;
  let totalCost = 0;
  const jobs = cycles.map((c) => {
    const price = c.price != null ? round2(c.price) : null;
    const cost = round2(costByCycle[c.id] || 0);
    if (price != null) totalRevenue += price;
    totalCost += cost;
    return {
      selectionCycleId: c.id,
      serviceDate: c.service_date,
      price,
      totalCost: cost,
      marginDollars: price != null ? round2(price - cost) : null,
    };
  });

  totalRevenue = round2(totalRevenue);
  totalCost = round2(totalCost);
  const totalMarginDollars = round2(totalRevenue - totalCost);
  const totalMarginPercent = totalRevenue !== 0 ? round2((totalMarginDollars / totalRevenue) * 100) : null;

  return {
    totalRevenue,
    totalCost,
    totalMarginDollars,
    totalMarginPercent,
    completedJobCount: cycles.length,
    jobs,
  };
}

// ─── REVIEW REQUESTS ─────────────────────────────────────────────────────────

const WEBSITE_URL = process.env.WEBSITE_URL || 'https://taskrightpro.com';
const REVIEW_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7-day expiry (spec Data Model)

// Departure trigger (Rule 1): create a one-per-job review token (Rule 3) and fire
// the review SMS inline (Item 7). Honors the opt-out flag (Rule 2). Returns the
// token row when a new request was created, or null when suppressed/reused so the
// caller can tell whether an SMS went out. Safe to await from the geofence handler:
// callers should still guard so a failure here never blocks event recording.
async function maybeCreateReviewRequest(selectionCycleId) {
  const cycle = await knex('selection_cycles').where('id', selectionCycleId).first();
  if (!cycle) return null;

  const customer = await knex('customers').where('id', cycle.customer_id).first();
  if (!customer) return null;

  // Rule 2: opted-out customers get no token and no SMS.
  if (customer.review_requests_opted_out) return null;

  // Rule 3: one token per job. A re-exit reuses the existing token — no second SMS.
  const existing = await knex('review_tokens').where('selection_cycle_id', selectionCycleId).first();
  if (existing) return null;

  const business = await knex('businesses').where('id', customer.business_id).first();
  if (!business) return null;

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REVIEW_TOKEN_TTL_MS).toISOString();

  let row;
  try {
    [row] = await knex('review_tokens')
      .insert({
        selection_cycle_id: selectionCycleId,
        customer_id: customer.id,
        business_id: business.id,
        token,
        expires_at: expiresAt,
        sent_at: knex.raw('CURRENT_TIMESTAMP'),
        created_at: knex.raw('CURRENT_TIMESTAMP'),
      })
      .returning('*');
  } catch (err) {
    // Unique(selection_cycle_id) race — another departure beat us to it. Reuse, no SMS.
    if (err.code === '23505') return null;
    throw err;
  }

  // Fire-and-forget SMS, same pattern as other outbound notifications (dev mode logs).
  const message =
    `Hi ${customer.name || 'there'}, how was your ${business.name} service today?\n` +
    `Leave a quick note — it only takes a moment:\n` +
    `${WEBSITE_URL}/review/${token}`;
  Promise.resolve()
    .then(() => notificationService.sendSMS(business, customer.phone_number, message))
    .catch((err) => console.error('Review request SMS failed:', err.message));

  return row;
}

// GET /api/review/:token — non-sensitive review context for the no-auth page.
// Sets opened_at on first load (open-rate tracking). Returns { valid: false } for
// missing OR expired tokens (Rule 4) so the page can't distinguish the two.
async function getReviewByToken(token) {
  const row = await knex('review_tokens').where('token', token).first();
  if (!row) return { valid: false };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { valid: false };

  if (!row.opened_at) {
    await knex('review_tokens').where('id', row.id).update({ opened_at: knex.raw('CURRENT_TIMESTAMP') });
  }

  const customer = await knex('customers').where('id', row.customer_id).first();
  const business = await knex('businesses').where('id', row.business_id).first();
  const cycle = await knex('selection_cycles').where('id', row.selection_cycle_id).first();

  return {
    valid: true,
    customerName: customer ? customer.name : null,
    businessName: business ? business.name : null,
    serviceDate: cycle ? new Date(cycle.service_date).toISOString().split('T')[0] : null,
    alreadySubmitted: row.submitted_at != null,
  };
}

// POST /api/review/:token — record the star rating + optional comment.
// Rule 4: reject expired. Rule 5: idempotent — a resubmit is a no-op that still
// reports success. Writes a feedbacks row with source='sms_request'.
async function submitReviewByToken(token, { rating, comment }) {
  const row = await knex('review_tokens').where('token', token).first();
  if (!row) {
    throw Object.assign(new Error('This link isn\'t valid.'), { code: 'INVALID_TOKEN', statusCode: 404 });
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw Object.assign(new Error('This review link has expired.'), { code: 'EXPIRED_TOKEN', statusCode: 410 });
  }

  // Rule 5: already submitted — no second feedback row, still succeed.
  if (row.submitted_at) return { success: true };

  const parsedRating = parseInt(rating, 10);
  if (Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw Object.assign(new Error('rating must be an integer from 1 to 5'), { code: 'VALIDATION_ERROR', statusCode: 400 });
  }

  // feedbacks has unique(customer_id, selection_cycle_id) — if voluntary in-app
  // feedback already exists for this job, update it in place rather than colliding.
  const existingFeedback = await knex('feedbacks')
    .where('customer_id', row.customer_id)
    .where('selection_cycle_id', row.selection_cycle_id)
    .first();

  if (existingFeedback) {
    await knex('feedbacks').where('id', existingFeedback.id).update({
      rating: parsedRating,
      feedback_text: comment != null ? comment : existingFeedback.feedback_text,
      source: 'sms_request',
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    });
  } else {
    await knex('feedbacks').insert({
      customer_id: row.customer_id,
      selection_cycle_id: row.selection_cycle_id,
      rating: parsedRating,
      feedback_text: comment != null ? comment : null,
      source: 'sms_request',
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    });
  }

  await knex('review_tokens').where('id', row.id).update({ submitted_at: knex.raw('CURRENT_TIMESTAMP') });

  return { success: true };
}

module.exports = {
  // Auth
  createBusiness,
  getBusinessById,
  getBusinessByPhone,
  getBusinessByJoinCode,
  // Service Templates
  createServiceTemplate,
  getServiceTemplatesByBusiness,
  getServiceTemplateById,
  updateServiceTemplate,
  deleteServiceTemplate,
  // Customer Management
  deleteCustomer,
  addCustomer,
  getCustomersByBusiness,
  getCustomerDetails,
  updateCustomerDetails,
  // Cycle Assignment
  generateUpcomingSelectionCycles,
  getUpcomingCustomerSelections,
  // Per-customer Service CRUD (Service Model C1)
  createCustomerService,
  createCustomerServiceForBusiness,
  updateCustomerService,
  deleteCustomerService,
  getCustomerServiceDetail,
  // Forecast
  getBusinessForecast,
  // Completion
  markServiceComplete,
  rescheduleSelectionCycle,
  // Feedback
  getLatestFeedbackForCustomer,
  updateFeedbackBusinessNotes,
  // Team Members
  addTeamMember,
  getTeamMembersByBusiness,
  updateTeamMember,
  deleteTeamMember,
  getTeamMemberByPhone,
  acceptTeamMemberInvite,
  // Service Assignments
  getAssignmentsForDate,
  upsertServiceAssignment,
  removeServiceAssignment,
  // Team Groups
  createTeamGroup,
  getTeamGroups,
  getTeamGroupWithMembers,
  updateTeamGroup,
  deleteTeamGroup,
  setTeamGroupMembers,
  // Service Call Detail (business view)
  getServiceCallDetail,
  // Team Member Jobs
  getJobsForTeamMember,
  getJobDetail,
  completeJobForTeamMember,
  recordGeofenceEvent,
  // Job Costing
  getCostCategories,
  setJobPrice,
  setAssignmentPrice,
  addJobCost,
  updateJobCost,
  deleteJobCost,
  getJobCosts,
  getCustomerProfitability,
  // SMS keyword helpers
  confirmCustomerSelection,
  generateSelectionToken,
  getSelectionByToken,
  submitSelectionByToken,
  // Review Requests
  maybeCreateReviewRequest,
  getReviewByToken,
  submitReviewByToken,
};
