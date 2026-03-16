exports.up = function(knex) {
  return knex.schema.alterTable('feedbacks', function(table) {
    table.text('business_notes').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('feedbacks', function(table) {
    table.dropColumn('business_notes');
  });
};
