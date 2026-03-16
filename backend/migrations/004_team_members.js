exports.up = function(knex) {
  return knex.schema.createTable('team_members', function(table) {
    table.increments('id').primary();
    table.integer('business_id').notNullable();
    table.string('name', 255).notNullable();
    table.string('phone_number', 20).notNullable();
    table.integer('weekly_hours').notNullable();
    table.timestamps(true, true);
    table.foreign('business_id')
      .references('id')
      .inTable('businesses')
      .onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('team_members');
};
