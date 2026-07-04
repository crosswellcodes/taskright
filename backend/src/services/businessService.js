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

// ─── TASKS ───────────────────────────────────────────────────────────────────

async function createTask(businessId, name, timeAllotmentMinutes) {
  const inserted = await knex('tasks')
    .insert({
      business_id: businessId,
      name: name.trim(),
      time_allotment_minutes: timeAllotmentMinutes,
      is_optional: true,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })
    .returning('*');

  return inserted[0];
}

async function getTasksByBusiness(businessId) {
  return await knex('tasks')
    .where('business_id', businessId)
    .orderBy('created_at', 'asc');
}

async function getTaskById(taskId) {
  return await knex('tasks').where('id', taskId).first();
}

async function updateTask(taskId, data) {
  const updates = { updated_at: knex.raw('CURRENT_TIMESTAMP') };
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.timeAllotmentMinutes !== undefined) {
    updates.time_allotment_minutes = data.timeAllotmentMinutes;
  }

  const updated = await knex('tasks').where('id', taskId).update(updates).returning('*');
  return updated[0];
}

async function deleteTask(taskId) {
  return await knex('tasks').where('id', taskId).delete();
}

// ─── SERVICE CYCLES ──────────────────────────────────────────────────────────

async function createServiceCycle(businessId, name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, taskIds) {
  if (taskIds && taskIds.length > 0) {
    const tasks = await knex('tasks')
      .whereIn('id', taskIds)
      .where('business_id', businessId);
    if (tasks.length !== taskIds.length) {
      const error = new Error('One or more task IDs not found');
      error.code = 'TASK_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }
  }

  const inserted = await knex('service_cycles')
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

  if (taskIds && taskIds.length > 0) {
    const taskAssignments = taskIds.map(taskId => ({
      task_id: taskId,
      service_cycle_id: cycle.id,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    }));
    await knex('task_assignments').insert(taskAssignments);
  }

  const assignedTasks = taskIds && taskIds.length > 0
    ? await knex('tasks').whereIn('id', taskIds)
    : [];

  return { cycle, assignedTasks };
}

async function getServiceCyclesByBusiness(businessId) {
  const cycles = await knex('service_cycles')
    .where('business_id', businessId)
    .orderBy('created_at', 'asc');

  for (const cycle of cycles) {
    const assignments = await knex('task_assignments').where('service_cycle_id', cycle.id);
    cycle.assignedTasks = assignments.map(a => a.task_id);
  }

  return cycles;
}

async function getServiceCycleById(cycleId) {
  return await knex('service_cycles').where('id', cycleId).first();
}

async function updateServiceCycle(cycleId, data) {
  const updates = { updated_at: knex.raw('CURRENT_TIMESTAMP') };
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.frequency !== undefined) updates.frequency = data.frequency;
  if (data.daysBeforeServiceDeadline !== undefined) {
    updates.days_before_service_deadline = data.daysBeforeServiceDeadline;
  }
  if (data.daysBeforeAutoRepeat !== undefined) {
    updates.days_before_auto_repeat = data.daysBeforeAutoRepeat;
  }

  const updated = await knex('service_cycles').where('id', cycleId).update(updates).returning('*');
  const cycle = updated[0];

  if (data.taskIds !== undefined) {
    await knex('task_assignments').where('service_cycle_id', cycleId).delete();
    if (data.taskIds.length > 0) {
      const taskAssignments = data.taskIds.map(taskId => ({
        task_id: taskId,
        service_cycle_id: cycleId,
        created_at: knex.raw('CURRENT_TIMESTAMP'),
        updated_at: knex.raw('CURRENT_TIMESTAMP')
      }));
      await knex('task_assignments').insert(taskAssignments);
    }
    cycle.assignedTasks = data.taskIds;
  }

  return cycle;
}

async function deleteServiceCycle(cycleId) {
  await knex('service_cycles').where('id', cycleId).delete();
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
    const assignments = await knex('customer_cycle_assignments as cca')
      .join('service_cycles as sc', 'cca.service_cycle_id', 'sc.id')
      .where('cca.customer_id', customer.id)
      .select('sc.id', 'sc.name', 'sc.frequency', 'cca.total_hours');

    customer.assignedCycles = assignments.map(a => ({
      id: a.id,
      name: a.name,
      frequency: a.frequency,
      totalHours: a.total_hours
    }));
  }

  return customers;
}

async function getCustomerDetails(customerId) {
  const customer = await knex('customers').where('id', customerId).first();
  if (!customer) return null;

  const assignments = await knex('customer_cycle_assignments as cca')
    .join('service_cycles as sc', 'cca.service_cycle_id', 'sc.id')
    .where('cca.customer_id', customerId)
    .select('sc.id', 'sc.name', 'sc.frequency', 'cca.total_hours');

  customer.assignedCycles = assignments.map(a => ({
    id: a.id,
    serviceCycleId: a.id,
    serviceCycleName: a.name,
    frequency: a.frequency,
    totalHours: a.total_hours
  }));

  const upcomingServiceRows = await knex('selection_cycles')
    .where('customer_id', customerId)
    .where('status', 'open')
    .orderBy('service_date', 'asc')
    .limit(5);

  const upcomingServices = [];
  for (const s of upcomingServiceRows) {
    const cycle = await knex('service_cycles').where('id', s.service_cycle_id).first();
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
    selectedTotalHours: lastSelection.selected_total_hours,
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
  const updated = await knex('customers').where('id', customerId).update(updates).returning('*');
  const customer = updated[0];

  // Re-geocode fire-and-forget whenever address changes
  if (data.address !== undefined && data.address) {
    geocodeAddress(customerId, data.address);
  }

  return customer;
}

// ─── CYCLE ASSIGNMENT ────────────────────────────────────────────────────────

async function assignCycle(customerId, serviceCycleId, totalHours, startDate, dayOfWeek = null) {
  const existing = await knex('customer_cycle_assignments')
    .where('customer_id', customerId)
    .where('service_cycle_id', serviceCycleId)
    .first();

  if (existing) {
    const error = new Error('Customer already assigned to this cycle');
    error.code = 'ALREADY_ASSIGNED';
    error.statusCode = 409;
    throw error;
  }

  const inserted = await knex('customer_cycle_assignments')
    .insert({
      customer_id: customerId,
      service_cycle_id: serviceCycleId,
      total_hours: totalHours,
      start_date: startDate,
      day_of_week: dayOfWeek,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })
    .returning('*');

  const assignment = inserted[0];
  const serviceCycle = await knex('service_cycles').where('id', serviceCycleId).first();
  await generateUpcomingSelectionCycles(customerId, serviceCycle, startDate, dayOfWeek);

  // Fire-and-forget: welcome SMS — don't block cycle creation on notification success
  (async () => {
    try {
      const [customer, business, firstCycle] = await Promise.all([
        knex('customers').where('id', customerId).first(),
        knex('businesses').where('id', serviceCycle.business_id).first(),
        knex('selection_cycles')
          .where('customer_id', customerId)
          .where('service_cycle_id', serviceCycleId)
          .orderBy('service_date', 'asc')
          .first()
      ]);
      const firstServiceDate = firstCycle ? new Date(firstCycle.service_date).toISOString().split('T')[0] : null;
      await notificationService.sendWelcomeNotification(business, customer.phone_number, business.name, firstServiceDate);
    } catch (e) {
      console.error('Welcome SMS failed:', e.message);
    }
  })();

  return assignment;
}

function addDays(date, n) {
  return new Date(date.getTime() + n * 24 * 60 * 60 * 1000);
}

async function generateUpcomingSelectionCycles(customerId, serviceCycle, startDate, dayOfWeek = null) {
  // D2 (Business Rule 4): pre-fill each cycle's price from the customer's
  // recurring price for this cycle so job-costing margins aren't "Price not set"
  // on first load. Null when no price is set yet; owner can override per job.
  const assignment = await knex('customer_cycle_assignments')
    .where('customer_id', customerId)
    .where('service_cycle_id', serviceCycle.id)
    .first();
  const pricePerVisit = assignment ? assignment.price_per_visit : null;

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

  for (let i = 0; i < 4; i++) {
    const serviceDate = currentDate.toISOString().split('T')[0];
    const deadlineMs = currentDate.getTime() - serviceCycle.days_before_service_deadline * 24 * 60 * 60 * 1000;
    const submissionDeadline = new Date(deadlineMs).toISOString().split('T')[0];

    const existingCycle = await knex('selection_cycles')
      .where('customer_id', customerId)
      .where('service_cycle_id', serviceCycle.id)
      .where('service_date', serviceDate)
      .first();

    if (!existingCycle) {
      await knex('selection_cycles').insert({
        service_cycle_id: serviceCycle.id,
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

  const serviceCycle = await knex('service_cycles')
    .where('id', selectionCycle.service_cycle_id)
    .first();

  const taskAssignments = await knex('task_assignments')
    .where('service_cycle_id', selectionCycle.service_cycle_id);
  const taskIds = taskAssignments.map(ta => ta.task_id);
  const availableTasks = taskIds.length > 0
    ? await knex('tasks').whereIn('id', taskIds)
    : [];

  const assignment = await knex('customer_cycle_assignments')
    .where('customer_id', customerId)
    .where('service_cycle_id', selectionCycle.service_cycle_id)
    .first();

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
    totalHours: assignment ? assignment.total_hours : null,
    currentSelection: currentSelection ? {
      selectedTasks: currentSelection.selected_tasks,
      selectedTotalHours: currentSelection.selected_total_hours,
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
    .join('service_cycles', 'selection_cycles.service_cycle_id', 'service_cycles.id')
    .where('feedbacks.customer_id', customerId)
    .where('service_cycles.business_id', businessId)
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
    .join('service_cycles', 'selection_cycles.service_cycle_id', 'service_cycles.id')
    .where('feedbacks.id', feedbackId)
    .where('service_cycles.business_id', businessId)
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

  // Group by service_date, then by service_cycle_id within each date
  const dateGrouped = {};
  for (const sc of selectionCycles) {
    // Normalize to plain YYYY-MM-DD string (pg returns date columns as Date objects)
    const dateKey = typeof sc.service_date === 'string'
      ? sc.service_date.split('T')[0]
      : sc.service_date.toISOString().split('T')[0];
    if (!dateGrouped[dateKey]) {
      dateGrouped[dateKey] = { serviceDate: sc.service_date, cycleGroups: {} };
    }
    if (!dateGrouped[dateKey].cycleGroups[sc.service_cycle_id]) {
      dateGrouped[dateKey].cycleGroups[sc.service_cycle_id] = {
        serviceCycleId: sc.service_cycle_id,
        selectionCycles: [],
      };
    }
    dateGrouped[dateKey].cycleGroups[sc.service_cycle_id].selectionCycles.push(sc);
  }

  const upcomingServices = [];
  for (const dateGroup of Object.values(dateGrouped)) {
    let totalSubmitted = 0;
    let totalPending = 0;
    let totalHours = 0;
    const serviceCycles = [];

    for (const cycleGroup of Object.values(dateGroup.cycleGroups)) {
      const serviceCycle = await knex('service_cycles').where('id', cycleGroup.serviceCycleId).first();
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

      // Sum hours for all customers assigned to this cycle on this date
      const assignments = await knex('customer_cycle_assignments')
        .where('service_cycle_id', cycleGroup.serviceCycleId)
        .whereIn('customer_id', cycleCustomerIds);
      totalHours += assignments.reduce((sum, a) => sum + (parseFloat(a.total_hours) || 0), 0);

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

async function addTeamMember(businessId, name, phoneNumber, weeklyHours) {
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
    .groupBy('m.id', 'm.name', 'm.phone_number', 'm.weekly_hours', 'm.created_at', 'm.updated_at')
    .select(
      'm.id', 'm.name', 'm.phone_number', 'm.weekly_hours', 'm.created_at',
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
    .join('service_cycles', 'selection_cycles.service_cycle_id', 'service_cycles.id')
    .where('selection_cycles.id', selectionCycleId)
    .where('service_cycles.business_id', businessId)
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
    .join('service_cycles as svc', 'sc.service_cycle_id', 'svc.id')
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
    .join('service_cycles as svc', 'sc.service_cycle_id', 'svc.id')
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
    .join('service_cycles as svc', 'sc.service_cycle_id', 'svc.id')
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

  const tasks = await knex('tasks as t')
    .join('task_assignments as ta', 'ta.task_id', 't.id')
    .where('ta.service_cycle_id', cycle.service_cycle_id)
    .select('t.id', 't.name', 't.time_allotment_minutes');

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

  const availableTasks = await knex('tasks as t')
    .join('task_assignments as ta', 'ta.task_id', 't.id')
    .where('ta.service_cycle_id', cycle.service_cycle_id)
    .select('t.id', 't.time_allotment_minutes');

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
  }

  return { event, laborCostCreated };
}

// ─── JOB COSTING ─────────────────────────────────────────────────────────────

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Verify a selection cycle belongs to this business (via service_cycles) and
// return the cycle row. Mirrors the ownership check in rescheduleSelectionCycle.
async function assertCycleOwnedByBusiness(selectionCycleId, businessId) {
  const cycle = await knex('selection_cycles as sc')
    .join('service_cycles as svc', 'sc.service_cycle_id', 'svc.id')
    .where('sc.id', selectionCycleId)
    .where('svc.business_id', businessId)
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
  const assignment = await knex('customer_cycle_assignments as cca')
    .join('customers as c', 'cca.customer_id', 'c.id')
    .where('cca.id', assignmentId)
    .where('cca.customer_id', customerId)
    .where('c.business_id', businessId)
    .select('cca.*')
    .first();
  if (!assignment) {
    const err = new Error('Assignment not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  const [updated] = await knex('customer_cycle_assignments')
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
  const tasks = await knex('tasks').whereIn('id', selection.selected_tasks);
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

  const materialsAmount = round2(
    lines.filter((l) => l.type === 'materials').reduce((s, l) => s + Number(l.amount), 0)
  );
  const overheadAmount = round2(
    lines.filter((l) => l.type === 'overhead').reduce((s, l) => s + Number(l.amount), 0)
  );
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
    overheadAmount,
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

module.exports = {
  // Auth
  createBusiness,
  getBusinessById,
  getBusinessByPhone,
  getBusinessByJoinCode,
  // Tasks
  createTask,
  getTasksByBusiness,
  getTaskById,
  updateTask,
  deleteTask,
  // Service Cycles
  createServiceCycle,
  getServiceCyclesByBusiness,
  getServiceCycleById,
  updateServiceCycle,
  deleteServiceCycle,
  // Customer Management
  deleteCustomer,
  addCustomer,
  getCustomersByBusiness,
  getCustomerDetails,
  updateCustomerDetails,
  // Cycle Assignment
  assignCycle,
  generateUpcomingSelectionCycles,
  getUpcomingCustomerSelections,
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
};
