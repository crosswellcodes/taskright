exports.up = function(knex) {
  return knex.schema
    .alterTable('businesses', function(table) {
      table.string('scheduling_format', 20).notNullable().defaultTo('date_based');
    })
    .alterTable('customer_cycle_assignments', function(table) {
      table.integer('day_of_week').nullable(); // 0=Sun … 6=Sat; null for date_based businesses
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('businesses', function(table) {
      table.dropColumn('scheduling_format');
    })
    .alterTable('customer_cycle_assignments', function(table) {
      table.dropColumn('day_of_week');
    });
};
