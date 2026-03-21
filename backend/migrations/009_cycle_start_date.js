exports.up = function(knex) {
  return knex.schema.alterTable('customer_cycle_assignments', function(table) {
    table.date('start_date').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('customer_cycle_assignments', function(table) {
    table.dropColumn('start_date');
  });
};
