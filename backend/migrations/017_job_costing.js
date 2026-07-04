exports.up = async function (knex) {
  // cost_categories table with GAAP seed data
  await knex.schema.createTable('cost_categories', (table) => {
    table.increments('id').primary();
    table.integer('business_id').references('id').inTable('businesses').nullable();
    table.integer('code').notNullable();
    table.string('name', 100).notNullable();
    table.string('type', 20).notNullable(); // 'labor'|'materials'|'overhead'|'revenue'
    table.boolean('is_system').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  });

  await knex('cost_categories').insert([
    { business_id: null, code: 4000, name: 'Service Revenue',      type: 'revenue',   is_system: true },
    { business_id: null, code: 5000, name: 'Direct Labor',         type: 'labor',     is_system: true },
    { business_id: null, code: 5100, name: 'Materials / Supplies', type: 'materials', is_system: true },
    { business_id: null, code: 5200, name: 'Job Overhead',         type: 'overhead',  is_system: true },
  ]);

  // job_costs table
  await knex.schema.createTable('job_costs', (table) => {
    table.increments('id').primary();
    table.integer('selection_cycle_id').notNullable().references('id').inTable('selection_cycles');
    table.integer('cost_category_id').notNullable().references('id').inTable('cost_categories');
    table.decimal('amount', 10, 2).notNullable();
    table.integer('team_member_id').references('id').inTable('team_members').nullable();
    table.decimal('hours_actual', 5, 2).nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  });

  // New columns on existing tables
  await knex.schema.table('team_members', (table) => {
    table.decimal('hourly_rate', 8, 2).nullable();
  });

  await knex.schema.table('customers', (table) => {
    table.decimal('lat', 10, 7).nullable();
    table.decimal('lng', 10, 7).nullable();
    table.timestamp('geocoded_at', { useTz: true }).nullable();
  });

  await knex.schema.table('customer_cycle_assignments', (table) => {
    table.decimal('price_per_visit', 8, 2).nullable();
  });

  await knex.schema.table('selection_cycles', (table) => {
    table.decimal('price', 8, 2).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('selection_cycles', (table) => {
    table.dropColumn('price');
  });
  await knex.schema.table('customer_cycle_assignments', (table) => {
    table.dropColumn('price_per_visit');
  });
  await knex.schema.table('customers', (table) => {
    table.dropColumn('lat');
    table.dropColumn('lng');
    table.dropColumn('geocoded_at');
  });
  await knex.schema.table('team_members', (table) => {
    table.dropColumn('hourly_rate');
  });
  await knex.schema.dropTableIfExists('job_costs');
  await knex.schema.dropTableIfExists('cost_categories');
};
