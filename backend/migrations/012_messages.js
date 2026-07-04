exports.up = function (knex) {
  return knex.schema.createTable('messages', (table) => {
    table.increments('id').primary();
    table.integer('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    // customer_id nullable — inbound messages may come from unknown numbers
    table.integer('customer_id').nullable().references('id').inTable('customers').onDelete('SET NULL');
    // 'inbound' = customer texted the business
    // 'outbound' = TaskRight sent to customer on behalf of business
    table.string('direction', 10).notNullable();
    table.text('body').notNullable();
    // Twilio message SID for deduplication and status tracking
    table.string('twilio_message_sid', 34).nullable();
    // Raw phone numbers preserved for audit trail
    table.string('to_phone', 20).nullable();
    table.string('from_phone', 20).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));

    table.index(['business_id', 'customer_id', 'created_at'], 'messages_business_customer_idx');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('messages');
};
