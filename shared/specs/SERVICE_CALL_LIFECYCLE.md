# Service Call Lifecycle — Proposed → Confirmed → Actual — Spec

**Status:** 📋 PLANNED (approved pre-build — July 14, 2026, via design discussion). **No migration** (all data derivable from existing tables). Target: keep backend tests green (currently 136/136); RN sim verification is the user's.

**Goal:** after an owner completes the service-create flow, the created service's **Service Calls should be legible immediately** — showing the *proposed / expected* scope (default tasks, expected hours, expected price, assignment) while a Call is in flight, then **switching to real data** as the customer confirms their task selection and/or the job is completed. Today a freshly-created Call's detail screen is nearly empty until the customer acts, so the owner can't see "what's in flight."

**Companion specs:** builds directly on `SERVICE_MODEL.md` (per-customer `customer_services` definition + default `service_tasks` menu), `CREATE_FLOW_ASSIGNMENT.md` (assignment shown in the proposed state), `JOB_COSTING.md` / `TEAM_LABOR_COSTING.md` (actual labor + margin in the completed state). Anchors on `selection_cycles` (per-Call) + `selections` (customer confirmation) + `service_completions` (done).

---

## 1. Motivation — the "in-flight" blind spot

A per-customer **Service** (`customer_services`) fans out into N **Service Calls** (`selection_cycles`; 4 for recurring, 1 for `one_time`). Each Call carries the customer's task **selection** (`selections`, `draft`→`submitted`) and, once done, a **completion** (`service_completions`) plus geofence labor.

The create flow generates the Calls but the owner has no useful view of them until the customer submits a selection:
- `ServiceCallDetailScreen` **Tasks** section renders `detail.selectedTasks` — which is empty pre-submission, so it shows *"Customer has not submitted their task selection yet."*
- `computeEstimatedHours` (used by `getJobCosts`) returns **0** with no submitted selection — it keys off the `selections` row, not the service definition.
- Expected price lives on `selection_cycles.price` (copied from `customer_services.price_per_visit` at generation — D2) and only surfaces in the costing section; there's no "this is the *expected* number" framing.

Yet the **proposed scope already exists**: the service definition holds the default task menu (`service_tasks` for the `customer_service_id`), `total_hours`, and `price_per_visit`. This spec surfaces that as the Call's proposed state and transitions it to confirmed/actual as reality arrives.

### 1.1 Latent bug this fixes
`selections.selected_tasks` stores task **ids** (a JSON array of `service_tasks.id`), but `ServiceCallDetailScreen` maps them as objects (`task.name || task.taskName || \`Task ${idx+1}\``) → it currently renders **"Task 1, Task 2, …"** for submitted selections. Resolving ids→names in the detail payload (required for the confirmed state anyway) fixes this.

### 1.2 Current-state anchors (verified July 14, 2026)

| Concern | Where | Note |
|---|---|---|
| Owner Call detail (backend) | `getServiceCallDetail` (businessService.js:1455) + route (businesses.js ~581) | Returns raw `selected_tasks` ids, `selectionStatus`, completion, assignment. **No** default menu, expected hours, or resolved task names. |
| Owner Call detail (mobile) | `ServiceCallDetailScreen.js` | Tasks section empty pre-submission; renders ids as "Task N"; hours/price only in costing section. |
| Service definition | `customer_services` (total_hours NOT NULL, price_per_visit, name, frequency, day_of_week) + `service_tasks` (default menu, per `customer_service_id`) | The proposed baseline. |
| Confirmation | `selections` (status `draft`→`submitted`, `selected_tasks` ids, `selected_total_hours`) | The confirmed scope. |
| Completion | `selection_cycles.status` (`open`→`completed`) + `service_completions` + `job_costs` (labor/margin) | The actual state. |
| Access path | `CustomerDetailScreen` → `upcomingServices` list → `ServiceCallDetail` (create flow `goBack`s here) | Unchanged (SCL2). |

---

## 2. Resolved Decisions

- **SCL1 — Entry point = the per-Call detail screen only.** No new service-level overview screen. Enhance `ServiceCallDetailScreen` to carry the proposed→confirmed→actual states. The owner reaches Calls the way they do today (via the customer's upcoming-services list). *(Chosen over a new service-overview screen; revisit if a multi-Call roll-up is wanted later — see Deferred.)*
- **SCL2 — Post-create navigation unchanged.** "Create Service" still `goBack`s to `CustomerDetailScreen`; the owner opens a Call from the `upcomingServices` list. No auto-navigate, no post-create summary screen. *(A lifecycle badge on those list rows is in-scope polish so the list itself shows "what's in flight" — §5.3.)*
- **SCL3 — Proposed state shows the full expected scope.** Before confirmation, the Call renders the **default task menu** (all `service_tasks` for the service), **expected hours** (`customer_services.total_hours`), **expected price** (`selection_cycles.price` ← `price_per_visit`), and the **assignment** — every one visibly labeled *proposed / expected / awaiting confirmation*. *(Chosen over tasks-only or tasks+hours.)*
- **SCL4 — State model = two axes, one derived label.** Scope source: **proposed** (default menu) vs **confirmed** (customer's submitted selection). Call status: **in-flight** (`open`) vs **completed**. The backend collapses these into a single derived `lifecycleState` ∈ `proposed | confirmed | completed` **plus** a resolved `tasks[]` with a `source` flag, so the client renders without re-deriving. Completion and confirmation are independent (a Call can complete without a submitted selection — see SCL7).
- **SCL5 — No migration.** Everything derives from `customer_services` + `service_tasks` + `selections` + `service_completions` + `job_costs`. Read/derive + presentation only.
- **SCL6 — Resolve task ids → names + compute the right hours in the payload.** The detail endpoint resolves `selected_tasks` ids against `service_tasks` (fixes §1.1) and returns both **expected hours** (`total_hours`) and **confirmed hours** (Σ selected task minutes ÷ 60, i.e. today's `computeEstimatedHours`). The screen shows expected until confirmed, then confirmed.
- **SCL7 — Completed-without-confirmation falls back to the proposed menu.** If a Call reaches `completed` with no `submitted` selection, the "what was done" scope shows the **default menu** (flagged as *assumed — not customer-confirmed*), never an empty list. Actuals (completion time/notes, labor, margin) render regardless.

---

## 3. Downstream Preservation

| Consumer | Action |
|---|---|
| `getJobCosts` / profitability | **No change.** Still keys margin off `selection_cycles.price` + `job_costs`. The detail screen keeps rendering the costing section as-is in the completed state. |
| Customer-facing selection flow (`/s/[token]`, SMS keywords) | **No change.** This spec only reads `selections`; it never writes them. |
| `service_assignments` + create-flow assignment | **No change.** Assignment is displayed in the proposed state; resolution logic untouched. |
| Team-member app | **No change.** Member views (`getJobsForTeamMember` etc.) are separate from the owner Call detail. |
| Reschedule, price edit, manual cost lines | **No change.** Existing editors on `ServiceCallDetailScreen` remain; they simply live alongside the new state framing. |

---

## 4. Backend Changes (`businessService.js` + `businesses.js`)

**No new endpoints.** Extend `getServiceCallDetail(businessId, selectionCycleId)` and its route payload.

### 4.1 Additional data to fetch
1. **Default task menu** — `service_tasks` where `customer_service_id = sc.customer_service_id`, `{ id, name, time_allotment_minutes }` ordered by id. (The proposed scope.)
2. **Service definition** — `customer_services.total_hours`, `price_per_visit`, `frequency`, `day_of_week` (join already present via `svc`). Expose `total_hours` as `expectedHours`.
3. **Confirmed selection, resolved** — if a `selections` row exists, map its `selected_tasks` ids against the menu → `{ id, name, minutes }[]`; compute `confirmedHours` (Σ minutes ÷ 60).
4. **Expected price** — `selection_cycles.price` (already available; D2 copy).

### 4.2 Derived fields to return
- `lifecycleState`: `completed` if `sc.status = 'completed'`; else `confirmed` if a `submitted` selection exists; else `proposed`.
- `tasks[]`: the resolved list to render, each `{ id, name, minutes, source }` where `source ∈ 'proposed' | 'confirmed'`. In `proposed` → the full default menu (source `proposed`). In `confirmed` → the customer's submitted set (source `confirmed`). In `completed` → confirmed set if present, else default menu flagged (SCL7).
- `expectedHours` (from `total_hours`), `confirmedHours` (Σ selected minutes; null when unconfirmed), `expectedPrice` (`selection_cycles.price`).
- `scopeIsAssumed` (bool): true only in the SCL7 completed-without-confirmation case.

*Payload stays backward-compatible: keep `selectedTasks`/`selectionStatus` for any existing reader; add the new fields alongside.*

### 4.3 Route (`GET /businesses/:businessId/service-calls/:selectionCycleId` — existing)
Map the new service-layer fields into `serviceCall`. No signature change.

---

## 5. Mobile Changes (`ServiceCallDetailScreen.js`, light `CustomerDetailScreen.js`)

### 5.1 Lifecycle header
A state chip in the header card reflecting `lifecycleState`:
- **Proposed** (amber) — "Proposed · awaiting customer confirmation"
- **Confirmed** (blue) — "Confirmed by customer"
- **Completed** (green) — existing "Completed" treatment.

### 5.2 Sectional behavior by state
- **Tasks** — render `tasks[]`. In `proposed`, style as *expected* (muted rows + an "Expected scope — the customer hasn't confirmed yet" caption). In `confirmed`, solid rows + "Confirmed by customer." In `completed`, show the done scope (+ the SCL7 "assumed scope" caption when `scopeIsAssumed`). Resolve **names** from the payload (fixes §1.1).
- **Hours** — new row in the schedule/detail block: show `expectedHours` labeled "Expected" in `proposed`; switch to `confirmedHours` labeled "Confirmed" once confirmed. (Distinct from actual labor hours, which live in the completed costing section.)
- **Price** — the existing Price row gains an "Expected" qualifier while `proposed`/`confirmed`; unchanged once the owner overrides it.
- **Assignment** — unchanged, but shown as part of the proposed scope (already renders).
- **Completion + Job Costing (labor/margin)** — render only in `completed` (as today). This is the "switch to actuals."

### 5.3 Access list polish (in-scope, light)
`CustomerDetailScreen` `upcomingServices` rows show a small **lifecycle badge** (Proposed / Confirmed / Completed) so the list itself answers "what's in flight" (SCL2). Requires the list payload to carry each Call's state — either reuse `selection_cycles.status` + selection status already available on that screen, or add the derived label server-side where that list is built. Keep it to a badge; no row redesign.

---

## 6. Phased Plan

- **Step A — Backend.** Extend `getServiceCallDetail` (§4) + map into the route payload. Add §7 tests (derivation of `lifecycleState`, resolved names, expected vs confirmed hours, SCL7 fallback). Keep the suite green.
- **Step B — Mobile Call detail.** State chip + sectional proposed/confirmed/actual rendering (§5.1–5.2). Babel-check.
- **Step C — Access list polish.** Lifecycle badge on `CustomerDetailScreen` upcoming rows (§5.3). Babel-check.
- **Step D — Docs + memory.** This spec → built; sync `API_REFERENCE.md` (enriched `service-calls/:id` payload — no new endpoints), `SERVICE_MODEL.md` (Call lifecycle view), `HANDOFF.md`, `DOC_REGISTRY.md`; memory.

*(No migration step.)*

---

## 7. Test Plan (backend)

- **Proposed:** a freshly-created Call (no selection) → `lifecycleState = 'proposed'`, `tasks[]` = full default menu with `source='proposed'`, `expectedHours = total_hours`, `confirmedHours = null`, `expectedPrice` set.
- **Confirmed:** after a `submitted` selection → `lifecycleState = 'confirmed'`, `tasks[]` = the selected subset with resolved **names** + `source='confirmed'`, `confirmedHours` = Σ selected minutes ÷ 60.
- **Name resolution (regression for §1.1):** returned tasks carry real `name`s, never "Task N".
- **Completed (confirmed):** `status='completed'` with a submitted selection → `lifecycleState='completed'`, tasks = confirmed set, `scopeIsAssumed=false`.
- **Completed (SCL7 fallback):** `status='completed'` with **no** submitted selection → `lifecycleState='completed'`, tasks = default menu, `scopeIsAssumed=true`.
- **Partial confirmation:** a `draft` (not submitted) selection → still `proposed` (draft is not a confirmation).
- **Ownership:** another business's Call → 404 (unchanged).

---

## 8. Deferred / Next-up

- **Service-level overview screen** (a roll-up of all a service's Calls with per-Call lifecycle state) — rejected for v1 (SCL1); the per-Call screen + list badges cover the immediate need. Revisit if owners want a single "service dashboard."
- **Auto-navigate / post-create summary** — rejected for v1 (SCL2). Additive later if the create→view path feels indirect.
- **Proposed-scope editing from the Call** (owner tweaks the expected task set for a single upcoming Call before the customer confirms) — out of scope; today scope changes live on the Service definition. Candidate follow-on.
- **Customer-confirmation nudges** (owner-visible "reminder sent / overdue" against `submission_deadline`) — related but separate; the deadline is already on the payload.
