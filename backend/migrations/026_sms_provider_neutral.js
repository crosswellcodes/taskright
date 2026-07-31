/**
 * P1 of the Twilio → SignalHouse migration: make the SMS columns provider-neutral.
 *
 * Pre-launch, there are no live business rows to migrate, so these are clean renames.
 * See shared/specs/SIGNALHOUSE_MIGRATION.md §3.
 *
 * Deliberately NOT dropped here (reference §8 lists it as the end-state DROP):
 *   businesses.twilio_messaging_service_sid — Twilio sends via a Messaging Service,
 *   so TwilioProvider still reads this column to send + to detect dev-mode while the
 *   dual-provider window is open. It is dropped at P6, once Twilio is fully retired.
 *   (SignalHouse sends by number and never populates it.)
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('businesses', (table) => {
    table.renameColumn('twilio_subaccount_sid', 'sms_subgroup_id');
    table.renameColumn('twilio_phone_number', 'sms_phone_number');
    table.renameColumn('twilio_provisioning_status', 'sms_provisioning_status');
    table.renameColumn('a2p_brand_sid', 'sms_brand_id');
    table.renameColumn('a2p_campaign_sid', 'sms_campaign_id');
  });

  await knex.schema.alterTable('businesses', (table) => {
    // 10DLC brand vertical. Approved default: PROFESSIONAL for all (not collected at
    // signup in v1). Nullable so a real vertical can override later.
    table.string('vertical', 40).nullable().defaultTo('PROFESSIONAL');
    // Per-business provider pin. Stamped at provision time so send/inbound routing
    // picks the right client in a mixed fleet. Defaults to the current provider.
    table.string('sms_provider', 20).notNullable().defaultTo('twilio');
  });

  await knex.schema.alterTable('messages', (table) => {
    table.renameColumn('twilio_message_sid', 'sms_message_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('messages', (table) => {
    table.renameColumn('sms_message_id', 'twilio_message_sid');
  });

  await knex.schema.alterTable('businesses', (table) => {
    table.dropColumn('vertical');
    table.dropColumn('sms_provider');
  });

  await knex.schema.alterTable('businesses', (table) => {
    table.renameColumn('sms_subgroup_id', 'twilio_subaccount_sid');
    table.renameColumn('sms_phone_number', 'twilio_phone_number');
    table.renameColumn('sms_provisioning_status', 'twilio_provisioning_status');
    table.renameColumn('sms_brand_id', 'a2p_brand_sid');
    table.renameColumn('sms_campaign_id', 'a2p_campaign_sid');
  });
};
