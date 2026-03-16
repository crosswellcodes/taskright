exports.up = function(knex) {
  return knex.schema.alterTable('service_assignments', function(table) {
    // Allow team_member_id to be null (when a group is assigned instead)
    table.integer('team_member_id').nullable().alter();
    // New: optional team group assignment
    table.integer('team_id').nullable();
    table.foreign('team_id').references('id').inTable('teams').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('service_assignments', function(table) {
    table.dropForeign('team_id');
    table.dropColumn('team_id');
    table.integer('team_member_id').notNullable().alter();
  });
};
