# TaskRight — Doc Registry & Ownership Map

**Purpose:** Single reference for what each doc owns and what must stay in sync when it changes. Read this before making cross-cutting changes, and use it to drive the post-session consistency review.

---

## Document Inventory

### `HANDOFF.md` (project root)
**Owns:** Current build state, DB schema (table list + all columns), architectural decisions, pending work checklist, error patterns, dev environment setup, per-session change log.
**Updated:** Every session.
**Must sync with:**
- `shared/API_REFERENCE.md` — route list in HANDOFF must match documented endpoints
- `shared/FEATURE_MAPPING.md` — feature status (✅/❌) must match what HANDOFF says is built
- `shared/PRODUCT_OVERVIEW.md` — "Current Phase" section must reflect HANDOFF build state
- `shared/specs/*.md` — any feature spec that reaches "implemented" status must be reflected in HANDOFF DB tables and pending work

---

### `SPEC.md` (project root, ~75KB — use offset/limit)
**Owns:** Full original product specification, feature design intent, original data model definitions.
**Updated:** Rarely — only for major scope or design changes.
**Must sync with:**
- `HANDOFF.md` — when an architectural decision diverges from spec, HANDOFF is the source of truth; add a note in SPEC if the divergence is permanent
- `shared/specs/*.md` — feature specs should not contradict the overall product design in SPEC

---

### `shared/API_REFERENCE.md`
**Owns:** All endpoint signatures, request/response shapes, auth patterns, error formats.
**Updated:** When new routes are added or existing routes change.
**Must sync with:**
- `HANDOFF.md` — route list in HANDOFF "What's Fully Built → Backend" must match documented endpoints
- `shared/specs/*.md` — new feature specs must add their endpoints here when implemented
- `backend/src/routes/` — actual implementation is ground truth; API_REFERENCE documents what's live

---

### `shared/FEATURE_MAPPING.md`
**Owns:** Which features live on mobile vs. web, platform decision criteria, website phase plan, feature status matrix.
**Updated:** When features ship or platform decisions change.
**Must sync with:**
- `HANDOFF.md` — feature status symbols (✅/❌/🔄) must match HANDOFF "What's Fully Built"
- `shared/PRODUCT_OVERVIEW.md` — "Current Phase" and feature completeness must align

---

### `shared/PRODUCT_OVERVIEW.md`
**Owns:** Mission statement, user personas, key user flows, high-level design system (colors, type scale).
**Updated:** When personas, mission framing, or brand tokens change.
**Must sync with:**
- `HANDOFF.md` — "Current Phase" section must not describe features as unbuilt if HANDOFF says they're complete
- `shared/DESIGN_SYSTEM.md` — color values and type tokens must match
- `shared/FEATURE_MAPPING.md` — feature completeness must be consistent

> ⚠️ Known stale entry (as of Session 8): PRODUCT_OVERVIEW.md still says "Website: Not Started." The website is live with a full landing page, signup flows, and customer join pages. Update next time this file is touched.

---

### `shared/DESIGN_SYSTEM.md`
**Owns:** Full design token reference — colors, spacing, typography, component patterns.
**Updated:** When brand tokens or UI patterns change.
**Must sync with:**
- `shared/PRODUCT_OVERVIEW.md` — the abbreviated design section in PRODUCT_OVERVIEW must match
- `TaskRight-Website/src/` — Tailwind classes and component styles should reflect the system

---

### `TASKRIGHT_SEO_ACTION_PLAN.md` (project root)
**Owns:** SEO roadmap, GA4 integration steps, GSC setup, content strategy phases.
**Updated:** When SEO items are completed or strategy changes.
**Must sync with:**
- `HANDOFF.md` — "Phase 1 SEO" items in pending work must match what this doc lists as incomplete

---

### `shared/specs/` (future — created as features are designed)
**Owns:** Per-feature data models, API surface, business rules, open questions for features not yet in SPEC.md.
**Convention:** Each file is self-contained. When a feature ships, update HANDOFF.md (DB tables, pending work) and API_REFERENCE.md (new endpoints). The spec file stays as the design record.
**Files:**
- `shared/specs/JOB_COSTING.md` — Job costing equation, cost categories + chart of accounts codes, geo-fencing infrastructure (geocoding, arrival/departure events), per-job and per-customer profitability views. Migrations 017–018.
- `shared/specs/JOB_COSTING_DATA_GAPS.md` — Pre-UI data-model decisions (manual vs auto labor, price population, team-job scope), migration `019_job_costing_integrity` (constraints/indexes/backfill), and the unbuilt service/API layer. Must be cleared before job-costing UI work. Depends on JOB_COSTING.md.
- `shared/specs/REVIEW_REQUESTS.md` — SMS review request flow, no-auth `/review/[token]` page, review_tokens table, feedback source tracking, opt-out model. Depends on geo-fencing from JOB_COSTING.md.
- `shared/specs/SERVICE_MODEL.md` — Per-customer service model overhaul: `service_cycles`→`service_templates` (library), `customer_cycle_assignments`→`customer_services` (per-customer definition), repoint `selection_cycles`/`task_assignments`. Migrations **021** (additive+backfill) + **022** (enforce+cleanup). Components 1–4 built (feature-complete); job costing (job_costs) + review requests (review_tokens) preserved by anchoring on `selection_cycle_id`.
- `shared/specs/CREATE_FLOW_ASSIGNMENT.md` — ✅ **BUILT (July 11, 2026)**: optional team/group assignment inside the service create flow (all upcoming open visits), plus a service-level fan-out endpoint. **No migration** — reuses `service_assignments` (upsert per `selection_cycle_id`); dispatch view (`ForecastDayScreen`) preserved unchanged (refactored onto a shared controlled `AssigneePicker`). Two entry points, one model; validate-first-then-create (no half-create). Synced: `API_REFERENCE.md` (create `assignee` field + `PUT .../services/:serviceId/assignment`), `HANDOFF.md`. **121/121 backend tests.** Deferred: team labor costing (D3 gap).
- `shared/specs/TEAM_LABOR_COSTING.md` — ✅ **BUILT (July 14, 2026)**: closed the D3 gap — group-assigned Calls now record per-member labor → profitability populates on the cost side. **Option A**: a group assignment resolves to *all its members individually*; broadened the four member-facing resolvers (`getJobsForTeamMember`/`getJobDetail`/`completeJobForTeamMember`/`recordGeofenceEvent`) from `team_member_id`-only to *individual OR `team_memberships`* via one shared `assertMemberAssignedToCall` gate, reusing the per-member labor machinery wholesale. Per-member existing rate (TL2); first-to-complete-wins (TL3). **No migration.** Synced: `JOB_COSTING.md` + `JOB_COSTING_DATA_GAPS.md` (D3 → Option A shipped), `CREATE_FLOW_ASSIGNMENT.md` (D7 gap closed), `API_REFERENCE.md` (`getJobsForTeamMember` includes team jobs + `isTeamAssigned`/`teamName`; no new endpoints), `HANDOFF.md`, mobile (removed D3 empty-state + updated create-flow group note; "Team" badge + first-wins 409 copy). **136/136 backend tests** (+15).
- `shared/specs/SERVICE_CALL_LIFECYCLE.md` — ✅ **BUILT (July 14, 2026)**: a created service's Calls are legible immediately — the per-Call detail screen shows the **proposed/expected** scope (default `service_tasks` menu + `total_hours` + `price_per_visit` + assignment) while in flight, then switches to **confirmed** (customer's submitted selection) and **actual** (completion + labor/margin) as reality arrives. Backend enriches `getServiceCallDetail` with a derived `lifecycleState` (`proposed|confirmed|completed`) + resolved `tasks[]` (fixes the latent ids-render-as-"Task N" bug) + `expectedHours`/`confirmedHours`/`expectedPrice`/`scopeIsAssumed`; `getCustomerDetails.upcomingServices[]` carries a `proposed`/`confirmed` badge state. **No migration; no new endpoints.** Decisions: SCL1 per-Call screen only (no service overview), SCL2 post-create nav unchanged (+ list badges), SCL3 full proposed scope, SCL7 completed-without-confirmation falls back to the default menu. Build note: Job Costing kept always-visible (not gated behind completed) — the "Price (Expected)" qualifier needs it pre-completion; live route path is `.../selection-cycles/:id` (spec text says `service-calls`, not renamed). Synced: `API_REFERENCE.md` (enriched `selection-cycles/:id` payload + `upcomingServices` badge), `SERVICE_MODEL.md` (§2.6 Call lifecycle read layer), `HANDOFF.md`, mobile (`ServiceCallDetailScreen` states + `CustomerDetailScreen` list badge). Backward-compatible (kept `selectedTasks`/`selectionStatus`). **+ §9 Proposed Job Costing / Expected Margin (July 15, 2026):** `getJobCosts` enriched with `proposedLabor` (= `proposedLaborHours × Σ assignee rates`; group = whole-crew sum, PJC1), `proposedLaborBreakdown`, `expectedLaborIncomplete` (floor flag for unrated/no-assignee, PJC4), `expectedTotalCost`, `expectedMargin*`; `estimatedHours` now falls back to `expectedHours` pre-selection. Mobile shows Proposed Labor + Expected Margin pre-completion, actuals after. No migration, no new endpoint. Synced `API_REFERENCE.md` (getJobCosts payload). **151/151 backend tests** (+7). Depends on SERVICE_MODEL.md / SERVICE_TASK_OWNERSHIP.md; reads (not writes) `selections`.
- `shared/specs/DOW_DAY_SNAPSHOT.md` — ✅ **BUILT (July 17, 2026)**: parity fix — day-of-week business owners now get the same "what's already scheduled on this day" review that date-based owners get during service create. Added a "Review {Weekday} — see what's scheduled ›" button to the day-of-week branch of `AssignCycleScreen` that navigates to the existing (unchanged) `ServiceDaySnapshotScreen` with the `forecastItem` for the chosen `startDate`. **Mobile-only; no backend change, no migration, no new endpoint** (reuses `getForecast` data already in hand + the presentational snapshot screen). Flavor 1 (single-date review); **flavor 2 deferred** (weekday aggregate / "typical Tuesday" — filter forecast by weekday + roll up, if owners ask). No new tests (presentation-only). Sync: `HANDOFF.md`.
- `shared/specs/GEOCODING_RELIABILITY.md` — ✅ **BUILT (July 20, 2026)**: made address→coordinates resolution reliable, bounded, and legible after the team-member "No address on file — using manual tracking" quirk (address present but never geocoded). `geocodeAddress`→`geocodeCustomer` (records the attempt, relevance-gates confident-wrong pins at ≥ 0.8), reset-on-address-change self-heal, an **hourly bounded retry** job (`jobs/geocode-retry.js`, capped at 3 attempts / 6h backoff — geocode-on-read rejected), and an owner-visible `geocodeStatus`. Migration **025** (`customers.geocode_attempts/attempted_at/relevance`). Sync targets: `HANDOFF.md` (DB tables + milestone), `API_REFERENCE.md` (Get Customer Details `geocodeStatus`/`geocodeRelevance`), mobile (`JobDetailScreen` copy, `CustomerDetailScreen` note). **165/165 backend tests** (+14, `geocoding.test.js`).
- `shared/specs/SERVICE_TASK_OWNERSHIP.md` — Service Model **Phase 2** ✅ **BUILT (July 8, 2026)**: retired the global `tasks` table + Tasks tab; tasks now owned per-service (`service_tasks`) and per-template (`template_tasks`). `selections.selected_tasks` remapped to `service_task` ids. Migration **023** (single cutover, both DBs). Depends on SERVICE_MODEL.md; downstream money/review/feedback preserved via `selection_cycle_id`. Sync targets: `API_REFERENCE.md` (service/template payloads `tasks:[{id?,name,timeAllotmentMinutes}]`, no `/tasks` routes), `HANDOFF.md` (DB tables), mobile builder + Templates editor. **104/104 backend tests.**

> ⚠️ Migration-number collision: `JOB_COSTING_DATA_GAPS.md` claims `019` (job costing integrity) and `REVIEW_REQUESTS.md` previously also claimed `019`. Resolution: job-costing integrity takes **019** (it must land before UI and before review requests, which depends on geofencing); **REVIEW_REQUESTS migration is now 020**. Confirm the actual next free number at implementation time (018 is the current highest that exists).

---

## Sync Rules (apply after every session)

1. **New route added** → update `API_REFERENCE.md` + `HANDOFF.md` route list
2. **New DB table or column** → update `HANDOFF.md` schema section
3. **Feature completed** → update `HANDOFF.md` pending work (check it off) + `FEATURE_MAPPING.md` status matrix
4. **Architectural decision changed** → update `HANDOFF.md` decisions section; note divergence in `SPEC.md` if permanent
5. **New feature spec written** → register it in this file under `shared/specs/`
6. **Brand/design token changed** → update both `DESIGN_SYSTEM.md` and the abbreviated section in `PRODUCT_OVERVIEW.md`

---

## Post-Session Review Prompt

At the end of any session where code or docs changed, run:

> "Review the TaskRight docs for consistency. Read `shared/DOC_REGISTRY.md` for the ownership map. Then check each doc listed there against its declared sync targets. Report only actual gaps — a feature described as unbuilt in one doc but complete in another, an endpoint in the code with no API_REFERENCE entry, a DB column in HANDOFF with no migration, etc. Output a numbered list of gaps found, or 'Docs in sync.' if clean. Keep it under 200 words."

This prompt is also wired as a Claude Code stop hook — it fires automatically when each session ends.
