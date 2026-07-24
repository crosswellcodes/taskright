# Geofence / Clock-In Transparency — Spec

**Status:** 📝 **SPEC (July 20, 2026)** — not yet built. Mobile-heavy; one small backend addition for the list tier, one read-only endpoint for the persistent-banner tier. **No migration.** Descends from a team-member report: after granting location on one job, the tracking status can't be re-activated on the *next* job, there's no visible indication of what the geofence tool is doing, and the status disappears entirely when leaving a Call.

**Goal:** make automatic clock-in **legible and recoverable** — the team member should always be able to see (a) which mode a job is in (auto vs manual), (b) whether they're currently on the clock, and (c) how to turn tracking on if it isn't — from both the Call detail and the My Jobs list, and never hit a dead state.

---

## 1. Root cause — the reactivation dead state (verified July 20, 2026)

`JobDetailScreen` tracks `locationPermission` ∈ `null | true | false`, but **only two of the three states render**:
- Geofence status card requires `locationPermission === true` ([JobDetailScreen.js:309](../../TaskRight/src/screens/teamMember/JobDetailScreen.js#L309)).
- Manual clock card (`showManualClock`) requires `!hasCoords || locationPermission === false` ([:249](../../TaskRight/src/screens/teamMember/JobDetailScreen.js#L249)).
- ⇒ When **`hasCoords === true && locationPermission === null`, neither card renders** — no status, no button, no watcher. A dead screen.

`locationPermission` only leaves `null` inside the callbacks of `Geolocation.requestAuthorization(success, error)` ([:88](../../TaskRight/src/screens/teamMember/JobDetailScreen.js#L88)). On the **first** job the OS prompt resolves → `success` fires → card appears. On iOS, `@react-native-community/geolocation`'s `requestAuthorization` **does not reliably invoke either callback when authorization is already determined** (already granted from job #1). So on the **second** job `locationPermission` stays `null` → the dead state → tracking never re-arms. This is the reported "can't activate it again on other service calls." (Even absent the module quirk, there's a render gap on every load while the prompt is in flight.)

**Secondary gaps:**
- **Terse status** — only "Outside job site radius" / "At job site — time tracking active". No plain-language explanation that it auto-clocks-in on arrival, or that it's actively watching.
- **Vanishes on leave** — status lives only on the detail screen; navigating away unmounts it and *silently* posts a synthetic departure (`stopWatchingAndCloseOut`, [:142](../../TaskRight/src/screens/teamMember/JobDetailScreen.js#L142)) with no confirmation.
- **No list signal** — `getJobsForTeamMember` doesn't even return coordinates ([businessService.js:1501](../../backend/src/services/businessService.js#L1501)), so My Jobs can't show auto-vs-manual or which job is active.

---

## 2. Tiers

| Tier | What | Files | Backend | Migration |
|------|------|-------|---------|-----------|
| **A** | Fix dead state + one always-present status card | `JobDetailScreen.js` | — | — |
| **B** | My Jobs auto/manual chip + on-the-clock badge | `MyJobsScreen.js`, `getJobsForTeamMember` | +2 fields | — |
| **C** | Cross-screen "you're clocked in" banner | new endpoint, shared state, `MyJobsScreen` | +1 read endpoint | — |

Build in order; each stands alone. A is the correctness fix and must ship first.

---

## 3. Tier A — fix the dead state + unified status card (mobile-only)

### A1 — never render nothing (the bug fix)
- **Re-arm per job:** key the geofence effect on `selectionCycleId` (and reset `locationPermission` to `null` on job change) so every job re-evaluates from scratch — don't rely on a stale instance.
- **Resolve permission reliably, not via `requestAuthorization` callbacks alone.** After requesting, probe with `Geolocation.getCurrentPosition` — its success/error path *does* fire on an already-authorized device, so use it to drive `locationPermission` to a concrete `true`/`false` and to seed the first distance check. `requestAuthorization` still triggers the initial OS prompt; `getCurrentPosition` is the reliable state resolver.
- **Treat `null` as a real, rendered state** ("Checking location…") so there is never a blank screen, and always offer an explicit **Enable location / Retry** button that re-runs the request. A dead state becomes impossible.

### A2 — one always-present "Time Tracking" card
Replace the two conditional cards ([:308–345](../../TaskRight/src/screens/teamMember/JobDetailScreen.js#L308)) with a single card that **always** renders, driven by a derived `trackingMode`:

| Mode | Condition | Copy | Controls |
|------|-----------|------|----------|
| `checking` | coords present, `locationPermission === null` | "Checking location…" | spinner |
| `auto_inside` | coords, perm true, inside 100 m | "At the job site — you're clocked in automatically" + elapsed timer | (auto) |
| `auto_outside` | coords, perm true, outside | "Outside the job site — you'll clock in automatically when you arrive" | (auto) |
| `manual_denied` | coords, perm false | "Location is off — using manual tracking" | **Enable location** + Clock In/Out |
| `manual_unmapped` | no coords, address present | "Address not mapped yet — using manual tracking" | Clock In/Out |
| `manual_noaddress` | no coords, no address | "No address on file — using manual tracking" | Clock In/Out |

- **Elapsed timer:** when clocked in, show "On the clock · 0:42" (derive from the arrival moment held in a ref). Answers "am I being tracked right now?" at a glance — the core transparency ask.
- Keep the existing `clockedIn`/`insideRef` machinery; this is a presentation refactor plus the A1 state fix. The "teammate completed first → keep Clock Out" case (TL3, [:248](../../TaskRight/src/screens/teamMember/JobDetailScreen.js#L248)) folds in as a `manual_*` variant with the completed subtext.

### A3 — confirm the silent auto-departure on leave
When `stopWatchingAndCloseOut` posts a departure because the member navigates away while clocked in, surface a lightweight toast/alert ("Clocked out of {customer} — you left the job screen") so the vanish isn't silent. (Full cross-screen persistence is Tier C.)

**Decisions:** GT-A1 unified card over conditional cards (no state can render empty); GT-A2 `getCurrentPosition` as the permission-state resolver (module callbacks unreliable when pre-authorized); GT-A3 always provide a manual re-enable path.

---

## 4. Tier B — My Jobs list signal (small backend)

**Backend** — `getJobsForTeamMember` ([businessService.js:1476](../../backend/src/services/businessService.js#L1476)) add to the select:
- `c.lat as customerLat`, `c.lng as customerLng` (or a derived `knex.raw('(c.lat IS NOT NULL) as "autoTrackable"')`).

**Mobile** — `MyJobsScreen.renderJob` ([MyJobsScreen.js:49](../../TaskRight/src/screens/teamMember/MyJobsScreen.js#L49)): add a small chip near the status badge —
- `autoTrackable` → "◎ Auto clock-in"; else → "Manual".
- Pass `customerLat/customerLng` through the `navigate('JobDetail', …)` params so the detail screen can render its first frame without waiting on `getJobDetail` (removes a flash of the wrong mode on open).

**Decision:** GT-B1 expose `autoTrackable` (a boolean the client can't misuse) rather than leaking raw coords, unless the detail-screen first-frame optimization needs the actual lat/lng — then pass both.

---

## 5. Tier C — cross-screen "on the clock" banner (read-only backend + shared state)

The durable fix for "the status disappears when I leave." Derive current clock state from the source of truth (`geofence_events`) rather than screen-local flags, so it survives navigation and app restarts.

**Backend** — new read-only endpoint, e.g. `GET /api/team-members/:id/active-clock`:
- Returns the member's currently-open clock-in, if any: the `selection_cycle_id` + customer name + arrival time, computed as "the latest `geofence_events` row for (member, cycle) is an `arrival` with no later `departure`." Null if none.
- No writes, no migration — reads existing `geofence_events`.

**Mobile** — a small shared piece of state (context or a focused hook) that fetches this on app focus and after any clock event, and renders a **persistent banner** ("● You're clocked into {customer} · 1:12 — tap to open") above My Jobs (and optionally app-wide). Tapping deep-links to that JobDetail.

**Decisions:** GT-C1 derive from `geofence_events` (durable, multi-device-consistent) not local state; GT-C2 read-only endpoint, no new table; GT-C3 banner lives at the My Jobs / navigator level so it outlives any one screen.

---

## 6. Scope / preservation
- Backend geofence write path, labor costing, `recordGeofenceEvent`, and the auto arrival/departure logic: **unchanged.** Tiers B/C only **read**.
- Tier A is a presentation + effect-lifecycle refactor of `JobDetailScreen`; the Haversine watcher, event posting, and unmount close-out are preserved.
- Back-compat: B adds fields to an existing payload; C is a new endpoint.

## 7. Tests
- Backend: `getJobsForTeamMember` returns `autoTrackable` correctly (coords present/absent) — extend the team-member job tests. Tier C: `active-clock` returns the open cycle when the last event is an arrival, null after a departure, and ignores other members' events.
- Mobile: babel-check; RN sim verification is the user's. Manual matrix to hand off: (1) open job A (auto) → grant → leave → open job B (auto) → **card must render + tracking re-arms** (the bug); (2) deny location → manual card + Enable button; (3) unmapped/no-address copy; (4) clocked-in elapsed timer; (5) leave while clocked in → confirmation toast.

## 8. Doc sync (per DOC_REGISTRY)
- `shared/API_REFERENCE.md`: `getJobsForTeamMember` payload gains `autoTrackable` (B); new `GET /team-members/:id/active-clock` (C).
- `HANDOFF.md`: milestone + note the reactivation bug fix; DB unchanged.
- `shared/DOC_REGISTRY.md`: register this spec. `shared/FEATURE_MAPPING.md`: reflect under "Team Time Tracking".

## 9. Deferred
- Background/geofence tracking when the app is closed (currently foreground `watchPosition` only) — OS background-location is a much larger lift (entitlements, battery, review). Out of scope.
- Owner-side visibility of who's currently clocked in (a dashboard live view) — separate feature; Tier C's endpoint is the data seed for it.
