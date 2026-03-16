const knex = require('../db');

// ─── AUTH ─────────────────────────────────────────────────────────────────────

async function createCustomer(businessId, phoneNumber) {
  const existingCustomer = await knex('customers')
    .where('business_id', businessId)
    .where('phone_number', phoneNumber)
    .first();

  if (existingCustomer) {
    const error = new Error('Customer with this phone already exists');
    error.code = 'DUPLICATE_CUSTOMER';
    error.statusCode = 409;
    throw error;
  }

  const inserted = await knex('customers')
    .insert({
      business_id: businessId,
      phone_number: phoneNumber,
      name: phoneNumber, // Placeholder, can be updated later
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })
    .returning('*');

  return inserted[0];
}

async function getCustomerById(id) {
  return await knex('customers').where('id', id).first();
}

async function getCustomerByPhone(phoneNumber) {
  return await knex('customers').where('phone_number', phoneNumber).first();
}

// ─── SELECTION CYCLES ────────────────────────────────────────────────────────

async function getCurrentSelectionCycle(customerId) {
  // ── 1. Next upcoming open cycle (always powers the blue "Next Service" card) ──
  const openCycle = await knex('selection_cycles')
    .where('customer_id', customerId)
    .where('status', 'open')
    .orderBy('service_date', 'asc')
    .first();

  // ── 2. Most recently completed cycle with no feedback yet (powers the banner) ──
  const completedCycle = await knex('selection_cycles')
    .where('customer_id', customerId)
    .where('status', 'completed')
    .where('service_date', '<=', knex.raw('CURRENT_DATE'))
    .orderBy('service_date', 'desc')
    .first();

  let recentCompletion = null;
  if (completedCycle) {
    const existingFeedback = await knex('feedbacks')
      .where('customer_id', customerId)
      .where('selection_cycle_id', completedCycle.id)
      .first();
    if (!existingFeedback) {
      recentCompletion = {
        id: completedCycle.id,
        serviceDate: completedCycle.service_date,
      };
    }
  }

  // Nothing to show at all
  if (!openCycle && !recentCompletion) return null;

  // ── 3. Build the open-cycle detail object ──
  let selectionCycle = null;
  if (openCycle) {
    const serviceCycle = await knex('service_cycles')
      .where('id', openCycle.service_cycle_id)
      .first();

    const business = serviceCycle
      ? await knex('businesses').where('id', serviceCycle.business_id).first()
      : null;

    const taskAssignments = await knex('task_assignments')
      .where('service_cycle_id', openCycle.service_cycle_id);
    const taskIds = taskAssignments.map(ta => ta.task_id);
    const availableTasks = taskIds.length > 0
      ? await knex('tasks').whereIn('id', taskIds)
      : [];

    const assignment = await knex('customer_cycle_assignments')
      .where('customer_id', customerId)
      .where('service_cycle_id', openCycle.service_cycle_id)
      .first();

    const totalHours = assignment ? assignment.total_hours : 0;

    // ── Resolve who is assigned to this customer's service day ──────────────
    const serviceAssignment = await knex('service_assignments')
      .where('selection_cycle_id', openCycle.id)
      .first();

    let assignedStaff = [];
    if (serviceAssignment) {
      if (serviceAssignment.team_member_id) {
        // A specific team member was assigned
        const member = await knex('team_members')
          .where('id', serviceAssignment.team_member_id)
          .first();
        if (member) assignedStaff = [{ id: member.id, name: member.name }];
      } else if (serviceAssignment.team_id) {
        // A whole team group was assigned — expand to individual members
        const members = await knex('team_memberships as tm')
          .join('team_members as m', 'tm.team_member_id', 'm.id')
          .where('tm.team_id', serviceAssignment.team_id)
          .select('m.id', 'm.name')
          .orderBy('m.name', 'asc');
        assignedStaff = members.map(m => ({ id: m.id, name: m.name }));
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Check whether the customer already submitted for THIS specific open cycle
    const previousSelection = await knex('selections')
      .where('selection_cycle_id', openCycle.id)
      .where('customer_id', customerId)
      .where('status', 'submitted')
      .first();

    selectionCycle = {
      id: openCycle.id,
      businessName: business ? business.name : null,
      serviceCycleName: serviceCycle ? serviceCycle.name : null,
      serviceDate: openCycle.service_date,
      submissionDeadline: openCycle.submission_deadline,
      status: openCycle.status,
      totalHours,
      totalMinutesAvailable: totalHours * 60,
      assignedStaff,
      availableTasks: availableTasks.map(t => ({
        id: t.id,
        name: t.name,
        timeAllotmentMinutes: t.time_allotment_minutes
      })),
      previousSelection: previousSelection ? {
        selectedTasks: previousSelection.selected_tasks,
        selectedTotalHours: previousSelection.selected_total_hours,
        submittedAt: previousSelection.submitted_at
      } : null
    };
  }

  return { selectionCycle, recentCompletion };
}

async function submitSelections(selectionCycleId, customerId, selectedTasks, selectedTotalHours) {
  const selectionCycle = await knex('selection_cycles')
    .where('id', selectionCycleId)
    .where('customer_id', customerId)
    .first();

  if (!selectionCycle) {
    const error = new Error('Selection cycle not found');
    error.code = 'SELECTION_CYCLE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const existingSubmission = await knex('selections')
    .where('selection_cycle_id', selectionCycleId)
    .where('customer_id', customerId)
    .where('status', 'submitted')
    .first();

  if (existingSubmission) {
    const error = new Error('Selections already submitted for this service date');
    error.code = 'ALREADY_SUBMITTED';
    error.statusCode = 409;
    error.details = { submittedAt: existingSubmission.submitted_at };
    throw error;
  }

  const assignment = await knex('customer_cycle_assignments')
    .where('customer_id', customerId)
    .where('service_cycle_id', selectionCycle.service_cycle_id)
    .first();

  const maxMinutes = assignment ? assignment.total_hours * 60 : 0;

  // Validate all selected tasks are available for this cycle
  const taskAssignments = await knex('task_assignments')
    .where('service_cycle_id', selectionCycle.service_cycle_id);
  const availableTaskIds = taskAssignments.map(ta => ta.task_id);

  for (const taskId of selectedTasks) {
    if (!availableTaskIds.includes(taskId)) {
      const error = new Error(`Task ${taskId} is not available for this service cycle`);
      error.code = 'INVALID_TASK';
      error.statusCode = 400;
      throw error;
    }
  }

  // Calculate total time and validate against limit
  const tasks = selectedTasks.length > 0
    ? await knex('tasks').whereIn('id', selectedTasks)
    : [];
  const totalMinutes = tasks.reduce((sum, t) => sum + t.time_allotment_minutes, 0);

  if (totalMinutes > maxMinutes) {
    const error = new Error(`Total time selected (${totalMinutes} mins) exceeds limit (${maxMinutes} mins)`);
    error.code = 'TIME_EXCEEDED';
    error.statusCode = 400;
    error.details = {
      availableMinutes: maxMinutes,
      selectedMinutes: totalMinutes,
      excessMinutes: totalMinutes - maxMinutes
    };
    throw error;
  }

  // Insert or update the selection record
  const existingDraft = await knex('selections')
    .where('selection_cycle_id', selectionCycleId)
    .where('customer_id', customerId)
    .first();

  let selection;
  if (existingDraft) {
    const updated = await knex('selections')
      .where('id', existingDraft.id)
      .update({
        selected_tasks: JSON.stringify(selectedTasks),
        selected_total_hours: selectedTotalHours,
        status: 'submitted',
        submitted_at: knex.raw('CURRENT_TIMESTAMP'),
        updated_at: knex.raw('CURRENT_TIMESTAMP')
      })
      .returning('*');
    selection = updated[0];
  } else {
    const inserted = await knex('selections')
      .insert({
        selection_cycle_id: selectionCycleId,
        customer_id: customerId,
        selected_tasks: JSON.stringify(selectedTasks),
        selected_total_hours: selectedTotalHours,
        status: 'submitted',
        submitted_at: knex.raw('CURRENT_TIMESTAMP'),
        created_at: knex.raw('CURRENT_TIMESTAMP'),
        updated_at: knex.raw('CURRENT_TIMESTAMP')
      })
      .returning('*');
    selection = inserted[0];
  }

  return { selection, serviceDate: selectionCycle.service_date };
}

async function getUpcomingServiceDates(customerId) {
  // All open cycles for this customer on or after today, ordered soonest first
  const cycles = await knex('selection_cycles')
    .where('customer_id', customerId)
    .where('status', 'open')
    .where('service_date', '>=', knex.raw('CURRENT_DATE'))
    .orderBy('service_date', 'asc');

  if (cycles.length === 0) return [];

  // Resolve business names in bulk
  const serviceCycleIds = [...new Set(cycles.map(c => c.service_cycle_id))];
  const serviceCycles = await knex('service_cycles').whereIn('id', serviceCycleIds);
  const businessIds = [...new Set(serviceCycles.map(sc => sc.business_id))];
  const businesses = await knex('businesses').whereIn('id', businessIds);

  const serviceCycleMap = Object.fromEntries(serviceCycles.map(sc => [sc.id, sc]));
  const businessMap = Object.fromEntries(businesses.map(b => [b.id, b]));

  // Resolve total hours per service cycle
  const hoursRows = await knex('customer_cycle_assignments')
    .where('customer_id', customerId)
    .whereIn('service_cycle_id', serviceCycleIds)
    .select('service_cycle_id', 'total_hours');
  const hoursMap = Object.fromEntries(hoursRows.map(r => [r.service_cycle_id, r.total_hours]));

  // Resolve available tasks for all service cycles in bulk
  const taskAssignments = await knex('task_assignments')
    .whereIn('service_cycle_id', serviceCycleIds)
    .select('service_cycle_id', 'task_id');
  const taskIds = [...new Set(taskAssignments.map(ta => ta.task_id))];
  const tasks = taskIds.length > 0 ? await knex('tasks').whereIn('id', taskIds) : [];
  const taskById = Object.fromEntries(tasks.map(t => [t.id, t]));

  // Group tasks by service_cycle_id
  const tasksByServiceCycle = {};
  taskAssignments.forEach(ta => {
    if (!tasksByServiceCycle[ta.service_cycle_id]) tasksByServiceCycle[ta.service_cycle_id] = [];
    const task = taskById[ta.task_id];
    if (task) {
      tasksByServiceCycle[ta.service_cycle_id].push({
        id: task.id,
        name: task.name,
        timeAllotmentMinutes: task.time_allotment_minutes,
      });
    }
  });

  // Check which cycles already have a submitted selection
  const cycleIds = cycles.map(c => c.id);
  const submissions = await knex('selections')
    .where('customer_id', customerId)
    .whereIn('selection_cycle_id', cycleIds)
    .where('status', 'submitted')
    .select('selection_cycle_id');
  const submittedSet = new Set(submissions.map(s => s.selection_cycle_id));

  return cycles.map(c => {
    const sc = serviceCycleMap[c.service_cycle_id];
    const business = sc ? businessMap[sc.business_id] : null;
    const totalHours = hoursMap[c.service_cycle_id] || 0;
    return {
      id: c.id,
      serviceDate: c.service_date,
      submissionDeadline: c.submission_deadline,
      businessName: business ? business.name : null,
      totalHours,
      totalMinutesAvailable: totalHours * 60,
      availableTasks: tasksByServiceCycle[c.service_cycle_id] || [],
      selectionSubmitted: submittedSet.has(c.id),
    };
  });
}

async function getSelectionHistory(customerId) {
  // 1. Collect submitted selections keyed by cycle id
  const submittedSelections = await knex('selections')
    .where('customer_id', customerId)
    .where('status', 'submitted')
    .select('selection_cycle_id', 'selected_tasks', 'selected_total_hours', 'submitted_at');

  const selectionByCycle = {};
  submittedSelections.forEach(s => { selectionByCycle[s.selection_cycle_id] = s; });
  const submittedCycleIds = submittedSelections.map(s => s.selection_cycle_id);

  // 2. Fetch all relevant cycles: completed ones + any that have a submitted selection
  const cycleQuery = knex('selection_cycles')
    .where('customer_id', customerId)
    .orderBy('service_date', 'desc');

  if (submittedCycleIds.length > 0) {
    cycleQuery.where(function () {
      this.where('status', 'completed').orWhereIn('id', submittedCycleIds);
    });
  } else {
    cycleQuery.where('status', 'completed');
  }

  const cycles = await cycleQuery;
  if (cycles.length === 0) return [];

  // 3. Resolve task names in a single query
  const allTaskIds = new Set();
  cycles.forEach(c => {
    const sel = selectionByCycle[c.id];
    if (sel) (sel.selected_tasks || []).forEach(id => allTaskIds.add(id));
  });

  const tasks = allTaskIds.size > 0
    ? await knex('tasks').whereIn('id', [...allTaskIds])
    : [];
  const taskMap = Object.fromEntries(tasks.map(t => [t.id, { name: t.name, minutes: t.time_allotment_minutes }]));

  // 4. Check feedback for completed cycles
  const completedIds = cycles.filter(c => c.status === 'completed').map(c => c.id);
  const feedbacks = completedIds.length > 0
    ? await knex('feedbacks')
        .where('customer_id', customerId)
        .whereIn('selection_cycle_id', completedIds)
        .select('selection_cycle_id')
    : [];
  const feedbackSet = new Set(feedbacks.map(f => f.selection_cycle_id));

  return cycles.map(c => {
    const sel = selectionByCycle[c.id] || null;
    const taskIds = sel ? (sel.selected_tasks || []) : [];
    return {
      selectionCycleId: c.id,
      serviceDate: c.service_date,
      status: c.status,
      selectedTasks: taskIds,
      selectedTaskNames: taskIds.map(id => taskMap[id]).filter(Boolean),
      selectedTotalHours: sel ? sel.selected_total_hours : null,
      submittedAt: sel ? sel.submitted_at : null,
      hasFeedback: feedbackSet.has(c.id),
    };
  });
}

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────

async function submitFeedback(customerId, selectionCycleId, text, photoFilenames) {
  const existing = await knex('feedbacks')
    .where('customer_id', customerId)
    .where('selection_cycle_id', selectionCycleId)
    .first();

  if (existing) {
    const updated = await knex('feedbacks')
      .where('id', existing.id)
      .update({
        feedback_text: text || null,
        photo_filenames: JSON.stringify(photoFilenames || []),
        updated_at: knex.raw('CURRENT_TIMESTAMP')
      })
      .returning('*');
    return updated[0];
  }

  const inserted = await knex('feedbacks')
    .insert({
      customer_id: customerId,
      selection_cycle_id: selectionCycleId,
      feedback_text: text || null,
      photo_filenames: JSON.stringify(photoFilenames || []),
      created_at: knex.raw('CURRENT_TIMESTAMP'),
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    })
    .returning('*');
  return inserted[0];
}

async function getFeedbackForCycle(customerId, selectionCycleId) {
  return await knex('feedbacks')
    .where('customer_id', customerId)
    .where('selection_cycle_id', selectionCycleId)
    .first() || null;
}

module.exports = {
  // Auth
  createCustomer,
  getCustomerById,
  getCustomerByPhone,
  // Selection Cycles
  getCurrentSelectionCycle,
  getUpcomingServiceDates,
  submitSelections,
  getSelectionHistory,
  // Feedback
  submitFeedback,
  getFeedbackForCycle
};
