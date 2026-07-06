// 022_service_model_cleanup — enforce + cleanup step of the per-customer service
// model (see shared/specs/SERVICE_MODEL.md §4). Destructive; run only after the
// 021 code cutover is verified. Backfill from 021 guarantees every selection_cycle
// has a customer_service_id, so the NOT NULL enforcement is safe.

exports.up = async function (knex) {
  // The new per-customer-service FK is now mandatory.
  await knex.raw('ALTER TABLE selection_cycles ALTER COLUMN customer_service_id SET NOT NULL');
  // Retire the legacy pointer to the (now template) table. All reads/writes use
  // customer_service_id after the 021 cutover.
  await knex.schema.alterTable('selection_cycles', (t) => {
    t.dropColumn('service_cycle_id');
  });
};

exports.down = async function (knex) {
  // Re-add the legacy column and backfill from each Service's template provenance.
  await knex.schema.alterTable('selection_cycles', (t) => {
    t.integer('service_cycle_id').nullable();
  });
  await knex.raw(`
    UPDATE selection_cycles sc
    SET service_cycle_id = cs.template_id
    FROM customer_services cs
    WHERE sc.customer_service_id = cs.id
  `);
  await knex.raw('ALTER TABLE selection_cycles ALTER COLUMN customer_service_id DROP NOT NULL');
  // Note: FK on service_cycle_id is intentionally not restored here — 021.down
  // handles the full FK/rename restoration if rolling back further.
};
