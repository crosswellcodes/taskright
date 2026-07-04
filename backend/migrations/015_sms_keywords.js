exports.up = async function (knex) {
  await knex.schema.table('customers', (t) => {
    t.string('pending_sms_action', 32).nullable(); // e.g. 'note_pending'
  });

  await knex.schema.table('selection_cycles', (t) => {
    t.text('customer_note').nullable();
    t.string('selection_token', 36).unique().nullable();
    t.timestamp('selection_token_expires_at').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('customers', (t) => {
    t.dropColumn('pending_sms_action');
  });

  await knex.schema.table('selection_cycles', (t) => {
    t.dropColumn('customer_note');
    t.dropColumn('selection_token');
    t.dropColumn('selection_token_expires_at');
  });
};
