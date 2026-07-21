exports.up = async function (knex) {
  await knex.schema.table('customers', (table) => {
    // How many times we've attempted to geocode the current address. Reset to 0
    // whenever the address changes (updateCustomerDetails). Caps the retry loop.
    table.integer('geocode_attempts').notNullable().defaultTo(0);
    table.timestamp('geocode_attempted_at', { useTz: true }).nullable();
    // Best candidate's Mapbox relevance (0.00–1.00). Below GEOCODE_MIN_RELEVANCE we
    // record it but refuse to store the coords (a confident-wrong match is worse
    // than manual tracking).
    table.decimal('geocode_relevance', 3, 2).nullable();
  });

  // The two known low-confidence rows (test data "Edgeworth" / "Main Street West")
  // got fuzzy coords from the July 20 backfill. Null them so the new relevance gate
  // re-evaluates them on the next sweep instead of trusting a bad pin.
  await knex('customers')
    .whereIn('id', [13, 15])
    .whereNull('geocode_relevance')
    .update({ lat: null, lng: null, geocoded_at: null });
};

exports.down = async function (knex) {
  await knex.schema.table('customers', (table) => {
    table.dropColumn('geocode_attempts');
    table.dropColumn('geocode_attempted_at');
    table.dropColumn('geocode_relevance');
  });
};
