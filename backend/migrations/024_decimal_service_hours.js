// 024_decimal_service_hours — total_hours (customer_services) and
// selected_total_hours (selections) were `integer`, so any fractional hours
// (e.g. 1.5h per visit, or a 45-min task totalling 0.75h) threw
// "invalid input syntax for type integer" and surfaced as a 500 on service
// create / selection submit. Widen both to numeric(6,2). integer→numeric is
// lossless. (The prior "024 reserved" note from the Phase 2 spec is released —
// the single 023 cutover shipped, so 024 is free.)

exports.up = async function (knex) {
  await knex.raw('ALTER TABLE customer_services ALTER COLUMN total_hours TYPE numeric(6,2)');
  await knex.raw('ALTER TABLE selections ALTER COLUMN selected_total_hours TYPE numeric(6,2)');
};

exports.down = async function (knex) {
  // Lossy: any fractional hours round to the nearest integer on the way back.
  await knex.raw('ALTER TABLE customer_services ALTER COLUMN total_hours TYPE integer USING round(total_hours)');
  await knex.raw('ALTER TABLE selections ALTER COLUMN selected_total_hours TYPE integer USING round(selected_total_hours)');
};
