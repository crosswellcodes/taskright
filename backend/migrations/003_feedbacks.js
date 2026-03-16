exports.up = function(knex) {
  return knex.schema.createTable('feedbacks', function(table) {
    table.increments('id').primary();
    table.integer('customer_id').notNullable();
    table.integer('selection_cycle_id').nullable();
    table.text('feedback_text').nullable();
    table.jsonb('photo_filenames').notNullable().defaultTo('[]');
    table.timestamps(true, true);
    table.foreign('customer_id')
      .references('id')
      .inTable('customers')
      .onDelete('CASCADE');
    table.foreign('selection_cycle_id')
      .references('id')
      .inTable('selection_cycles')
      .onDelete('SET NULL');
    table.unique(['customer_id', 'selection_cycle_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('feedbacks');
};
