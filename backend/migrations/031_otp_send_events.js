/**
 * Auth hardening: app-level rate limit on texted verification codes.
 *
 * POST /api/auth/verify/send is public by design, so without a limit anyone can
 * make us text arbitrary numbers (SMS pumping / cost abuse). One row per code we
 * actually texted; the limiter counts rows per phone and per client IP over
 * sliding windows (services/otpRateLimit.js). Kept in Postgres, not memory, so the
 * limit holds across backend processes. Rows older than a day are pruned on write.
 *
 * otp_codes can't serve as the counter: it keeps only the latest code per phone.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('otp_send_events', (table) => {
    table.increments('id').primary();
    table.string('phone', 20).notNullable();  // E.164
    table.string('ip', 64).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['phone', 'created_at']);
    table.index(['ip', 'created_at']);
    table.index(['created_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('otp_send_events');
};
