# Service Model — Per-Service Task Ownership (Phase 2)

**Status:** ✅ BUILT → FEATURE COMPLETE (July 8, 2026). Steps A–E shipped. Migration **023** run on both DBs; global `tasks` table + Tasks tab retired; tasks owned per-service (`service_tasks`) and per-template (`template_tasks`). **104/104 backend tests.** Extends `SERVICE_MODEL.md` (Components 1–4).

> **Build notes (what actually shipped):**
> - **Step A — Migration `023_per_service_task_ownership`** (both DBs): created `service_tasks` (`customer_service_id` FK CASCADE, name/time/`is_optional`, +temp `source_task_id`) and `template_tasks` (`template_id` FK CASCADE); backfilled from the two junctions (dev: 52 `service_tasks`, 47 `template_tasks`); remapped `selections.selected_tasks` global-id→`service_tasks.id` via `source_task_id` (guards non-array legacy values like `{}`); dropped both junctions + `tasks` + the temp column; indexed the owning FKs. `down()` is best-effort/lossy (dedups a global `tasks` by business+name+time — original ids not restored).
> - **Step B — Backend cutover.** `businessService.js`: removed global task CRUD + `validateTaskIds`; added `taskShape`/`validateTasks`; templates write/read `template_tasks`; services write/read `service_tasks`; `createCustomerServiceForBusiness` copies `template_tasks`→new `service_tasks` (ids dropped). **The §2.2 landmine:** `updateCustomerService` → **`diffUpsertServiceTasks`** (update-by-id / insert-new / delete-missing; a foreign/absent id falls through to insert), never wholesale delete+reinsert. `customerService.js` (menu/validation/totals/history) and the token flows read `service_tasks` directly. `routes/businesses.js`: deleted the 4 `/tasks` routes; service/template payloads take/return `tasks:[{id?,name,timeAllotmentMinutes}]`. Tests reworked (`helpers.js` `getServiceTasksForCustomer`; inline task objects across serviceModel/selections/serviceCycles/jobCosting/customers/forecast/reviewRequests; `tasks.test.js` deleted). A dedicated serviceModel test asserts diff-upsert keeps the kept row's id + updates in place.
> - **Step C — Service builder** (`AssignCycleScreen.js`): per-service inline task editor (`serviceTasks:[{id?,name,timeAllotmentMinutes,_key}]`; add/edit via a local modal, ✕ remove); edit preserves id+`_key` for stable diff-upsert; template apply copies `template.tasks` (ids dropped); save sends `tasks`. Babel-clean.
> - **Step D — Templates editor + cleanup:** `ServiceCyclesScreen.js` same inline editor against `template.tasks`; **Tasks tab removed** from `BusinessNavigator.js`; `TasksScreen.js` deleted; `getTasks/createTask/updateTask/deleteTask` pruned from `businessApi.js`. Customer-facing flow (`CurrentSelectionScreen`/`TaskPickerScreen`/`ConfirmationScreen`) unchanged — shape-compatible, ids just become `service_task` ids.
> - **Step E — Docs + commit** (this section; `SERVICE_MODEL.md` pointer, `HANDOFF.md`, `API_REFERENCE.md`, memory). **024 stays reserved.**

**Companion spec:** `SERVICE_MODEL.md` moved the *service definition* to per-customer ownership but left the **task menu** pointing at a business-global `tasks` table. This spec finishes that arc — tasks become owned by the service (and by the template), so editing a customer's task never touches another customer.

**Dependencies (must not break):** `JOB_COSTING.md`, `REVIEW_REQUESTS.md`, and the selection/completion/feedback chain — all anchor on `selection_cycles.id`, never on tasks. The only task-facing consumer that carries data forward is `selections.selected_tasks` (a JSON array of task ids), which the migration remaps.

---

## 1. Motivation — the last coupling seam

`SERVICE_MODEL.md` gave every customer their own `customer_services` row (name, frequency, deadlines, hours, price, schedule). But the **task menu** still resolves through a global table:

```
customer_services ──< service_task_assignments >── tasks (business-global)
service_templates ──< template_task_assignments >── tasks (business-global)
                                                      ▲
                              TasksScreen (Tasks tab) ─┘  global CRUD
```

A task row (`name`, `time_allotment_minutes`) is shared. Assigning "Vacuum – 30 min" to two customers points both at the **same row**; editing its time (via the Tasks tab, or by re-picking it elsewhere) changes the menu — and the selection hour math — for **every** service referencing it.

**This is live, not hypothetical.** In `task_app_db` (July 8, 2026): **13 of 23 tasks are shared across >1 service** (`service_task_assignments` grouped by `task_id`). That is exactly the cross-customer bleed we are removing.

### 1.1 Current-state audit (verified)

| Table | Role today | Task-facing columns |
|---|---|---|
| `tasks` (001) | Business-**global** task definitions | `business_id, name, time_allotment_minutes, is_optional` |
| `service_task_assignments` (021) | Per-service menu → **global** tasks | `customer_service_id, task_id` (UNIQUE pair) |
| `template_task_assignments` (021) | Per-template menu → **global** tasks | `template_id, task_id` (UNIQUE pair) |
| `selections.selected_tasks` (001) | Customer's chosen tasks for one Service Call | JSON array of **global** `task_id`s |

**Live snapshot (`task_app_db`, July 8 2026):** 23 tasks · 52 `service_task_assignments` · 47 `template_task_assignments` · 19 `customer_services` · 17 `service_templates` · 4 selections (3 with non-empty `selected_tasks`) · **13 tasks shared across multiple services.**

### 1.2 Backend consumers of the global `tasks` table

- **`businessService.js`** — `createTask/getTasksByBusiness/getTaskById/updateTask/deleteTask` (back the Tasks tab); `createCustomerService`/`updateCustomerService`/`getCustomerServiceDetail`/`validateTaskIds` (write/read `service_task_assignments`); `createCustomerServiceForBusiness` (template seed reads `template_task_assignments`); `createServiceTemplate`/`updateServiceTemplate`/`getServiceTemplatesByBusiness` (write/read `template_task_assignments`); `getUpcomingCustomerSelections` (menu join).
- **`customerService.js`** — current/next selection menu, `submitSelections` validation + hour total, history name readback — all join `service_task_assignments → tasks` and read `selected_tasks` ids against `tasks`.
- **`routes/businesses.js`** — `POST|GET|PUT|DELETE /:businessId/tasks`; service + template endpoints accept `taskIds`; `getCustomerServiceDetail` returns `taskIds`.

### 1.3 Mobile consumers

- **`AssignCycleScreen.js`** (Service builder) — multi-select against `getTasks`; `selectedTaskIds`; inline `createTask` (added this session).
- **`ServiceCyclesScreen.js`** (Templates editor) — same global multi-select for a template's menu.
- **`TasksScreen.js`** + **`BusinessNavigator.js`** — the global **Tasks tab** (global task CRUD).
- **`businessApi.js`** — `getTasks/createTask/updateTask/deleteTask`.
- **Customer side** (`CurrentSelectionScreen`, `TaskPickerScreen`, `ConfirmationScreen`) — consumes `availableTasks: [{id, name, timeAllotmentMinutes}]` and stores selected `id`s. **Shape-compatible with the new model** (ids just become `service_task` ids) → **no customer-side changes.**

---

## 2. Target Model

### 2.1 Concept

Tasks stop being a shared library. They are **owned**:

- **`service_tasks`** — a task owned by exactly one `customer_services` row. Built on the customer profile. Editing it affects only that customer's service.
- **`template_tasks`** — a task owned by one `service_templates` row (blueprint). "Save as template" snapshots a service's tasks here; "Start from template" copies these into a new service's `service_tasks` (copy-on-instantiate, isolated both directions).
- The global `tasks` table and the **Tasks tab** are **retired** — a task only ever exists inside a service or a template.

```
customer_services ──< service_tasks   (id, customer_service_id, name, time_allotment_minutes, is_optional)
service_templates ──< template_tasks  (id, template_id,        name, time_allotment_minutes, is_optional)

selections.selected_tasks  →  JSON array of service_tasks.id   (was global task ids)
```

### 2.2 Key decision — stable `service_task` ids (diff-upsert on edit)

Because `selections.selected_tasks` now references `service_tasks.id`, a service edit **must not churn ids** (today's code deletes+reinserts the whole `service_task_assignments` set, which was safe only because selections referenced stable *global* ids). New rule for `updateCustomerService`'s `tasks` payload:

- item **with `id`** → UPDATE in place (name/time).
- item **without `id`** → INSERT.
- existing row **absent from payload** → DELETE.

Never wholesale delete+reinsert. (Deleting a task still in an old selection is allowed — same as removing a menu item today; hours are stored on the selection, so it's cosmetic-only.)

### 2.3 Task shape

`{ id?, name, timeAllotmentMinutes }` everywhere at the API/client boundary. `is_optional` carried on the rows for fidelity (default `true`, matching today's `tasks` default); not surfaced in the builder v1.

---

## 3. Downstream Preservation

| Consumer | Keys off | Action |
|---|---|---|
| `job_costs`, `review_tokens`, `service_completions`, `service_assignments`, `geofence_events`, `feedbacks` | `selection_cycle_id` | **No change.** |
| `selections.selected_tasks` | global `task_id`s | **Remapped** to `service_tasks.id` in migration 023 (see §4). |
| Selection menu / validation / hour totals (`customerService.js`, `getUpcomingCustomerSelections`) | `service_task_assignments → tasks` | Read `service_tasks` directly (name/time on the row); validate `selected_tasks` against that service's `service_tasks.id`s. |
| Customer app (`availableTasks`, selected ids) | `{id,name,timeAllotmentMinutes}` | **No change** — same shape, ids now `service_task` ids. |

**Bottom line:** money/review/feedback are untouched (anchored on `selection_cycle_id`). The only data that moves is `selected_tasks`, remapped deterministically.

---

## 4. Migration 023 — single cutover (both DBs)

Additive → backfill → remap → drop, in one migration (backend cuts over in the same session; no dual-model deploy window).

**up():**
1. Create `service_tasks` (`id`, `customer_service_id` FK→`customer_services` ON DELETE CASCADE, `name`, `time_allotment_minutes`, `is_optional` default true, timestamps) **+ temporary `source_task_id` (nullable, no FK)** for the remap.
2. Create `template_tasks` (`id`, `template_id` FK→`service_templates` ON DELETE CASCADE, `name`, `time_allotment_minutes`, `is_optional`, timestamps).
3. Backfill `service_tasks` from `service_task_assignments sta JOIN tasks t` — one row per assignment, copying `t.name/time/is_optional`, `source_task_id = t.id`. (52 rows.)
4. Backfill `template_tasks` from `template_task_assignments tta JOIN tasks t`. (47 rows.)
5. **Remap `selections.selected_tasks`** (JS in-migration — 3 rows, deterministic): for each selection, resolve its `selection_cycle → customer_service_id`; build `{ source_task_id → service_tasks.id }` for that service; rewrite the array. Unmappable ids (task removed from the menu after the selection) are dropped — cosmetic only, since `selected_total_hours` is stored on the selection.
6. Drop `service_task_assignments`, `template_task_assignments`, then `tasks`; drop `service_tasks.source_task_id`.
7. Index `service_tasks(customer_service_id)` and `template_tasks(template_id)`.

**down():** best-effort, documented lossy on task-id identity — recreate `tasks` (dedup distinct `name/time` per business from `service_tasks`+`template_tasks`), recreate the two junctions, rebuild assignments, remap `selected_tasks` back. Re-migrating up() from the rebuilt state is safe; exact original task ids are not restored.

Run on `task_app_db` and `task_app_test`. **024 stays reserved.**

---

## 5. Navigation / IA

- **Tasks tab removed** from `BusinessNavigator.js`; `TasksScreen.js` deleted. Tasks are authored inside a service or template.
- **Service builder** (`AssignCycleScreen`) — task section becomes a per-service editor: list of this service's tasks, each row edit/removable (name + time), "+ New task" adds one. No global list, no `getTasks`.
- **Templates editor** (`ServiceCyclesScreen`) — same inline editor against the template's own tasks.

---

## 6. Phased Plan (attack step by step)

Each step is independently verifiable; backend suite must be green at the end of Step B onward.

### Step A — Migration 023
- Write + run on both DBs. Verify: 52 `service_tasks`, 47 `template_tasks`, `selected_tasks` remapped (spot-check the 3), `tasks`/junctions gone.

### Step B — Backend cutover (keep tests green)
- `businessService.js`: remove task CRUD (`createTask` … `deleteTask`) + `validateTaskIds`; `createCustomerService`/`updateCustomerService` take `tasks:[{id?,name,timeAllotmentMinutes}]` with **diff-upsert** (§2.2) writing `service_tasks`; `getCustomerServiceDetail` returns `tasks` objects; `createCustomerServiceForBusiness` seeds from `template_tasks`; template create/update take `tasks` → `template_tasks`; `getServiceTemplatesByBusiness` returns task objects; `getUpcomingCustomerSelections` reads `service_tasks`.
- `customerService.js`: current/next menu, `submitSelections` validation + totals, history readback → `service_tasks`.
- `routes/businesses.js`: delete the 4 `/tasks` routes; service + template endpoints accept `tasks`; detail returns `tasks`.
- Rewrite `serviceModel.test.js`, `selections.test.js`, helpers (`helpers.js` seed no longer mints global tasks — services/templates carry tasks inline); drop tasks-route tests. **Target 100%.**

### Step C — Mobile: Service builder
- `AssignCycleScreen.js`: per-service task editor (state `serviceTasks:[{id?,name,timeAllotmentMinutes,_key}]`; add/edit/remove; send `tasks`). Drop `getTasks/createTask/selectedTaskIds`. Template apply fills `serviceTasks` from `template.tasks`. Babel-check.

### Step D — Mobile: Templates + cleanup
- `ServiceCyclesScreen.js`: inline template-task editor (same component pattern) against `template.tasks`.
- Remove `TasksScreen` + its tab in `BusinessNavigator.js`; prune `getTasks/createTask/updateTask/deleteTask` from `businessApi.js`. Babel-check changed files.

### Step E — Docs + commit
- Update this spec's status + build notes; add a Phase-2 pointer atop `SERVICE_MODEL.md`; update `HANDOFF.md`, `API_REFERENCE.md` (service/template payloads: `taskIds`→`tasks`; remove `/tasks` routes), `DOC_REGISTRY.md`, and memory. Commit to `main`.

---

## 7. Resolved Decisions

- **Model** → true per-service task ownership (`service_tasks`) + per-template ownership (`template_tasks`). Global `tasks` table retired.
- **Cut scope** → full clean cut: templates and the **Tasks tab** move off global tasks too (Tasks tab deleted).
- **Isolation grain** → per **service** (not per customer): even two services on the same customer have independent task lists.
- **Edit semantics** → diff-upsert with stable `service_task` ids (§2.2) so live selections never orphan.
- **Migration** → single 023 cutover; `selected_tasks` remapped via temp `source_task_id`; lossy-but-functional down().
- **Builder UX** → inline "+ New task" (name + time), edit/remove rows; no global picker. (Modal-style creation confirmed this session.)

## 8. Open Questions / Deferred

- **`is_optional` in the builder** — carried on rows, not surfaced in v1. Revisit if optional-task UX is wanted.
- **Cross-service reuse within a business** — deliberately dropped. If owners later want a "copy tasks from another service" shortcut, add it as a copy action (still produces independent rows), not a shared reference.
- **Split 023 into 023/024** — chosen single-migration since backend cuts over same-session; note the split alternative if a mid-deploy window is ever needed.
