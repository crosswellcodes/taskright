# Service Model — Feature Spec (Per-Customer Services)

**Status:** ✅ COMPONENTS 1–3 BUILT → FEATURE COMPLETE (July 5–6, 2026). C1 data/backend + C2 customer-profile builder + C3 Templates browser & "save as template". Migrations 021/022 on both DBs; per-customer Service CRUD + template library; **119/119 backend tests.** All six design questions resolved (see **Resolved Decisions**). Optional **C4** cleanup remains (rename template-CRUD function symbols; drop legacy `/assign-cycle`).

> **C1 build notes (what actually shipped):**
> - Tables renamed: `service_cycles`→`service_templates`, `customer_cycle_assignments`→`customer_services` (absorbed `name`/`frequency`/`days_before_service_deadline`/`days_before_auto_repeat` + nullable `template_id` provenance FK, `ON DELETE SET NULL`), `task_assignments`→`template_task_assignments` (col `service_cycle_id`→`template_id`). New `service_task_assignments` (per-service menu). `selection_cycles.service_cycle_id`→`customer_service_id` (021 nullable+backfilled; 022 `NOT NULL` + drops legacy col). Old `UNIQUE(customer_id, service_cycle_id)` dropped → a customer may hold multiple Services (incl. several from one template). Live fan-out verified: template 6's 3 customers → 3 independent Services each with their own 4-task menu.
> - New service fns (`businessService.js`): `createCustomerService` (core: insert + own menu + generate + welcome SMS), `createCustomerServiceForBusiness` (from-scratch or `templateId`-seeded, overrides win, validates tasks/frequency/hours), `updateCustomerService` (definition-only per C1 decision; deadline change recomputes open calls' `submission_deadline`, never regenerates/deletes), `deleteCustomerService` (cascades open calls; `409 HAS_HISTORY` if any completed), `getCustomerServiceDetail`.
> - New endpoints (`routes/businesses.js`): `POST|GET|PATCH|DELETE /businesses/:id/customers/:cid/services[/:serviceId]`. See API_REFERENCE.
> - Backward-compat preserved: `/service-cycles` CRUD (now the template library) + `/assign-cycle` (now seeds a Service from a template, keeps the one-per-template 409 guard) still work → the mobile app keeps running until C2/C3 repurpose those screens.
> - Ownership checks that used to go `selection_cycles → service_cycles.business_id` now go via `customers.business_id` (Services carry no `business_id`).
> - Function *symbols* for template CRUD kept their `ServiceCycle` names (createServiceCycle/etc.) to avoid churning the still-live `/service-cycles` callers; symbol rename deferred to C3/C4 when those callers move.

**Dependencies (must not break):** `JOB_COSTING.md` (job_costs, price copy, geo-fencing), `REVIEW_REQUESTS.md` (review_tokens), and the selection/completion/feedback chain. All of these anchor on `selection_cycles.id`, which is why the overhaul is safe (see **Downstream Preservation**).

---

## Overview

Today TaskRight forces a **build-then-assign** flow: a business owner first builds a business-global *service cycle* in the **Cycles** tab (name, frequency, deadlines, task menu — decoupled from any customer), then switches to the **Customers** tab to assign that pre-existing cycle to a customer (hours, price, start date/day). Creation and use live in two different places, the definition is split across two tables, and editing a shared global cycle silently changes every customer on it.

This spec moves TaskRight to a **per-customer service model**: each customer's service is its own record, created directly on the customer profile, optionally seeded from a reusable **template library**, and fully decoupled after creation. Job costing and review requests are preserved without change because they key off the dated job (`selection_cycles`), not the service definition.

**Goal:** one place to create a service (the customer profile), one owner of the definition (the per-customer service record), and an optional library so owners don't re-type common services.

---

## 1. Current-State Audit

### 1.1 The recurring chain (data model)

Everything hangs off `service_cycles` (business-global) → `customer_cycle_assignments` (the link) → `selection_cycles` (the dated jobs):

| Table | Migration(s) | Role today | Owns |
|-------|-------------|-----------|------|
| `service_cycles` | 001 | Business-**global** definition/template | `business_id, name, frequency, days_before_service_deadline, days_before_auto_repeat` |
| `task_assignments` | 001 | Task menu, attached to the **global** cycle | `task_id, service_cycle_id` (UNIQUE pair) |
| `customer_cycle_assignments` (cca) | 001, 002, 009, 017 | The customer↔cycle **link** row | `customer_id, service_cycle_id, total_hours, start_date, day_of_week, price_per_visit`; UNIQUE(customer_id, service_cycle_id) |
| `selection_cycles` | 001, 015, 017 | The **dated job / service call** (the "Ref #") | `service_cycle_id, customer_id, service_date, submission_deadline, status, customer_note, selection_token, price` |

Downstream — all anchored on `selection_cycle_id`, **never** `service_cycle_id`:
`selections`, `service_completions`, `service_assignments`, `feedbacks`, `job_costs` (017/019), `review_tokens` (020, UNIQUE per job), `geofence_events`.

### 1.2 Backend flow (`businessService.js`)

- `createServiceCycle()` (~L143) — builds a global cycle + its `task_assignments`. Powers the **Cycles** tab.
- `assignCycle(customerId, serviceCycleId, totalHours, startDate, dayOfWeek)` (~L378) — inserts a cca row, then calls `generateUpcomingSelectionCycles()`.
- `generateUpcomingSelectionCycles()` (~L433) — spins up **4** `selection_cycles`, copying `cca.price_per_visit → selection_cycles.price` (job-costing D2). Frequency math branches date-based vs day-of-week.
- Read paths (`getCustomerDetails`, `getUpcomingCustomerSelections`, `getBusinessForecast`, feedback joins, `verify…BelongsToBusiness`) resolve the service **name and task menu** by joining `selection_cycles → service_cycles`.

### 1.3 Screens / IA

- **Cycles tab** (`BusinessNavigator.js:72` → `ServiceCyclesScreen.js`) — global CRUD of `service_cycles`, customer-less.
- **Customers tab → CustomerDetailScreen → AssignCycleScreen** — pick a *pre-existing* global cycle, set hours + start date/day, assign. `ServiceDaySnapshotScreen` confirms the date (date-based path).
- Job-costing UI already lives on `CustomerDetailScreen` (Profitability card, recurring-price edit → `PATCH .../assignments/:assignmentId`) and `ServiceCallDetailScreen` (per-job costs).

### 1.4 What is disjointed (precise)

1. **Two entry points, two mental models.** You must build a cycle in one tab, then assign it in another. Creation and use are separated.
2. **The definition is split across two tables.** Name/frequency/deadlines/**tasks** live on global `service_cycles`; hours/price/start/day live per-customer on `customer_cycle_assignments`.
3. **Shared cycles couple customers.** Editing a global cycle's task list changes the menu for every customer assigned to it. Live data confirms this is real: cycle 6 → 3 customers, cycle 17 → 3, cycle 16 → 2, cycle 18 → 2.
4. **No per-customer definition exists.** You can't give one customer a tweaked task list or deadline without forking a whole new global cycle.
5. **Price already leaked "per-customer."** `customer_cycle_assignments.price_per_visit` (017) is definition data already bolted onto the link row — a hint the model wants a per-customer definition home.
6. **Orphans.** 5 of 17 `service_cycles` have zero assignments (built-but-never-assigned) — exactly the artifact a library should absorb.

### 1.5 Live data snapshot (`task_app_db`, July 5, 2026)

19 businesses · 20 customers · 17 service_cycles (**4 shared by >1 customer, 5 orphaned**) · 18 cca · 75 selection_cycles (72 open / 3 completed) · 23 tasks · 47 task_assignments · 4 selections · 1 service_completion · 9 job_costs · 1 review_token · 2 feedbacks.

### 1.6 Repoint surface (verified)

Only these backend files reference `service_cycle_id` / `service_cycles` / `serviceCycle`:
`businessService.js`, `customerService.js`, `routes/teamMembers.js`, `routes/businesses.js`, `jobs/selection-reminders.js` (+ test files). **No money/review/feedback table references `service_cycle_id`** — they all key off `selection_cycle_id`. This is the crux of the safety argument.

---

## 2. Target Model

### 2.1 Concept

- **Service** (per-customer) — the owned, editable definition of what a specific customer gets: name, frequency, deadlines, task menu, hours, price, schedule. Created on the customer profile. Decoupled after creation.
- **Service Template** (business-global) — a reusable, optional seed. "Start from template" copies its fields into a new Service; "Save as template" snapshots a Service back into the library. **Instantiation is a one-time copy — no live link.**
- **Service Call** (dated job) — an individual scheduled visit (`selection_cycles`, the "Ref #"). Unchanged; renamed only in UI vocabulary.

### 2.2 Chosen schema — cca absorbs the definition

**Decision A (resolved): `customer_cycle_assignments` absorbs the definition and is renamed `customer_services`; `service_cycles` becomes `service_templates` (the library).** `cca` is already one row per customer-per-service and already owns half the definition (hours/price/start/day). It gains the missing columns and its own task menu.

```
service_templates          (was service_cycles — business-global library)
  id, business_id, name, frequency,
  days_before_service_deadline, days_before_auto_repeat
  (task menu via template_task_assignments — see 2.4)

customer_services          (was customer_cycle_assignments — the per-customer SERVICE)
  id, customer_id,
  template_id            → service_templates.id  NULLABLE (provenance only, decoupled)
  name, frequency,
  days_before_service_deadline, days_before_auto_repeat   ← NEW (absorbed definition)
  total_hours, price_per_visit, start_date, day_of_week    ← already present
  (task menu via service_task_assignments — see 2.4)

selection_cycles           (the dated job — unchanged shape except FK)
  id, customer_service_id → customer_services.id   ← was service_cycle_id
  customer_id, service_date, submission_deadline, status,
  customer_note, selection_token, price, …
```

#### 2.2.1 Schema shown both ways (per the design brief)

**Way 1 — cca absorbs (CHOSEN).** Add definition columns to `customer_cycle_assignments`; rename it `customer_services`; repurpose `service_cycles` as `service_templates`.
- ✅ No duplicate table; reuses the row that already exists 1:1 per customer-per-service.
- ✅ `price_per_visit` (the leaked definition field) is now home.
- ✅ Repoint surface is just two FKs + name-resolution joins.
- ⚠️ Requires renaming `service_cycle_id` on `selection_cycles` and `task_assignments`.

**Way 2 — new `customer_services` table, `service_cycles` stays.** Create a fresh table, migrate cca into it, drop/fold cca.
- ✅ Clean name from the first commit.
- ❌ Duplicates a table that is *already* per-customer; forces a fold-or-coexist decision on cca.
- ❌ If `service_cycles` stays live as a definition, two definition homes remain — the exact disjointedness we're removing.
- **Rejected.**

### 2.3 The library (Decision B, resolved: both)

- **`service_templates`** = business-global reusable definitions (repurposed `service_cycles`). Optional. Editing a template never touches existing `customer_services` (copy-on-instantiate).
- **Per-customer service list** = the `customer_services` rows for that customer, shown/created on the customer profile.
- **"Save as template"** snapshots a `customer_services` row (+ its task menu) into `service_templates`. **"Start from template"** copies a template's fields into a new `customer_services` row, then it's fully editable and independent.

### 2.4 Task menu

Each Service owns its own task menu so per-customer tweaks are possible (the whole point of decoupling).

- `task_assignments` (junction to the per-customer service) → repoint `service_cycle_id` to `customer_service_id`. Rename table to `service_task_assignments` for clarity (mechanical).
- Templates need their own task menu too → **new junction `template_task_assignments (template_id, task_id)`**, backfilled from the old `task_assignments`. Migration copies each template's task list into each instantiated service's `service_task_assignments`.
- `tasks` stays business-global and unchanged (tasks are reused across services — 23 tasks, 47 assignments today).

### 2.5 Terminology (Decision F, resolved)

| Old (user-facing + code) | New user-facing | New code / table |
|---|---|---|
| Service Cycle (per-customer sense) | **Service** | `customer_services` |
| Service Cycle (global template sense) | **Service Template** | `service_templates` |
| Selection Cycle / (dated) | **Service Call** | `selection_cycles` (table name kept — too much downstream; UI relabel only) |
| Cycles tab | **Templates** tab | — |
| "Assign Service Cycle" | **"Add Service"** | — |

Rename scope: DB tables + service-layer identifiers (mechanical, ~5 backend files + tests) and UI labels. `selection_cycles` table name is retained to avoid churning every downstream FK; it is relabeled "Service Call" only in UI. **Decision E (resolved):** physically rename tables/identifiers, not UI-only.

---

## 3. Downstream Preservation (make-or-break)

| Consumer | Keys off | Action |
|---|---|---|
| `job_costs` (017/019) | `selection_cycle_id` | **No change.** |
| `review_tokens` (020) | `selection_cycle_id` | **No change.** |
| `feedbacks` | `selection_cycle_id` | **No change** (name-resolution join updated). |
| `selections`, `service_completions`, `service_assignments`, `geofence_events` | `selection_cycle_id` | **No change.** |
| `selection_cycles` | — | FK `service_cycle_id` → `customer_service_id`; backfill deterministic via `(customer_id, service_cycle_id)` → the cca row (old UNIQUE guarantees exactly one). |
| `task_assignments` | `service_cycle_id` | Repoint to `customer_service_id`; template menu copied per service. |
| `generateUpcomingSelectionCycles` (D2 price copy) | reads `price_per_visit` | Near-unchanged — the row it already queries *is* now the service. Still copies `price_per_visit → selection_cycles.price`. |
| Name-resolution reads (`getCustomerDetails`, `getUpcomingCustomerSelections`, forecast, feedback joins, team-member job detail, `verify…BelongsToBusiness`) | `selection_cycles → service_cycles` | Change join to `selection_cycles → customer_services`; name/frequency now come from the per-customer service. |
| `PATCH .../customers/:id/assignments/:assignmentId` (job-costing recurring price) | `customer_cycle_assignments.id` | Table renamed → path/handler updated; still sets `price_per_visit` on the same logical row. |

**Bottom line:** only two FK columns move (`selection_cycles`, `task_assignments`) plus the name-resolution joins. Every dollar/review/feedback record is untouched because it anchors on `selection_cycle_id`.

---

## 4. Migration Strategy (Decision D, resolved: cutover, split 021/022)

Cutover that preserves plumbing (existing `selection_cycles`/`job_costs`/`review_tokens` stay put), split across two migration numbers so the destructive step is isolated and reversible-in-practice.

### Migration 021 — additive + backfill (non-destructive)
1. Rename `service_cycles` → `service_templates`; `customer_cycle_assignments` → `customer_services`. (Or add-new + copy if a rename-in-place risks FK churn — implementer's call at C1; rename is preferred.)
2. Add to `customer_services`: `template_id` (nullable FK → service_templates), `name`, `frequency`, `days_before_service_deadline`, `days_before_auto_repeat`.
3. Backfill those columns on each `customer_services` row from its source template. **Shared templates fan out automatically** — cycle 6's 3 customers each get an independent snapshot.
4. New junctions: `template_task_assignments` (backfill from old `task_assignments`) and `service_task_assignments`; copy each template's task list into each instantiated service.
5. Add `selection_cycles.customer_service_id`; backfill via `(customer_id, service_cycle_id)` → `customer_services` row.
6. Keep old columns/FKs in place (read paths still work mid-deploy). Orphan templates (5) remain as pure library entries — no customer_services, no selection_cycles.

### Migration 022 — enforce + cleanup (destructive; run after C1 verified)
1. `NOT NULL` on `selection_cycles.customer_service_id`.
2. Drop `selection_cycles.service_cycle_id` and the old `task_assignments.service_cycle_id` / retire the old `task_assignments` table in favor of `service_task_assignments`.
3. Drop any now-unused columns.

Run both on `task_app_db` and `task_app_test`. No dual-write, no lingering two-model state.

---

## 5. Navigation / IA (Decisions E)

- **Cycles tab → "Templates" tab.** Same CRUD screen (`ServiceCyclesScreen` → template browser), decoupled from customers. Lowest churn; keeps a home for the library.
- **AssignCycleScreen → "Add / Edit Service" builder** on the customer profile: name / frequency / deadlines / tasks / hours / price / start-or-day, optionally pre-filled from a template. Reuses its existing date & day-of-week picker logic; `ServiceDaySnapshotScreen` preserved.
- **New creation entry point:** `CustomerDetailScreen` → **"Add Service"** → builder. Editing an existing service reopens the same builder.

---

## 6. Phased Plan

Sized like the job-costing / review-request cadence — data+backend first, then UI slices, each independently shippable and test-covered.

### Component 1 — Data + backend (migrations 021, then 022 after verify) — ✅ DONE (July 5, 2026)
- Migration 021 (additive + backfill) on both DBs.
- Service layer: rename identifiers; repoint reads/writes; per-customer **Service CRUD** (`POST/PATCH/DELETE` on the customer), **Template CRUD** (business-global), "start from template" (copy) and "save as template" (snapshot).
- `assignCycle` → `createServiceForCustomer` (builds a service + generates its 4 upcoming service calls). `generateUpcomingSelectionCycles` reads price/schedule from the service.
- Job-costing recurring-price path (`.../assignments/:assignmentId`) updated to the renamed table.
- Full test coverage; keep the 96/109 suites green. Migration 022 lands once C1 is proven.
- **No UI.**

### Component 2 — Customer-profile creation UI — ✅ DONE (July 6, 2026)
- Repurposed builder on `CustomerDetailScreen` ("Add Service" / edit). Task picker, frequency, deadlines, hours, price, start-or-day, optional "start from template".
- Client API calls; RN sim verification (user-run, per memory rule).
- **Build notes:**
  - `AssignCycleScreen.js` fully repurposed into the **Service builder** (create + edit via `serviceId` route param; title set dynamically to "Add Service" / "Edit Service"). Fields: name, frequency chips, per-task multi-select (from `getTasks`), hours, selection-deadline days, optional recurring price, and schedule (date-based calendar or day-of-week picker — **create mode only**, since C1 edits are definition-only). "Start from a template" modal seeds name/frequency/tasks/deadline from `getServiceCycles`. Edit mode adds a **Delete Service** action (handles `409 HAS_HISTORY`). Reuses the existing `ServiceDaySnapshot` confirmed-date round-trip.
  - `CustomerDetailScreen.js`: "Assigned Cycles" → **"Services"**; rows now tap into the builder (edit) and show `price/visit · frequency`; "+ Assign Cycle" → **"+ Add Service"**. The standalone recurring-price modal was **folded into the builder's price field** (same D2 path via `updateCustomerService` → `price_per_visit`); removed `setAssignmentPrice` usage + the price-only modal/state from this screen (endpoint still exists).
  - `businessApi.js`: added `createCustomerService`, `getCustomerService`, `updateCustomerService`, `deleteCustomerService`. Navigator `AssignCycle` static title → "Service" (component overrides dynamically).
  - Verified via Babel parse of all changed files; interactive sim check is the user's (no `preview_start` for RN).

### Component 3 — Templates library UI — ✅ DONE (July 6, 2026)
- Repurpose Cycles tab → **Templates** browser (create/edit reusable templates). "Save as template" from a service; "Start from template" in the builder.
- **Build notes:**
  - `ServiceCyclesScreen.js` relabeled into the **Templates** browser (intro copy explaining templates are decoupled blueprints; empty state, FAB "+ New Template", modal "New/Edit Template", "Create Template", delete alert notes "Existing customer services are unaffected"). Still the same `/service-cycles` CRUD underneath. Bottom-tab label `Cycles`→**Templates** (route name kept `Cycles`).
  - `AssignCycleScreen.js`: edit mode gains **"Save as Template"** — snapshots the Service's definition (name/frequency/deadlines/tasks; **definition-only**, no hours/price per §8) into the library via the existing `createServiceCycle` endpoint. Carries `daysBeforeAutoRepeat` through from load. No new backend.
  - "Start from template" (builder template picker) already shipped in C2.
  - Babel-parse clean; interactive sim check is the user's.

### Component 4 (optional) — cleanup
- Migration 022 destructive cleanup (if deferred), remove dead code/paths, drop legacy vocabulary from internals.

**Reserved migrations: 021, 022.**

---

## 7. Resolved Decisions

- **A. Schema shape** → `customer_cycle_assignments` absorbs the definition and becomes `customer_services`; `service_cycles` becomes `service_templates`. (Not a new coexisting table.)
- **B. Library** → both a business-global template library (`service_templates`) *and* a per-customer service list on the profile; instantiation is copy-on-create (decoupled).
- **C. Downstream** → preserve everything on `selection_cycles.id`; move only `selection_cycles` + `task_assignments` FKs and the name-resolution joins.
- **D. Migration** → cutover, split 021 (additive+backfill) / 022 (enforce+cleanup); shared templates fan out per customer; orphans become pure templates.
- **E. Cycles tab / AssignCycleScreen** → Cycles tab repurposed as **Templates**; AssignCycleScreen repurposed as the customer-profile **Add Service** builder. Tables physically renamed.
- **F. Terminology** → **Service** (per-customer) / **Service Template** (global) / **Service Call** (dated job). Retire "service cycle" as user-facing vocab; keep the `selection_cycles` table name.

---

## 8. Open Questions / Deferred

- **Editing a Service that already has generated Service Calls** — when frequency/schedule changes on an existing service, do we regenerate future (open) service calls, or only affect the next generation? Completed calls must never move (they carry job_costs/reviews). Decide at C1.
- **"Save as template" scope** — ✅ RESOLVED (C3): **definition-only** (name/frequency/deadlines/tasks). Per-customer hours/price are never copied into a shared template.
- **Multiple services per customer** — the model supports N services per customer (N cca rows already allowed). Confirm the builder/UI treats the customer's service list as a first-class list (it should).
- **Template deletion with live services** — templates are decoupled, so deleting a template must not cascade to `customer_services`. Enforce `template_id ON DELETE SET NULL` at 021.
- **`002_scheduling_format` interplay** — `day_of_week` moves onto `customer_services` (already there via cca). Business-level `scheduling_format` still governs which picker the builder shows. No change needed; noted for C2.
