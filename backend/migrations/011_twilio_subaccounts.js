exports.up = function (knex) {
  return knex.schema.alterTable('businesses', (table) => {
    // Twilio subaccount SID (AC...) — one per business
    table.string('twilio_subaccount_sid', 34).nullable();
    // Dedicated phone number for this business (E.164)
    table.string('twilio_phone_number', 20).nullable();
    // Messaging Service SID (MG...) — required for A2P 10DLC
    table.string('twilio_messaging_service_sid', 34).nullable();
    // Tracks whether automated provisioning succeeded
    // 'pending' | 'active' | 'failed' | 'dev_mode'
    table.string('twilio_provisioning_status', 20).notNullable().defaultTo('pending');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('businesses', (table) => {
    table.dropColumn('twilio_subaccount_sid');
    table.dropColumn('twilio_phone_number');
    table.dropColumn('twilio_messaging_service_sid');
    table.dropColumn('twilio_provisioning_status');
  });
};
