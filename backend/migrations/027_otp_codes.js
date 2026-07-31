/**
 * P5 of the Twilio → SignalHouse migration: self-built OTP store.
 *
 * SignalHouse has no Verify product, so we generate/store/check codes ourselves.
 * Codes are stored HASHED (HMAC-SHA256), short-lived, single-use, attempt-limited.
 * See shared/specs/SIGNALHOUSE_MIGRATION.md §6.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('otp_codes', (table) => {
    table.increments('id').primary();
    table.string('phone', 20).notNullable().index(); // E.164
    table.string('code_hash', 128).notNullable();     // HMAC-SHA256 hex — never the raw code
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('consumed_at', { useTz: true }).nullable();
    table.integer('attempts').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('otp_codes');
};
