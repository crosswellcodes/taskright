// 019_job_costing_integrity — pre-UI data-model hardening for job costing.
// Encodes decisions D1 (labor source), D2 (price backfill), D3 (individual-only
// v1 needs no schema change) plus the integrity/perf hygiene from
// shared/specs/JOB_COSTING_DATA_GAPS.md Part 2.
//
// Cross-table rule NOT enforced here: "labor lines require team_member_id +
// hours_actual non-null" spans job_costs → cost_categories and is not a plain
// CHECK. It stays app-level (costs service) for v1, by decision.

exports.up = async function (knex) {
  // ── D1: distinguish auto-tracked labor from owner-corrected labor ──────────
  // Geofence recompute skips source='manual'; POST/PATCH /costs stamp 'manual'.
  await knex.schema.table('job_costs', (table) => {
    table.string('source', 10).notNullable().defaultTo('auto'); // 'auto' | 'manual'
  });

  // ── D2: backfill price on existing OPEN cycles from the customer's assignment.
  // Going forward, generateUpcomingSelectionCycles() copies price at creation
  // time; this catches cycles created before that logic existed.
  await knex.raw(`
    UPDATE selection_cycles sc
    SET price = cca.price_per_visit
    FROM customer_cycle_assignments cca
    WHERE cca.customer_id = sc.customer_id
      AND cca.service_cycle_id = sc.service_cycle_id
      AND cca.price_per_visit IS NOT NULL
      AND sc.price IS NULL
      AND sc.status = 'open'
  `);

  // ── Rule 6 at the DB: at most one labor row per member per job. Partial so
  // non-labor rows (team_member_id NULL) are exempt.
  await knex.raw(`
    CREATE UNIQUE INDEX job_costs_member_job_category_unique
    ON job_costs (selection_cycle_id, team_member_id, cost_category_id)
    WHERE team_member_id IS NOT NULL
  `);

  // ── Perf: recompute pulls all events for a member+job ordered by occurred_at;
  // the profitability aggregate scans job_costs by cycle.
  await knex.raw(`
    CREATE INDEX geofence_events_member_job_time_idx
    ON geofence_events (selection_cycle_id, team_member_id, occurred_at)
  `);
  await knex.raw(`
    CREATE INDEX job_costs_selection_cycle_idx
    ON job_costs (selection_cycle_id)
  `);

  // ── cost_categories uniqueness. The labor lookup assumes exactly one
  // (code=5000, is_system=true) system row. Enforce one code per scope:
  //   system scope  → unique(code) where business_id IS NULL
  //   custom scope   → unique(business_id, code) where business_id IS NOT NULL
  await knex.raw(`
    CREATE UNIQUE INDEX cost_categories_system_code_unique
    ON cost_categories (code)
    WHERE business_id IS NULL
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX cost_categories_business_code_unique
    ON cost_categories (business_id, code)
    WHERE business_id IS NOT NULL
  `);

  // ── FK ON DELETE behavior (previously undefined → default RESTRICT).
  // job_costs: cost lines belong to the job (CASCADE); preserve the dollar
  // amount when a member is removed (SET NULL — column already nullable);
  // categories are seed data (leave RESTRICT).
  await knex.schema.table('job_costs', (table) => {
    table.dropForeign('selection_cycle_id');
    table.dropForeign('team_member_id');
    table.foreign('selection_cycle_id').references('id').inTable('selection_cycles').onDelete('CASCADE');
    table.foreign('team_member_id').references('id').inTable('team_members').onDelete('SET NULL');
  });

  // geofence_events: raw telemetry — CASCADE on both. The derived labor cost
  // survives member deletion via the job_costs SET NULL above (keep the money,
  // drop the pings).
  await knex.schema.table('geofence_events', (table) => {
    table.dropForeign('selection_cycle_id');
    table.dropForeign('team_member_id');
    table.foreign('selection_cycle_id').references('id').inTable('selection_cycles').onDelete('CASCADE');
    table.foreign('team_member_id').references('id').inTable('team_members').onDelete('CASCADE');
  });
};

exports.down = async function (knex) {
  // Restore FKs to their original (no explicit ON DELETE) form.
  await knex.schema.table('geofence_events', (table) => {
    table.dropForeign('selection_cycle_id');
    table.dropForeign('team_member_id');
    table.foreign('selection_cycle_id').references('id').inTable('selection_cycles');
    table.foreign('team_member_id').references('id').inTable('team_members');
  });
  await knex.schema.table('job_costs', (table) => {
    table.dropForeign('selection_cycle_id');
    table.dropForeign('team_member_id');
    table.foreign('selection_cycle_id').references('id').inTable('selection_cycles');
    table.foreign('team_member_id').references('id').inTable('team_members');
  });

  await knex.raw('DROP INDEX IF EXISTS cost_categories_business_code_unique');
  await knex.raw('DROP INDEX IF EXISTS cost_categories_system_code_unique');
  await knex.raw('DROP INDEX IF EXISTS job_costs_selection_cycle_idx');
  await knex.raw('DROP INDEX IF EXISTS geofence_events_member_job_time_idx');
  await knex.raw('DROP INDEX IF EXISTS job_costs_member_job_category_unique');

  await knex.schema.table('job_costs', (table) => {
    table.dropColumn('source');
  });
  // Note: the D2 price backfill is intentionally not reverted (data, not schema).
};
