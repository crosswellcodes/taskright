exports.up = function (knex) {
  return knex.schema.table('businesses', (table) => {
    table.string('entity_type', 20).notNullable().defaultTo('sole_prop');
    table.string('contact_first_name', 100).nullable();
    table.string('contact_last_name', 100).nullable();
    table.string('contact_email', 255).nullable();
    table.string('business_street', 255).nullable();
    table.string('business_city', 100).nullable();
    table.string('business_state', 2).nullable();
    table.string('business_zip', 10).nullable();
    table.string('a2p_brand_sid', 50).nullable();
    table.string('a2p_campaign_sid', 50).nullable();
    table.string('a2p_registration_status', 20).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.table('businesses', (table) => {
    table.dropColumn('entity_type');
    table.dropColumn('contact_first_name');
    table.dropColumn('contact_last_name');
    table.dropColumn('contact_email');
    table.dropColumn('business_street');
    table.dropColumn('business_city');
    table.dropColumn('business_state');
    table.dropColumn('business_zip');
    table.dropColumn('a2p_brand_sid');
    table.dropColumn('a2p_campaign_sid');
    table.dropColumn('a2p_registration_status');
  });
};
