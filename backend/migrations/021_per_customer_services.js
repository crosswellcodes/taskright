// 021_per_customer_services — Component 1 of the per-customer service model.
// See shared/specs/SERVICE_MODEL.md.
//
// Cutover (additive + backfill; non-destructive — legacy selection_cycles.service_cycle_id
// is retained, nullable, until 022):
//   service_cycles              → service_templates          (business-global library)
//   customer_cycle_assignments  → customer_services          (per-customer SERVICE definition)
//   task_assignments            → template_task_assignments  (template menu; col → template_id)
//   + service_task_assignments  (per-service menu, backfilled from each service's template)
//   + selection_cycles.customer_service_id (backfilled; FK repointed off service_cycle_id)
//
// Constraint names below are the knex-default names from 001; Postgres keeps them
// across renameTable/renameColumn, so we drop/add by literal name via raw SQL.

exports.up = async function (knex) {
  // ══ 1. Rename the three core tables ══
  await knex.schema.renameTable('service_cycles', 'service_templates');
  await knex.schema.renameTable('customer_cycle_assignments', 'customer_services');
  await knex.schema.renameTable('task_assignments', 'template_task_assignments');

  // ══ 2. template_task_assignments: service_cycle_id → template_id ══
  // The FK + unique carry over by column reference (names stay stale but correct).
  await knex.raw('ALTER TABLE template_task_assignments RENAME COLUMN service_cycle_id TO template_id');

  // ══ 3. customer_services: promote to a full per-customer service definition ══
  // 3a. Drop old unique(customer_id, service_cycle_id) — a customer may now hold
  //     multiple independent services, including several seeded from one template.
  await knex.raw('ALTER TABLE customer_services DROP CONSTRAINT customer_cycle_assignments_customer_id_service_cycle_id_unique');
  // 3b. service_cycle_id → template_id, decoupled FK (nullable, ON DELETE SET NULL):
  //     deleting a template must never cascade into a live customer service.
  await knex.raw('ALTER TABLE customer_services DROP CONSTRAINT customer_cycle_assignments_service_cycle_id_foreign');
  await knex.raw('ALTER TABLE customer_services RENAME COLUMN service_cycle_id TO template_id');
  await knex.raw('ALTER TABLE customer_services ALTER COLUMN template_id DROP NOT NULL');
  await knex.raw('ALTER TABLE customer_services ADD CONSTRAINT customer_services_template_id_foreign FOREIGN KEY (template_id) REFERENCES service_templates(id) ON DELETE SET NULL');
  // 3c. Absorbed definition columns (nullable now; backfilled next).
  await knex.schema.alterTable('customer_services', (t) => {
    t.string('name', 255);
    t.string('frequency', 50);
    t.integer('days_before_service_deadline');
    t.integer('days_before_auto_repeat');
  });
  // 3d. Backfill the definition from each service's source template. Shared
  //     templates fan out automatically — one snapshot per customer_services row.
  await knex.raw(`
    UPDATE customer_services cs
    SET name = st.name,
        frequency = st.frequency,
        days_before_service_deadline = st.days_before_service_deadline,
        days_before_auto_repeat = st.days_before_auto_repeat
    FROM service_templates st
    WHERE cs.template_id = st.id
  `);

  // ══ 4. Per-service task menu (each service owns its own copy) ══
  await knex.schema.createTable('service_task_assignments', (t) => {
    t.increments('id').primary();
    t.integer('customer_service_id').notNullable().references('id').inTable('customer_services').onDelete('CASCADE');
    t.integer('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
    t.timestamps(true, true);
    t.unique(['customer_service_id', 'task_id']);
  });
  await knex.raw(`
    INSERT INTO service_task_assignments (customer_service_id, task_id, created_at, updated_at)
    SELECT cs.id, tta.task_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM customer_services cs
    JOIN template_task_assignments tta ON tta.template_id = cs.template_id
  `);

  // ══ 5. selection_cycles → point at the per-customer service ══
  await knex.schema.alterTable('selection_cycles', (t) => {
    t.integer('customer_service_id').nullable().references('id').inTable('customer_services').onDelete('CASCADE');
  });
  // Deterministic backfill: old UNIQUE(customer_id, service_cycle_id) on cca
  // guarantees exactly one customer_service per (customer_id, template_id).
  await knex.raw(`
    UPDATE selection_cycles sc
    SET customer_service_id = cs.id
    FROM customer_services cs
    WHERE cs.customer_id = sc.customer_id
      AND cs.template_id = sc.service_cycle_id
  `);
  // Retire the legacy FK + NOT NULL so the new code path can insert without
  // service_cycle_id. The column itself is dropped in 022 after cutover is verified.
  await knex.raw('ALTER TABLE selection_cycles DROP CONSTRAINT selection_cycles_service_cycle_id_foreign');
  await knex.raw('ALTER TABLE selection_cycles ALTER COLUMN service_cycle_id DROP NOT NULL');

  // ══ 6. Index the new hot join key ══
  await knex.raw('CREATE INDEX selection_cycles_customer_service_idx ON selection_cycles (customer_service_id)');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS selection_cycles_customer_service_idx');

  // selection_cycles: restore service_cycle_id as the live FK, drop customer_service_id.
  await knex.raw(`
    UPDATE selection_cycles sc
    SET service_cycle_id = cs.template_id
    FROM customer_services cs
    WHERE sc.customer_service_id = cs.id AND sc.service_cycle_id IS NULL
  `);
  await knex.schema.alterTable('selection_cycles', (t) => { t.dropColumn('customer_service_id'); });
  await knex.raw('ALTER TABLE selection_cycles ALTER COLUMN service_cycle_id SET NOT NULL');
  await knex.raw('ALTER TABLE selection_cycles ADD CONSTRAINT selection_cycles_service_cycle_id_foreign FOREIGN KEY (service_cycle_id) REFERENCES service_cycles(id) ON DELETE CASCADE');

  await knex.schema.dropTableIfExists('service_task_assignments');

  // customer_services → customer_cycle_assignments
  await knex.schema.alterTable('customer_services', (t) => {
    t.dropColumn('name');
    t.dropColumn('frequency');
    t.dropColumn('days_before_service_deadline');
    t.dropColumn('days_before_auto_repeat');
  });
  await knex.raw('ALTER TABLE customer_services DROP CONSTRAINT customer_services_template_id_foreign');
  await knex.raw('ALTER TABLE customer_services RENAME COLUMN template_id TO service_cycle_id');
  await knex.raw('ALTER TABLE customer_services ALTER COLUMN service_cycle_id SET NOT NULL');
  await knex.raw('ALTER TABLE customer_services ADD CONSTRAINT customer_cycle_assignments_service_cycle_id_foreign FOREIGN KEY (service_cycle_id) REFERENCES service_cycles(id) ON DELETE CASCADE');
  await knex.raw('ALTER TABLE customer_services ADD CONSTRAINT customer_cycle_assignments_customer_id_service_cycle_id_unique UNIQUE (customer_id, service_cycle_id)');

  await knex.raw('ALTER TABLE template_task_assignments RENAME COLUMN template_id TO service_cycle_id');

  await knex.schema.renameTable('template_task_assignments', 'task_assignments');
  await knex.schema.renameTable('customer_services', 'customer_cycle_assignments');
  await knex.schema.renameTable('service_templates', 'service_cycles');
};
