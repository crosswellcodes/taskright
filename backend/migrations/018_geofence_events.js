exports.up = function (knex) {
  return knex.schema.createTable('geofence_events', (table) => {
    table.increments('id').primary();
    table.integer('selection_cycle_id').notNullable().references('id').inTable('selection_cycles');
    table.integer('team_member_id').notNullable().references('id').inTable('team_members');
    table.string('event_type', 20).notNullable(); // 'arrival'|'departure'
    table.timestamp('occurred_at', { useTz: true }).notNullable();
    // Nullable: manual clock-in/out may have no GPS fix available. Auto events
    // always carry coordinates (enforced at the route layer).
    table.decimal('lat', 10, 7).nullable();
    table.decimal('lng', 10, 7).nullable();
    table.string('method', 20).notNullable(); // 'auto'|'manual'
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('geofence_events');
};
