exports.up = function(knex) {
  return knex.schema.alterTable('customers', function(table) {
    table.string('email', 255).nullable();
    table.text('address').nullable();
    table.text('notes').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('customers', function(table) {
    table.dropColumn('email');
    table.dropColumn('address');
    table.dropColumn('notes');
  });
};
