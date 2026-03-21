const knex = require('../db');

// ─── AUTH / BUSINESS ACCOUNT ────────────────────────────────────────────────

/**
 * Create a new business
 */
async function createBusiness(name, phoneNumber, schedulingFormat = 'date_based') {
  const existingBusiness = await knex('businesses')
    .where('phone_number', phoneNumber)
    .first();

  if (existingBusiness) {
    const error = new Error('Phone number already registered');
    error.code = 'DUPLICATE_PHONE';
    error.statusCode = 409;
    throw error;
  }

  const inserted = await knex('businesses')
    .insert({
      name: name.trim(),
      phone_number: phoneNumber,
      scheduling_format: schedulingFormat,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })
    .returning('*');

  return inserted[0];
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

  return inserted[0];
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
  return updated[0];
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

  return assignment;
}

function addDays(date, n) {
  return new Date(date.getTime() + n * 24 * 60 * 60 * 1000);
}

async function generateUpcomingSelectionCycles(customerId, serviceCycle, startDate, dayOfWeek = null) {
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

  return inserted[0];
}

// ─── TEAM MEMBERS ─────────────────────────────────────────────────────────────

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
  const inserted = await knex('team_members')
    .insert({
      business_id: businessId,
      name: name.trim(),
      phone_number: phoneNumber,
      weekly_hours: weeklyHours,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    })
    .returning('*');
  return inserted[0];
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

module.exports = {
  // Auth
  createBusiness,
  getBusinessById,
  getBusinessByPhone,
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
};
