exports.up = function(knex) {
  return knex.schema
    // 1. Businesses Table
    .createTable('businesses', function(table) {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('phone_number', 20).notNullable().unique();
      table.timestamps(true, true);
    })

    // 2. Customers Table
    .createTable('customers', function(table) {
      table.increments('id').primary();
      table.integer('business_id').notNullable();
      table.string('name', 255).notNullable();
      table.string('phone_number', 20).notNullable();
      table.timestamps(true, true);
      table.foreign('business_id')
        .references('id')
        .inTable('businesses')
        .onDelete('CASCADE');
    })

    // 3. Service Cycles Table
    .createTable('service_cycles', function(table) {
      table.increments('id').primary();
      table.integer('business_id').notNullable();
      table.string('name', 255).notNullable();
      table.string('frequency', 50).notNullable();
      table.integer('days_before_service_deadline').notNullable();
      table.integer('days_before_auto_repeat').notNullable();
      table.timestamps(true, true);
      table.foreign('business_id')
        .references('id')
        .inTable('businesses')
        .onDelete('CASCADE');
    })

    // 4. Customer Cycle Assignments Table
    .createTable('customer_cycle_assignments', function(table) {
      table.increments('id').primary();
      table.integer('customer_id').notNullable();
      table.integer('service_cycle_id').notNullable();
      table.integer('total_hours').notNullable();
      table.timestamps(true, true);
      table.foreign('customer_id')
        .references('id')
        .inTable('customers')
        .onDelete('CASCADE');
      table.foreign('service_cycle_id')
        .references('id')
        .inTable('service_cycles')
        .onDelete('CASCADE');
      table.unique(['customer_id', 'service_cycle_id']);
    })

    // 5. Tasks Table
    .createTable('tasks', function(table) {
      table.increments('id').primary();
      table.integer('business_id').notNullable();
      table.string('name', 255).notNullable();
      table.integer('time_allotment_minutes').notNullable();
      table.boolean('is_optional').defaultTo(true);
      table.timestamps(true, true);
      table.foreign('business_id')
        .references('id')
        .inTable('businesses')
        .onDelete('CASCADE');
    })

    // 6. Task Assignments Table
    .createTable('task_assignments', function(table) {
      table.increments('id').primary();
      table.integer('task_id').notNullable();
      table.integer('service_cycle_id').notNullable();
      table.timestamps(true, true);
      table.foreign('task_id')
        .references('id')
        .inTable('tasks')
        .onDelete('CASCADE');
      table.foreign('service_cycle_id')
        .references('id')
        .inTable('service_cycles')
        .onDelete('CASCADE');
      table.unique(['task_id', 'service_cycle_id']);
    })

    // 7. Selection Cycles Table
    .createTable('selection_cycles', function(table) {
      table.increments('id').primary();
      table.integer('service_cycle_id').notNullable();
      table.integer('customer_id').notNullable();
      table.date('service_date').notNullable();
      table.date('submission_deadline').notNullable();
      table.string('status', 50).defaultTo('open');
      table.timestamps(true, true);
      table.foreign('service_cycle_id')
        .references('id')
        .inTable('service_cycles')
        .onDelete('CASCADE');
      table.foreign('customer_id')
        .references('id')
        .inTable('customers')
        .onDelete('CASCADE');
    })

    // 8. Selections Table
    .createTable('selections', function(table) {
      table.increments('id').primary();
      table.integer('selection_cycle_id').notNullable();
      table.integer('customer_id').notNullable();
      table.jsonb('selected_tasks').notNullable();
      table.integer('selected_total_hours').notNullable();
      table.string('status', 50).defaultTo('draft');
      table.timestamp('submitted_at').nullable();
      table.timestamps(true, true);
      table.foreign('selection_cycle_id')
        .references('id')
        .inTable('selection_cycles')
        .onDelete('CASCADE');
      table.foreign('customer_id')
        .references('id')
        .inTable('customers')
        .onDelete('CASCADE');
    })

    // 9. Service Completions Table
    .createTable('service_completions', function(table) {
      table.increments('id').primary();
      table.integer('selection_cycle_id').notNullable();
      table.integer('customer_id').notNullable();
      table.timestamp('completed_at').notNullable();
      table.text('notes').nullable();
      table.timestamps(true, true);
      table.foreign('selection_cycle_id')
        .references('id')
        .inTable('selection_cycles')
        .onDelete('CASCADE');
      table.foreign('customer_id')
        .references('id')
        .inTable('customers')
        .onDelete('CASCADE');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('service_completions')
    .dropTableIfExists('selections')
    .dropTableIfExists('selection_cycles')
    .dropTableIfExists('task_assignments')
    .dropTableIfExists('tasks')
    .dropTableIfExists('customer_cycle_assignments')
    .dropTableIfExists('service_cycles')
    .dropTableIfExists('customers')
    .dropTableIfExists('businesses');
};