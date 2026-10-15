/**
 * Web portal M4 (Messages): per-message read state for the unified inbox.
 *
 * `read_at` is only meaningful on inbound messages (customer → business); an
 * inbound row with read_at NULL is unread. Existing inbound history is
 * backfilled as read (read_at = created_at) so the inbox doesn't open with
 * every past message lit up. See shared/specs/WEB_PORTAL.md (M4).
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('messages', (table) => {
    table.timestamp('read_at', { useTz: true }).nullable();
  });

  await knex('messages')
    .where('direction', 'inbound')
    .update({ read_at: knex.ref('created_at') });

  // Unread lookups (inbox badges, Home Action Center) only touch this slice.
  await knex.raw(`
    CREATE INDEX messages_unread_inbound_idx
      ON messages (business_id, customer_id)
      WHERE direction = 'inbound' AND read_at IS NULL
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS messages_unread_inbound_idx');
  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('read_at');
  });
};
