/**
 * Auth hardening: limit team-member invite-code guesses.
 *
 * Invite codes are 6 digits and accept-invite takes a phone number + code, so
 * without a limit a code could be brute-forced. After 5 wrong guesses the
 * invite locks for 15 minutes (counter resets when the lock is set); the code
 * itself is unchanged, so the owner never has to re-share it.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('team_members', (table) => {
    table.integer('invite_failed_attempts').notNullable().defaultTo(0);
    table.timestamp('invite_locked_until', { useTz: true }).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('team_members', (table) => {
    table.dropColumn('invite_failed_attempts');
    table.dropColumn('invite_locked_until');
  });
};
