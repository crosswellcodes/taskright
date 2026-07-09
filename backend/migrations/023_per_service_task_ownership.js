// 023_per_service_task_ownership — Phase 2 of the per-customer service model
// (see shared/specs/SERVICE_TASK_OWNERSHIP.md). Single cutover: retire the
// business-global `tasks` table and its two junctions, making tasks OWNED
// per-service (`service_tasks`) and per-template (`template_tasks`).
//
// Order: additive → backfill → remap selections.selected_tasks → drop.
// Runs on both task_app_db and task_app_test. 024 stays reserved.
//
// down() is best-effort and DOCUMENTED LOSSY: it recreates a global `tasks`
// table by de-duplicating (business_id, name, time) out of the owned rows, so
// original task ids are NOT restored. Re-running up() from the rebuilt state is
// safe; exact historical task-id identity is not.

exports.up = async function (knex) {
  // 1. service_tasks — a task owned by exactly one customer_services row.
  //    Carries a temporary source_task_id (no FK) used only for the remap below.
  await knex.schema.createTable('service_tasks', (t) => {
    t.increments('id').primary();
    t.integer('customer_service_id').notNullable()
      .references('id').inTable('customer_services').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.integer('time_allotment_minutes').notNullable();
    t.boolean('is_optional').defaultTo(true);
    t.integer('source_task_id').nullable(); // temp — dropped at end of up()
    t.timestamps(true, true);
  });

  // 2. template_tasks — a task owned by one service_templates row (blueprint).
  await knex.schema.createTable('template_tasks', (t) => {
    t.increments('id').primary();
    t.integer('template_id').notNullable()
      .references('id').inTable('service_templates').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.integer('time_allotment_minutes').notNullable();
    t.boolean('is_optional').defaultTo(true);
    t.timestamps(true, true);
  });

  // 3. Backfill service_tasks — one row per service_task_assignments entry,
  //    copying the task's name/time/is_optional and stamping source_task_id.
  await knex.raw(`
    INSERT INTO service_tasks
      (customer_service_id, name, time_allotment_minutes, is_optional, source_task_id, created_at, updated_at)
    SELECT sta.customer_service_id, t.name, t.time_allotment_minutes, t.is_optional, t.id,
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM service_task_assignments sta
    JOIN tasks t ON t.id = sta.task_id
  `);

  // 4. Backfill template_tasks from template_task_assignments.
  await knex.raw(`
    INSERT INTO template_tasks
      (template_id, name, time_allotment_minutes, is_optional, created_at, updated_at)
    SELECT tta.template_id, t.name, t.time_allotment_minutes, t.is_optional,
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM template_task_assignments tta
    JOIN tasks t ON t.id = tta.task_id
  `);

  // 5. Remap selections.selected_tasks: global task_id -> service_tasks.id.
  //    For each selection resolve its service (via selection_cycles), build a
  //    {source_task_id -> service_tasks.id} map for that service, and rewrite
  //    the array. Ids no longer on the menu (task removed post-selection) are
  //    dropped — cosmetic only, since selected_total_hours is stored on the row.
  const selections = await knex('selections')
    .join('selection_cycles', 'selections.selection_cycle_id', 'selection_cycles.id')
    .select('selections.id as id', 'selections.selected_tasks as selected_tasks',
            'selection_cycles.customer_service_id as customer_service_id');

  for (const sel of selections) {
    let arr = sel.selected_tasks;
    if (typeof arr === 'string') {
      try { arr = JSON.parse(arr); } catch (e) { arr = null; }
    }
    if (!Array.isArray(arr) || arr.length === 0) continue;

    const owned = await knex('service_tasks')
      .where('customer_service_id', sel.customer_service_id)
      .select('id', 'source_task_id');
    const map = {};
    owned.forEach((r) => { if (r.source_task_id != null) map[r.source_task_id] = r.id; });

    const remapped = arr.map((oldId) => map[oldId]).filter((x) => x != null);
    await knex('selections').where('id', sel.id)
      .update({ selected_tasks: JSON.stringify(remapped) });
  }

  // 6. Drop the junctions and the global tasks table, then drop the temp column.
  await knex.schema.dropTableIfExists('service_task_assignments');
  await knex.schema.dropTableIfExists('template_task_assignments');
  await knex.schema.dropTableIfExists('tasks');
  await knex.schema.alterTable('service_tasks', (t) => {
    t.dropColumn('source_task_id');
  });

  // 7. Indexes for the owning-FK lookups.
  await knex.schema.alterTable('service_tasks', (t) => {
    t.index('customer_service_id', 'service_tasks_customer_service_id_index');
  });
  await knex.schema.alterTable('template_tasks', (t) => {
    t.index('template_id', 'template_tasks_template_id_index');
  });
};

exports.down = async function (knex) {
  // Best-effort, LOSSY reconstruction of the pre-023 global model. Task ids are
  // de-duplicated by (business_id, name, time_allotment_minutes); original ids
  // are not restored.

  // 1. Recreate the global tasks table.
  await knex.schema.createTable('tasks', (t) => {
    t.increments('id').primary();
    t.integer('business_id').notNullable()
      .references('id').inTable('businesses').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.integer('time_allotment_minutes').notNullable();
    t.boolean('is_optional').defaultTo(true);
    t.timestamps(true, true);
  });

  // 2. Repopulate tasks: distinct (business_id, name, time, is_optional) across
  //    both owned tables. business_id resolves via the owning row.
  await knex.raw(`
    INSERT INTO tasks (business_id, name, time_allotment_minutes, is_optional, created_at, updated_at)
    SELECT DISTINCT business_id, name, time_allotment_minutes, is_optional,
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM (
      SELECT c.business_id AS business_id, st.name, st.time_allotment_minutes, st.is_optional
      FROM service_tasks st
      JOIN customer_services cs ON cs.id = st.customer_service_id
      JOIN customers c ON c.id = cs.customer_id
      UNION
      SELECT tpl.business_id AS business_id, tt.name, tt.time_allotment_minutes, tt.is_optional
      FROM template_tasks tt
      JOIN service_templates tpl ON tpl.id = tt.template_id
    ) src
  `);

  // 3. Recreate the two junctions.
  await knex.schema.createTable('service_task_assignments', (t) => {
    t.increments('id').primary();
    t.integer('customer_service_id').notNullable()
      .references('id').inTable('customer_services').onDelete('CASCADE');
    t.integer('task_id').notNullable()
      .references('id').inTable('tasks').onDelete('CASCADE');
    t.timestamps(true, true);
    t.unique(['customer_service_id', 'task_id']);
  });
  await knex.schema.createTable('template_task_assignments', (t) => {
    t.increments('id').primary();
    t.integer('template_id').notNullable()
      .references('id').inTable('service_templates').onDelete('CASCADE');
    t.integer('task_id').notNullable()
      .references('id').inTable('tasks').onDelete('CASCADE');
    t.timestamps(true, true);
    t.unique(['task_id', 'template_id']);
  });

  // 4. Rebuild assignments by matching owned rows back to the deduped tasks.
  await knex.raw(`
    INSERT INTO service_task_assignments (customer_service_id, task_id, created_at, updated_at)
    SELECT DISTINCT st.customer_service_id, t.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM service_tasks st
    JOIN customer_services cs ON cs.id = st.customer_service_id
    JOIN customers c ON c.id = cs.customer_id
    JOIN tasks t ON t.business_id = c.business_id
      AND t.name = st.name AND t.time_allotment_minutes = st.time_allotment_minutes
  `);
  await knex.raw(`
    INSERT INTO template_task_assignments (template_id, task_id, created_at, updated_at)
    SELECT DISTINCT tt.template_id, t.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM template_tasks tt
    JOIN service_templates tpl ON tpl.id = tt.template_id
    JOIN tasks t ON t.business_id = tpl.business_id
      AND t.name = tt.name AND t.time_allotment_minutes = tt.time_allotment_minutes
  `);

  // 5. Remap selections.selected_tasks back: service_tasks.id -> tasks.id.
  const selections = await knex('selections')
    .join('selection_cycles', 'selections.selection_cycle_id', 'selection_cycles.id')
    .select('selections.id as id', 'selections.selected_tasks as selected_tasks',
            'selection_cycles.customer_service_id as customer_service_id');

  for (const sel of selections) {
    let arr = sel.selected_tasks;
    if (typeof arr === 'string') {
      try { arr = JSON.parse(arr); } catch (e) { arr = null; }
    }
    if (!Array.isArray(arr) || arr.length === 0) continue;

    const rows = await knex('service_tasks as st')
      .join('customer_services as cs', 'cs.id', 'st.customer_service_id')
      .join('customers as c', 'c.id', 'cs.customer_id')
      .join('tasks as t', function () {
        this.on('t.business_id', 'c.business_id')
          .andOn('t.name', 'st.name')
          .andOn('t.time_allotment_minutes', 'st.time_allotment_minutes');
      })
      .where('st.customer_service_id', sel.customer_service_id)
      .select('st.id as service_task_id', 't.id as task_id');
    const map = {};
    rows.forEach((r) => { map[r.service_task_id] = r.task_id; });

    const remapped = arr.map((id) => map[id]).filter((x) => x != null);
    await knex('selections').where('id', sel.id)
      .update({ selected_tasks: JSON.stringify(remapped) });
  }

  // 6. Drop the owned tables.
  await knex.schema.dropTableIfExists('service_tasks');
  await knex.schema.dropTableIfExists('template_tasks');
};
