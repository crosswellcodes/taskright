// Review Requests (Component 1/3) — review_tokens table + feedbacks/customers columns.
// See shared/specs/REVIEW_REQUESTS.md. One token per job is enforced at the DB level
// via the unique constraint on selection_cycle_id (Rule 3 / cooldown = job cadence).
exports.up = async function (knex) {
  await knex.schema.createTable('review_tokens', (table) => {
    table.increments('id').primary();
    // Rule 3: one token per job — unique constraint enforces reuse on re-exit.
    table.integer('selection_cycle_id').notNullable().unique()
      .references('id').inTable('selection_cycles').onDelete('CASCADE');
    table.integer('customer_id').notNullable()
      .references('id').inTable('customers').onDelete('CASCADE');
    // Denormalized for routing (resolve business without a join at SMS time).
    table.integer('business_id').notNullable()
      .references('id').inTable('businesses').onDelete('CASCADE');
    table.string('token', 36).notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('sent_at', { useTz: true }).nullable();
    table.timestamp('opened_at', { useTz: true }).nullable();
    table.timestamp('submitted_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  });

  // feedbacks.source — distinguishes solicited SMS reviews from voluntary in-app feedback.
  // Default 'in_app' so all existing rows read correctly without a backfill.
  await knex.schema.alterTable('feedbacks', (table) => {
    table.string('source', 20).notNullable().defaultTo('in_app'); // 'in_app' | 'sms_request'
    // rating — the /review page captures a 1–5 star rating; feedbacks had no column
    // for it (only feedback_text). Nullable: in-app feedback carries no star rating.
    table.smallint('rating').nullable();
  });

  // customers.review_requests_opted_out — owner-controlled suppression (Rule 2/7).
  await knex.schema.alterTable('customers', (table) => {
    table.boolean('review_requests_opted_out').notNullable().defaultTo(false);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('review_tokens');
  await knex.schema.alterTable('feedbacks', (table) => {
    table.dropColumn('source');
    table.dropColumn('rating');
  });
  await knex.schema.alterTable('customers', (table) => {
    table.dropColumn('review_requests_opted_out');
  });
};
