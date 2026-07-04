exports.up = function(knex) {
  return knex.schema.alterTable('team_members', function(table) {
    table.string('invite_code', 6).nullable();
    table.boolean('invite_accepted').notNullable().defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('team_members', function(table) {
    table.dropColumn('invite_code');
    table.dropColumn('invite_accepted');
  });
};
