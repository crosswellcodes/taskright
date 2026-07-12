# Create-Flow Team Assignment — Spec

**Status:** ✅ BUILT (July 11, 2026). No migration. Backend **121/121** green (11 new tests in `createFlowAssignment.test.js`). Shipped exactly as planned; the only refinement was **validate-first-then-create** in place of a DB transaction (same "no half-create" guarantee, no `trx` plumbing — see §4.2). RN sim verification is the user's.

**Build notes (what landed where):**
- **Backend** (`businessService.js`): `assertAssigneeOwnedByBusiness` (XOR + member/group ownership → 400/404), `fanOutServiceAssignment` (open-Calls-only upsert), `assignServiceTeam` (service+assignee ownership → fan-out, returns `{ assignedCount }`). `createCustomerServiceForBusiness` validates the optional `assignee` **before** creating, then fans out. New route `PUT .../services/:serviceId/assignment` (`businesses.js`).
- **Mobile**: shared controlled `components/AssigneePicker.js` (extracted from `ForecastDayScreen`, which now consumes it in immediate-write mode — behavior parity). `AssignCycleScreen` gained the optional create-only assign section (deferred mode; frequency-aware copy; group labor-note; hidden when no team) and threads `assignee` into the atomic create. Client `createCustomerService` unchanged (passes body through). Standalone-endpoint client helper deferred (not needed — create uses the atomic path).

---

**Original plan (as approved pre-build — July 10, 2026, via design discussion). No migration. Target: keep backend tests green through the change; RN sim verification is the user's.**

**Goal:** make creating a service a **full-circle** experience — define the service, set its schedule, **and optionally assign a person or group to the resulting visits, all on one screen** — without disturbing the existing date-centric dispatch view. Two entry points to assignment, **one underlying model**.

**Companion specs:** extends `SERVICE_MODEL.md` (per-customer Services) and `SERVICE_TASK_OWNERSHIP.md` (Phase 2 task ownership). Interacts with `JOB_COSTING.md` (labor/profitability — see the Deferred section).

---

## 1. Motivation — one sale, two corners of the app

Today the owner builds a service in one place and assigns personnel in another:

- **Definition + schedule** → the Service builder (`AssignCycleScreen`, create mode): name, frequency, tasks, hours, selection deadline, price, and the date/day. On save it generates the **Service Calls** (`selection_cycles` — 4 for a recurring service, 1 for a `one_time` sale) and returns to the customer.
- **Team assignment** → the **dispatch view** (`ForecastDayScreen`, Dashboard → a service day). Organized *by date*: assign a person/group to each customer's Service Call happening that day. This is deliberately day-centric (a cleaner does several customers per day).

So finishing a sale means hopping from the customer's builder to the dashboard's dispatch view. This spec adds a **service-centric** assignment path *inside the create flow* while **keeping the dispatch view exactly as-is**.

### 1.1 Why this is not a "frankenstein" (the structural argument)

Both paths write **the same row, in the same table, through the same logic**:

- `service_assignments` (id, business_id, **selection_cycle_id**, team_member_id XOR team_id) — one row per Service Call.
- The write is an **upsert keyed on `selection_cycle_id`** (`upsertServiceAssignment`), so **last-write-wins with no conflict**. Assign in the create flow, override on the dashboard tomorrow → the dashboard simply overwrites the same row and reads live on focus.

There is **one source of truth and two thin views over it**, not two systems. "Non-required" is free: an unassigned Service Call is already the normal state (`team_member_id`/`team_id` are nullable). Skip the new option → **zero rows written, dispatch flow untouched.**

### 1.2 Current-state anchors (verified July 10, 2026)

| Concern | Where |
|---|---|
| Service create (generates Calls) | `POST /businesses/:bid/customers/:cid/services` → `createCustomerServiceForBusiness` → `createCustomerService` → `generateUpcomingSelectionCycles`; returns `{ success, service }` (the `customer_services` row — **no call ids today**) |
| Assignment model | `service_assignments` (team_member_id XOR team_id, per `selection_cycle_id`) |
| Assignment write | `upsertServiceAssignment(businessId, selectionCycleId, {teamMemberId}|{teamId})`; `PUT /assignments/:selectionCycleId`. **Note: does not currently validate assignee/cycle ownership** — the new service-level path will. |
| Dispatch UI (kept) | `ForecastDayScreen` — iOS `ActionSheetIOS` two-step picker (step 1 person/group/remove; step 2 pick member/group); immediate write on choose |
| Team data (mobile) | `getTeamMembers` (businessApi:78), `getTeamGroups` (businessApi:145) |
| Labor gap | Auto labor is **individual-only** (D3): a **group**-assigned Call gets no auto labor lines → profitability blank on cost side. See Deferred. |

---

## 2. Target Model & Resolved Decisions

- **D1 — Two paths, one model.** Create-flow assignment and dashboard dispatch both write `service_assignments` via shared logic. No new assignment table, no new state.
- **D2 — Create-flow assignment is OPTIONAL and set-only.** Skipping writes nothing. Removal/per-visit override lives on the dashboard (unchanged).
- **D3 — Recurring scope = ALL upcoming visits.** For a recurring service the create-flow choice assigns the **same person/group to every currently-generated open Call** (the 4). For `one_time`, the single Call. Any single visit can still be overridden later on the dashboard.
- **D4 — Fan-out lives in the service layer, exposed two ways** (approved refinement):
  - an **optional `assignee` on the create request** → service created **and** its Calls assigned in **one atomic transaction** (no partial-failure seam, one round-trip), and
  - a **standalone service-level endpoint** for reuse (bulk reassign-all-visits later).
- **D5 — Shared picker is a controlled component** (`value` + `onChange`). Dashboard = immediate-write mode (`onChange` → PUT now). Create = deferred mode (`onChange` → local state → applied on "Create Service"). Same UI/code, behavior driven by the parent.
- **D6 — UX = single scroll, not a stepped wizard.** The assign section is an optional block **after** the schedule section in the existing create scroll. **Edit mode is unchanged** (create-flow assignment is a convenience; editing assignments already has a home on the dashboard).
- **D7 — Labor gap acknowledged in copy, not solved.** When a **group** is selected, show a note: "Team-assigned visits won't auto-calculate labor cost yet." (Team labor is the next-up spec — see Deferred.)

---

## 3. Downstream Preservation

| Consumer | Action |
|---|---|
| `ForecastDayScreen` dispatch view | **No change.** Still the authoritative day-centric manage/override surface. |
| `service_assignments` shape + `PUT /assignments/:callId` + DELETE | **No change.** Create-flow reuses the same upsert logic. |
| `ServiceCallDetailScreen` (assignment display, `isTeamAssigned`) | **No change.** |
| Job costing / profitability | **No change** to logic. Group-assigned visits still get no auto labor (Deferred). |
| Edit-service flow | **No change.** |

**No migration.** Nothing about the data model changes.

---

## 4. Backend Changes

### 4.1 Service layer — the fan-out
Add `assignServiceTeam(businessId, serviceId, assignee)` (name TBD) in `businessService.js`:
- Validate the service belongs to the business (via `getOwnedCustomerService`).
- **Validate the assignee belongs to the business** (team member OR team group ownership) — closes the pre-existing gap; return `404`/`400` on mismatch.
- Enforce **XOR** (exactly one of `teamMemberId`/`teamId`).
- Resolve the service's **open** Calls (`selection_cycles` where `status='open'`, `customer_service_id = serviceId`) and `upsertServiceAssignment` each. **Never touches completed Calls.**
- Idempotent (upsert per Call).

### 4.2 Create request — optional atomic assignee
`POST /businesses/:bid/customers/:cid/services` accepts an optional `assignee: { teamMemberId } | { teamId }`. When present, after generating the Calls, run `assignServiceTeam` **in the same flow/transaction**. A validation failure on `assignee` fails the whole create (400) so we never half-create. Response unchanged shape (`{ success, service }`); optionally include assigned count.

### 4.3 Standalone service-level endpoint (reuse)
`PUT /businesses/:bid/customers/:cid/services/:serviceId/assignment` with body `{ teamMemberId } | { teamId }` → `assignServiceTeam`. Open-calls-only. (A `DELETE` variant to clear all is optional/deferred — dashboard already handles per-visit removal.)

### 4.4 Ownership validation helper
Add a small `assertAssigneeOwnedByBusiness(businessId, assignee)` used by both the create path and the new endpoint (and optionally back-fill the existing `PUT /assignments/:callId` route for consistency — low-risk hardening).

---

## 5. Mobile Changes

### 5.1 Shared controlled `AssigneePicker` component
Extract the member/group selection out of `ForecastDayScreen` into a reusable component:
- Props: `{ teamMembers, teamGroups, value, onChange, allowRemove }` where `value = { type:'member'|'group', id, name } | null`.
- Presentation: the existing iOS `ActionSheetIOS` two-step flow (person/group[/remove] → pick), triggered by a tappable row that shows the current selection.
- `ForecastDayScreen` refactors to use it in **immediate-write** mode (`onChange` → `upsertServiceAssignment`) — behavior identical to today.

### 5.2 Create screen (`AssignCycleScreen`) — optional assign section
- New **"Assign (optional)"** block **after** the schedule section (create mode only; not in edit).
- Loads `getTeamMembers` + `getTeamGroups`. If both empty → **hide the section** (or show a subtle "Add team members to assign here").
- Uses `AssigneePicker` in **deferred** mode → holds a pending `assignee` in local state.
- **Frequency-aware copy:** `one_time` → "Assign to this visit (optional)"; recurring → "Assign to all N upcoming visits (optional)" (N = generated call count, i.e. 4).
- **Group-selected note (D7):** "Team-assigned visits won't auto-calculate labor cost yet."
- On **Create Service**: include `assignee` in the create payload (atomic). No separate assign call from the client.

### 5.3 Client (`businessApi.js`)
- `createCustomerService` already passes the body through → just include `assignee`. (Add a helper for the standalone endpoint if/when used elsewhere.)

---

## 6. Phased Plan (attack step by step)

Each step independently verifiable; backend suite green from Step A onward.

- **Step A — Backend fan-out + endpoints.** `assignServiceTeam` + ownership helper; create accepts optional `assignee` (atomic); standalone `PUT .../services/:id/assignment`. Open-calls-only. Tests: create-with-member, create-with-group, fan-out hits all open calls, ownership 404, XOR, one_time = 1 call. Keep suite green.
- **Step B — Shared `AssigneePicker`.** Extract from `ForecastDayScreen`; refactor dispatch to consume it (immediate mode). Babel-check; behavior parity (user sim-verifies dispatch still works).
- **Step C — Create-screen assign section.** Optional block in `AssignCycleScreen` (deferred mode, frequency-aware copy, group note, empty-team hide); wire `assignee` into create. Babel-check.
- **Step D — Docs + memory.** Update this spec → built; `HANDOFF.md`, `API_REFERENCE.md` (create `assignee`, new endpoint), `DOC_REGISTRY.md`. Commit to `main`.

*(No migration step. Edit-mode untouched.)*

---

## 7. Test Plan (backend)
- Create with `assignee: {teamMemberId}` → all open Calls of the service get that member; completed Calls untouched.
- Create with `assignee: {teamId}` → all open Calls get that team.
- `one_time` create with assignee → the single Call assigned.
- Standalone endpoint reassigns all open Calls (upsert overwrites).
- Ownership: assignee from another business → 404/400; service from another business → 404.
- XOR: both `teamMemberId` and `teamId` → 400; neither → create still succeeds unassigned.
- Dashboard `PUT /assignments/:callId` still overrides a single Call after create-flow assignment (last-write-wins).

---

## 8. Deferred / Next-up

- **Team labor costing (top of mind — see memory `project-team-labor-deferred`).** Auto labor is individual-only (D3); group-assigned visits get **no** labor lines → profitability incomplete. This change makes that gap more visible (easy to group-assign all visits). **This spec only acknowledges it in copy.** The natural follow-on spec: a team-labor model (per-member hours within a group job, or a group rate/allocation) so group visits roll into profitability.
- **Clear-all-visits DELETE** on the service-level endpoint — deferred (dashboard handles per-visit removal).
- **Option (c) "default assignee" on the service** that auto-applies to *future regenerated* Calls — deferred; additive upgrade if auto-repeat/regeneration ever lands.
