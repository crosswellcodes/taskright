# Team Labor Costing — Spec

**Status:** 📋 PLANNED (approved pre-build — July 13, 2026, via design discussion). **No migration.** Target: keep backend tests green through the change (currently 121/121); RN sim verification is the user's.

**Goal:** close the **D3 gap** — group-assigned Service Calls currently record **no labor**, so profitability is blank on the cost side for any job handed to a team. Make a group assignment mean *"every member of the team is individually on this job,"* reusing the existing per-member labor machinery wholesale. After this, a team job's labor table and profitability populate the same way an individually-assigned job's do.

**Companion specs:** closes the deferred item in `JOB_COSTING.md` / `JOB_COSTING_DATA_GAPS.md` (D3, "Option A") and the labor-gap note carried in `CREATE_FLOW_ASSIGNMENT.md` (D7). Anchors on `service_assignments` + `job_costs` (per `selection_cycle_id`, per `team_member_id`).

---

## 1. Motivation — the gap create-flow assignment made easy to hit

Auto labor is **individual-only** today. A Call assigned to a **team** (`service_assignments.team_id` set, `team_member_id` null) is **invisible to every member**: the three member-facing resolvers all filter strictly on `sa.team_member_id`, so a group job never appears in anyone's "My Jobs", never gets a geofence event, and never produces a `job_costs` labor line. Since `job_costs` is per-member, **team-job labor produces nothing** and the profitability card shows revenue but no cost.

Session 16 (Create-Flow Team Assignment) made this gap **one tap to hit**: an owner can now group-assign every visit of a service at creation. That feature only *acknowledges* the gap in copy ("Team-assigned visits won't auto-calculate labor cost yet"). This spec removes that caveat by making it real.

### 1.1 The structural insight (why this is small)

Labor is already keyed on `team_member_id`, **not** on the assignment type:
- `recordGeofenceEvent` creates/updates one `job_costs` labor row **per member+job** at that member's own `hourly_rate` (snapshotted), guarded by the Rule-6 partial unique index `(selection_cycle_id, team_member_id, cost_category_id) WHERE team_member_id IS NOT NULL`.
- `getJobCosts` already returns a **`laborLines[]` array** keyed per member (name/hours/rate/amount/source) and sums them — it renders N members with no change.

So the entire cost/display/aggregate side already supports many members on one Call. **The only thing missing is *visibility*** — letting a group's members reach the job. Broaden the four member-facing resolvers from *"assigned individually"* to *"assigned individually **or** a member of the assigned team,"* and every downstream behavior (geofence → per-member labor → Rule-6 upsert → labor table → profitability) works unchanged. **No migration; no new cost model.**

### 1.2 Current-state anchors (verified July 13, 2026)

| Concern | Where | Note |
|---|---|---|
| Member job list | `getJobsForTeamMember` (businessService.js:1345) | `.where('sa.team_member_id', teamMemberId)` — individual-only |
| Job detail gate | `getJobDetail` (businessService.js:1372) | assignment check `team_member_id` only → 404 for group members |
| Completion gate | `completeJobForTeamMember` (businessService.js:1456) | assignment check `team_member_id` only; **already** returns `409 ALREADY_COMPLETED` if the Call/row exists → first-wins is already the semantics |
| Geofence + auto labor | `recordGeofenceEvent` (businessService.js:1671) | assignment check `team_member_id` only; departure branch creates per-member labor at member's rate (Rule-6 upsert, D1 manual-guard, null-rate → $0.00) |
| Group membership junction | `team_memberships` (team_id, team_member_id) | **NOT** `team_group_members` (stale name in older docs) |
| Cost/aggregate display | `getJobCosts` (businessService.js:1974) | already returns per-member `laborLines[]`; team-assigned empty-state is a **UI** convention, not a data limit |

---

## 2. Resolved Decisions

- **TL1 — Capture model = Option A (members clock in individually).** A group assignment resolves to *all members of that team*, each individually on the job. Broaden the member-facing resolvers to include team membership; each member records their own geofence → their own per-member labor line. Reuses all existing labor machinery. *(Chosen over owner-entered manual labor and over a group flat-rate.)*
- **TL2 — Rate source = each member's own `team_members.hourly_rate`.** `amount = hoursActual × that member's rate`, snapshotted at departure — identical to individual labor. **No new schema.** A null rate → `$0.00` with hours still recorded (existing Rule 2 null-rate warning surfaces). *(Chosen over a group-level rate column.)*
- **TL3 — Completion = all members see it, first-to-complete wins.** Every member of the assigned team sees the Call and can mark it complete; the **first** completion writes the single `service_completions` row and flips the Call to `completed`. Subsequent completes are a **benign no-op** (backend already returns `409 ALREADY_COMPLETED`; the mobile client must render this as *"a teammate already completed this"*, not an error). Members can still record their own geofence/labor after completion (hours worked count regardless of who closed the Call). *(Chosen over owner-only completion and over per-member completion, which would need a new completion concept.)*
- **TL4 — Dedup.** A member who is on a Call **both** individually and via an assigned team resolves to **one** job entry (DISTINCT on `selection_cycle_id`) and **one** labor row (Rule-6 index already enforces one per member+job+category).
- **TL5 — No migration.** Everything reuses existing tables, the per-member labor row, and the Rule-6 index (which already keys on `team_member_id`, valid for N members on one Call).

---

## 3. Downstream Preservation

| Consumer | Action |
|---|---|
| Individual assignment flow (job list, detail, geofence, complete) | **No change** — the broadened predicate is a superset; individual-only jobs behave exactly as today. |
| `job_costs` shape, Rule-6 index, D1 manual-guard, null-rate Rule 2 | **No change** — per-member labor rows already fit N members. |
| `getJobCosts` / profitability aggregation | **No change to logic** — the `laborLines[]` array simply becomes non-empty for group jobs. |
| Dashboard dispatch (`ForecastDayScreen`) + create-flow assignment | **No change** — they still assign a team to the Call; this spec only changes how members *resolve* that assignment. |
| Review requests (geofence departure trigger) | **No change** — `maybeCreateReviewRequest` is one-per-job (token reuse); multiple members departing still fire at most one SMS. |

---

## 4. Backend Changes (`businessService.js`)

### 4.1 Shared assignment-resolution predicate
Add one helper used by all four resolvers so the "is this member on this Call?" rule lives in exactly one place:

```
isMemberAssignedToCall(teamMemberId, selectionCycleId):
  EXISTS service_assignments sa
    WHERE sa.selection_cycle_id = :cycle
      AND ( sa.team_member_id = :member
            OR sa.team_id IN (SELECT team_id FROM team_memberships WHERE team_member_id = :member) )
```

- `assertMemberAssignedToCall(teamMemberId, selectionCycleId)` → returns the matching assignment or throws `404` (reuses today's error). Used by `getJobDetail`, `completeJobForTeamMember`, `recordGeofenceEvent` (replacing their `team_member_id`-only lookups).

### 4.2 `getJobsForTeamMember` — include group jobs
Rewrite the `.where('sa.team_member_id', …)` to match individual **or** team-membership assignments, **DISTINCT on `sc.id`** (TL4). Payload shape unchanged (`MyJobsScreen` needs no shape change). Optionally add `isTeamAssigned` / `teamName` to the row for a "Team job" badge (see §5).

### 4.3 Geofence + labor — no logic change
Once the §4.1 gate admits a group member, `recordGeofenceEvent`'s departure branch already: recomputes on-site hours, looks up **that member's** rate, upserts one labor row per member+job (Rule 6), guards manual rows (D1), and records $0.00 with hours on a null rate (Rule 2). **Nothing to change beyond the gate.**

### 4.4 Completion — first-wins is already correct
`completeJobForTeamMember` already throws `409 ALREADY_COMPLETED` when the Call/row exists. After broadening its gate (§4.1), any team member can be the first to complete; the rest get the benign 409. **No new logic** — just the gate + client handling (§5).

*No new endpoints. No migration.*

---

## 5. Mobile Changes

The heavy lifting is backend/query; the mobile surface is light.

### 5.1 Member side (mostly free)
- `MyJobsScreen` — group jobs now arrive from the broadened `getJobsForTeamMember` with the **same shape**; the list renders them with no change. *Optional polish:* a small "Team" badge when `isTeamAssigned`.
- `JobDetailScreen` — geofence clock-in/out and "Mark Complete" work unchanged. Handle the **first-wins 409** gracefully: if complete returns `ALREADY_COMPLETED`, show *"A teammate already marked this complete"* and refresh into the completed state (don't surface a raw error). If the job opens already-completed, the member can still clock out (labor still records).

### 5.2 Owner side — remove the now-obsolete caveats
The D3 empty-state and labor-gap copy become **false** once this ships and must be removed:
- `ServiceCallDetailScreen` — drop the team-assigned "no auto labor" empty state (Session 11); the labor table now lists each group member's line automatically.
- `AssignCycleScreen` — remove the group labor-gap note ("Team-assigned visits won't auto-calculate labor cost yet", Session 16 / D7).

---

## 6. Phased Plan (attack step by step)

- **Step A — Backend.** Add `isMemberAssignedToCall` / `assertMemberAssignedToCall`; broaden `getJobsForTeamMember` (DISTINCT), `getJobDetail`, `completeJobForTeamMember`, `recordGeofenceEvent`. Add §7 tests. Keep the suite green.
- **Step B — Mobile member side.** Verify group jobs surface + clock-in works; graceful first-wins 409 in `JobDetailScreen`; optional "Team" badge. Babel-check changed files.
- **Step C — Mobile owner side.** Remove the D3 empty-state (`ServiceCallDetailScreen`) + the create-flow group note (`AssignCycleScreen`). Babel-check.
- **Step D — Docs + memory.** This spec → built; update `JOB_COSTING.md` + `JOB_COSTING_DATA_GAPS.md` (D3 Option A shipped), `CREATE_FLOW_ASSIGNMENT.md` (D7 gap closed), `HANDOFF.md`, `API_REFERENCE.md` (note `getJobsForTeamMember` now includes team jobs — no new endpoints), `DOC_REGISTRY.md`. Commit to `main`.

*(No migration step.)*

---

## 7. Test Plan (backend)

- **Visibility:** a member of an assigned team sees the Call in `getJobsForTeamMember`; a non-member does not.
- **Gates:** `getJobDetail` / geofence / complete accept a group member on a team Call; a non-member gets `404`.
- **Auto labor (single):** a group member's geofence arrival→departure creates their per-member labor line at **their** rate; `getJobCosts.laborLines` is non-empty; `totalCost`/margin reflect it.
- **Auto labor (multiple):** two group members → two labor lines; labor total = sum; each keyed to the right member/rate.
- **First-wins completion:** member A completes → Call `completed`, one `service_completions` row; member B's complete returns `409 ALREADY_COMPLETED` (no dupe); member B can still record geofence/labor after.
- **Dedup (TL4):** a member assigned both individually and via the team → one job-list entry (DISTINCT); one labor row (Rule-6, no 409-dupe on the auto path).
- **Null rate (TL2):** a group member with null `hourly_rate` → labor `amount = 0.00`, `hours_actual` recorded.
- **Regression:** individual-only assignment still lists/gates/labors exactly as before.

---

## 8. Deferred / Next-up

- **App-requirement tradeoff (accepted).** Option A means labor is only auto-captured for members who **have the app and a rate**. A member without the app records nothing; a null-rate member logs hours at $0.00 (surfaced by the existing Rule-2 warning). The owner can always add/correct a manual line. This is the accepted v1 posture.
- **Twilio-supplemented clock-in for app-less members** (next-up follow-on) — let a team member clock in/out via SMS (like the customer keyword system) so labor can be captured without the app. Separate session; builds on the existing per-business Twilio Messaging Service + keyword-handling in `routes/webhooks.js`.
- **Group flat-rate / allocation** (a team-level rate instead of per-member) — rejected for v1 (TL2); revisit only if per-member rates prove impractical.
- **Per-member completion** (each member closes their own portion) — rejected for v1 (TL3); would need a new completion model.
- **"Recompute labor at current rate"** for past open jobs — pre-existing job-costing follow-up, unchanged by this spec.
- **Owner notification on late/duplicate departures** — pre-existing open question in `JOB_COSTING.md`, unchanged.
