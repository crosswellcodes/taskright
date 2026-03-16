exports.up = function(knex) {
  return knex.schema.createTable('service_assignments', function(table) {
    table.increments('id').primary();
    table.integer('business_id').notNullable();
    table.integer('selection_cycle_id').notNullable().unique();
    table.integer('team_member_id').notNullable();
    table.timestamps(true, true);
    table.foreign('business_id')
      .references('id')
      .inTable('businesses')
      .onDelete('CASCADE');
    table.foreign('selection_cycle_id')
      .references('id')
      .inTable('selection_cycles')
      .onDelete('CASCADE');
    table.foreign('team_member_id')
      .references('id')
      .inTable('team_members')
      .onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('service_assignments');
};
