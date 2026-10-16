/**
 * Web portal time-zone correctness: each business operates in one IANA zone.
 *
 * "Today" (Home's Today/week strip/past-deadline/month-to-date, the portal's
 * calendar defaults and every rendered clock time) is the business's operating
 * day, not the server's UTC day. Existing rows take the default — the dev
 * business is in Lincoln, NE. No edit UI yet (Account, M7, is on hold).
 * See shared/specs/WEB_PORTAL.md ("Time zones").
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('businesses', (table) => {
    table.string('timezone', 64).notNullable().defaultTo('America/Chicago');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('businesses', (table) => {
    table.dropColumn('timezone');
  });
};
