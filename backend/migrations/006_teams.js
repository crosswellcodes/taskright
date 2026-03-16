exports.up = function(knex) {
  return knex.schema
    .createTable('teams', function(table) {
      table.increments('id').primary();
      table.integer('business_id').notNullable();
      table.string('name').notNullable();
      table.timestamps(true, true);
      table.foreign('business_id').references('id').inTable('businesses').onDelete('CASCADE');
    })
    .createTable('team_memberships', function(table) {
      table.increments('id').primary();
      table.integer('team_id').notNullable();
      table.integer('team_member_id').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['team_id', 'team_member_id']);
      table.foreign('team_id').references('id').inTable('teams').onDelete('CASCADE');
      table.foreign('team_member_id').references('id').inTable('team_members').onDelete('CASCADE');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('team_memberships')
    .dropTableIfExists('teams');
};
