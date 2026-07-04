# Job Costing — Data Model & API Gaps (pre-UI)

**Status:** Open. To be cleared **before** any job-costing UI work begins.
**Created:** 2026-07-03 (after Session 9 review-findings fixes)
**Related:** [`JOB_COSTING.md`](JOB_COSTING.md) (feature spec), [`SESSION9_REVIEW_FINDINGS.md`](SESSION9_REVIEW_FINDINGS.md) (fixed), [`REVIEW_REQUESTS.md`](REVIEW_REQUESTS.md) (consumes geofence departure)

---

## Why this file exists

Session 9 landed the job-costing **data layer** (migrations 017–018, geocoding, geofence endpoint, sum-of-intervals labor calc) and fixed 10 review findings. But there are data-model decisions and gaps that must be resolved before building the UI — otherwise the UI gets built against an unstable model and has to be reworked.

**Sequencing principle for the next session:**

```
Part 1: Decisions (D1–D3)   ← make these first; they change schema AND API shape
      ↓
Part 2: Schema migration 019 ← encodes the decisions + integrity/perf hygiene
      ↓
Part 3: Service / API layer  ← endpoint behavior follows directly from D1–D3
      ↓
UI (separate session)        ← only starts once the above is settled
```

Do **not** start the API layer (Part 3) until D1–D3 are decided — several endpoints return or accept different fields depending on those choices.

---

## Part 1 — Decisions to make first

These are not just columns; they are product/model decisions that ripple into the API and UI.

### D1. Manual vs. auto labor reconciliation  *(highest priority)*

- **Problem:** `recordGeofenceEvent()` (businessService.js) now **recomputes** `job_costs.hours_actual`/`amount` from the full geofence event history on every departure (sum-of-on-site-intervals, idempotent — Session 9 finding #1). The spec also allows the owner to **manually edit** a labor line (`PATCH /costs/:id`) and states "manual overrides are always permitted" (Rule 1). Today there is **no way to tell an auto-computed labor row from a manually-corrected one**, so a late/duplicate departure from the team member's phone will **silently overwrite** the owner's correction.
- **Decision needed:** How do auto and manual labor coexist on the same row?
- **Recommended approach:** Add `job_costs.source varchar(10) NOT NULL DEFAULT 'auto'` (`'auto' | 'manual'`).
  - Geofence recompute **skips** rows where `source = 'manual'`.
  - `PATCH /costs/:id` and `POST /costs` set `source = 'manual'`.
  - Alternative considered: a `locked boolean`. `source` is preferred — it also drives UI labeling ("auto-tracked" vs "edited").
- **Downstream impact:**
  - API: `GET /costs` must return `source` per labor line; recompute logic in `recordGeofenceEvent()` gains a `source='manual'` guard.
  - UI: renders an "edited" vs "auto-tracked" indicator and decides whether a re-tracked value should prompt "GPS recorded X, you set Y."

### D2. Price population strategy  *(Business Rule 4 — confirmed NOT implemented)*

- **Problem:** `selection_cycles.price` exists but nothing ever sets it. Cycle generation (`generateUpcomingSelectionCycles()`) does not copy `customer_cycle_assignments.price_per_visit → selection_cycles.price`. Result: **every job's margin renders "Price not set"** until manually entered — the costing UI looks broken on first load.
- **Decision needed:** When and how is `price` populated?
- **Recommended approach:**
  1. **Creation-time:** in `generateUpcomingSelectionCycles()`, set `price = assignment.price_per_visit` (nullable if the assignment has none) when creating each cycle.
  2. **Backfill:** one-time UPDATE in migration 019 for existing **open** cycles: `selection_cycles.price = cca.price_per_visit` joined via customer + service_cycle where `price IS NULL`.
  3. **Ad hoc jobs** (no assignment): remain null; set via `PATCH /jobs/:id/price` (Rule 5).
- **Downstream impact:** API `PATCH .../price` endpoint; UI price field pre-fills instead of always blank.

### D3. Team-assigned job costing scope  *(confirmed gap)*

- **Problem:** `getJobsForTeamMember()` and the assignment checks in `getJobDetail()` / `completeJobForTeamMember()` / `recordGeofenceEvent()` all match `service_assignments.team_member_id` **only**. Jobs assigned to a **team** (`service_assignments.team_id` set, `team_member_id` null) never appear for that team's individual members — so no geofence events and no per-member labor lines are ever recorded for team jobs. Since `job_costs` is per-member, team-job labor costing currently produces nothing.
- **Decision needed:** Does v1 job costing support team-assigned jobs?
  - **Option A — support it:** union `team_group_members` into the job-resolution and assignment-verification queries so each member of an assigned team sees the job and can record their own geofence/labor. Most correct; more query surface to change.
  - **Option B — individual-only for v1:** explicitly document that job costing requires individual `team_member_id` assignment; team-assigned jobs show price/materials/overhead but no auto labor. Simplest; must be stated so the UI doesn't imply otherwise.
- **Recommended:** Option B for v1 (scope control), with a tracked follow-up for Option A — unless team assignment is already common in real use.
- **Downstream impact:** determines whether the labor table can be non-empty for team jobs; shapes an empty-state in the UI.

---

## Part 2 — Schema work (migration `019_job_costing_integrity.js`)

Encodes the decisions above plus data-integrity / performance hygiene. None of this is UI-blocking on its own, but it should land before the feature is exercised for real.

- [ ] **(from D1)** `job_costs.source varchar(10) NOT NULL DEFAULT 'auto'`.
- [ ] **(from D2)** Backfill `selection_cycles.price` for existing open cycles from `customer_cycle_assignments.price_per_visit`.
- [ ] **Enforce Rule 6 at the DB (not just app code):** partial unique index
      `job_costs (selection_cycle_id, team_member_id, cost_category_id) WHERE team_member_id IS NOT NULL`
      so duplicate labor rows for the same member+job are impossible.
- [ ] **Indexes for recompute + aggregates:**
      `geofence_events (selection_cycle_id, team_member_id, occurred_at)` and `job_costs (selection_cycle_id)`.
      (The Session 9 recompute pulls all events for a member+job ordered by `occurred_at`; the profitability aggregate scans `job_costs` by cycle.)
- [ ] **`cost_categories` uniqueness:** the labor lookup assumes a single `code=5000, is_system=true` row.
      Add unique indexes: system scope on `(code) WHERE business_id IS NULL`; custom scope on `(business_id, code) WHERE business_id IS NOT NULL`.
- [ ] **FK `ON DELETE` behavior:** currently undefined for `job_costs` and `geofence_events`. Decide cascade vs restrict when a `selection_cycle` or `team_member` is deleted (a member with labor history will otherwise error/orphan).
- [ ] **Labor cross-table constraint (spec Rule):** "if category type='labor' then `team_member_id`/`hours_actual` non-null" spans two tables and is **not expressible as a plain CHECK**. Decide: DB trigger vs. app-level enforcement in the costs service. (Recommend app-level for v1, documented.)

---

## Part 3 — Service / API layer (follows Part 1 decisions)

None of this is built yet. Build **after** D1–D3 so field shapes are final. Ordered by dependency.

1. **`GET /api/businesses/:id/cost-categories`** — system defaults + business customs. No decision dependency; safe to build first.
2. **`PATCH /api/businesses/:id/team-members/:memberId`** — extend to accept `hourlyRate`. Independent; unblocks labor `amount` being non-zero.
3. **`PATCH /api/businesses/:id/jobs/:selectionCycleId/price`** — set/override price (**needs D2** for pre-fill semantics; ad hoc path per Rule 5).
4. **`PATCH /api/businesses/:id/customers/:customerId/assignments/:assignmentId`** — set `pricePerVisit` (feeds D2 population going forward).
5. **`POST /costs`, `PATCH /costs/:costId`, `DELETE /costs/:costId`** — manual entry/correction (**needs D1**: these set `source='manual'`).
6. **`GET /api/businesses/:id/jobs/:selectionCycleId/costs`** — the per-job costing payload: `price`, labor lines (`memberName`, est. vs actual hours, rate, amount, **`source`** per D1), materials, overhead, totalCost, margin$ / margin% (Rule 3: "Price not set" when price null). **Needs D1 + D2.** Estimated hours computed at query time from `tasks.time_allotment_minutes` (Rule 7 — derivable, no schema).
7. **`GET /api/businesses/:id/customers/:customerId/profitability`** — aggregate over **completed** cycles only. Depends on 6's cost math; benefits from the `job_costs (selection_cycle_id)` index.
8. **Recompute guard** in `recordGeofenceEvent()` — add the `source='manual'` skip (**D1**).

---

## Part 4 — Explicitly fine / out of scope (do not over-build)

- **Estimated hours (Rule 7):** derivable; `selections.selected_total_hours` already stored. No schema.
- **Materials / Overhead:** no new tables — `job_costs` rows with category `5100`/`5200`, null `team_member_id`/`hours_actual`. Handled once `POST /costs` exists.
- **Decimal precisions:** `amount(10,2)`, `price(8,2)`, `hours_actual(5,2)`, `hourly_rate(8,2)` are adequate.
- **Geofence lat/lng nullable:** already handled (Session 9 finding #9, migration 018).

---

## Suggested execution order for the next session

1. Decide **D1, D2, D3** (product + model).
2. Write & run **migration 019** on both `task_app_db` and `task_app_test` (Part 2).
3. Add the **recompute `source` guard** + **cycle-creation price population** in `businessService.js`.
4. Build the **API layer** in the Part 3 order; add tests (keep the suite green — currently 76/76).
5. Only then start **UI** (separate session) against a settled contract.
