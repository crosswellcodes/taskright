# Session 9 — Code Review Findings
**Date:** 2026-07-03
**Scope:** Migrations 017-018 (job costing + geofence), geocoding, geofence endpoint, mobile geo-fence in JobDetailScreen
**Baseline:** 76/76 backend tests passing. All changes are uncommitted on `main`.

**Status: ALL 10 FIXED (2026-07-03).** 76/76 tests still passing. See per-item ✅ notes below.

---

## How to use this file

Start your session with:
> Read `shared/specs/SESSION9_REVIEW_FINDINGS.md` — these are verified code review findings from the job costing / geo-fence implementation. Fix them in priority order.

---

## Critical — Labor Cost Data Loss

### 1. Departure overwrites (not accumulates) labor hours ✅ FIXED
- **File:** `backend/src/services/businessService.js` — `recordGeofenceEvent()`, ~line 1399
- **Bug:** The upsert UPDATE path replaces `hours_actual` and `amount` outright. Combined with the arrival lookup always grabbing the most recent arrival (`orderBy('occurred_at', 'desc').first()`), a GPS-jitter re-entry resets the labor cost to only the latest interval.
- **Scenario:** Team member on-site 2 hours, walks 110m to truck (departure fires, hours=2.0 saved), walks back (new arrival), works 30 more min, departs. Upsert replaces hours_actual with 0.5, discarding the original 2.0.
- **Fix direction:** Accumulate hours across all arrival/departure pairs for the same member+job. Either sum all intervals at query time, or store per-interval rows and aggregate.
- **Fix applied:** On every departure, recompute total on-site hours from the full `geofence_events` history for that member+job (ordered ascending), pairing each arrival with the next departure and summing only on-site interval durations (**sum-of-intervals** rule — off-site gaps like lunch excluded). The single labor row (Rule 6) is set to this total. Idempotent: re-entry can't lose an earlier interval and a re-fired departure can't double-count. No schema change.

### 2. No departure posted on screen unmount ✅ FIXED
- **File:** `TaskRight/src/screens/teamMember/JobDetailScreen.js` — useEffect cleanup, ~line 96
- **Bug:** The cleanup calls `stopWatching()` which only clears the GPS watcher. If `insideRef.current` is true (team member is on-site), no departure event is posted. The arrival is orphaned — no matching departure means no labor cost line is ever created.
- **Fix direction:** In the cleanup function, check `insideRef.current` and `clockedInRef.current`. If true, post a departure event (fire-and-forget) before clearing the watch. Use the last known position or method='manual'.
- **Fix applied:** Cleanup now calls new `stopWatchingAndCloseOut()`. `watchPosition` records the last fix into `lastPosRef`. On unmount, if `insideRef.current || clockedInRef.current`, it fire-and-forgets a `departure` (method `'manual'`) using the last known position, or null coords if none, then clears the watcher.

---

## High — Stuck UI / Authorization Gap

### 3. Manual clock-in/out: unhandled promise rejection leaves button stuck ✅ FIXED
- **File:** `TaskRight/src/screens/teamMember/JobDetailScreen.js` — `handleManualClockIn` ~line 137, `handleManualClockOut` ~line 164
- **Bug:** `Geolocation.getCurrentPosition` is callback-based. The success/error callbacks are `async` and `await postGeofenceEvent(...)`. If that network call rejects, the rejection is unhandled (the outer try/catch can't catch errors inside a callback). `setClockLoading(false)` is never reached — the button becomes a permanent spinner.
- **Fix direction:** Wrap the `await` calls inside each callback in their own try/catch/finally, with `setClockLoading(false)` in the finally block. Or refactor both handlers into a single `handleManualClock(eventType)` function with proper error handling.
- **Fix applied:** Refactored the two handlers into `handleManualClock(eventType)` + a shared `submitManualClock(eventType, lat, lng)` that owns the single `try/catch/finally` — `setClockLoading(false)` always runs in `finally`, and both GPS success and failure callbacks route through it.

### 4. recordGeofenceEvent skips job assignment verification ✅ FIXED
- **File:** `backend/src/services/businessService.js` — `recordGeofenceEvent()`, ~line 1381
- **Bug:** The function inserts geofence events and creates labor cost rows without verifying the team member is assigned to the job via `service_assignments`. Both `getJobDetail()` and `completeJobForTeamMember()` check this. The route's `requireTeamMember` middleware only validates the JWT matches the URL's teamMemberId.
- **Fix direction:** Add the same `service_assignments` check at the top of `recordGeofenceEvent()`, matching the pattern in `getJobDetail()`.
- **Fix applied:** Added the `service_assignments` lookup (team_member_id + selection_cycle_id) at the top of `recordGeofenceEvent()`; throws `NOT_FOUND` (404) if absent, matching `getJobDetail()`/`completeJobForTeamMember()`.

### 5. parseFloat(lat/lng) produces NaN for non-numeric strings — unhandled 500 ✅ FIXED
- **File:** `backend/src/routes/teamMembers.js` — geofence POST route, ~line 134
- **Bug:** The validation `lat == null || lng == null` passes for non-null non-numeric strings. `parseFloat('abc')` returns NaN. PostgreSQL rejects NaN for `decimal(10,7)` columns, causing a 500 instead of a clean 400.
- **Fix direction:** After parseFloat, check `isNaN()` and return 400 if true. Or validate with `typeof lat === 'number'` before parseFloat.
- **Fix applied:** When coords are present they're `parseFloat`'d and rejected with a 400 if `Number.isNaN`. Coordinate handling was also reworked alongside #9: manual events may omit coords (stored null), auto events still require valid numeric coords (400 otherwise).

---

## Medium — Data / UX Issues

### 6. customerNote (per-cycle SMS note) dropped from route response ✅ FIXED
- **File:** `backend/src/routes/teamMembers.js` — GET job detail response mapping, ~line 56
- **Bug:** `getJobDetail()` selects `sc.customer_note as customerNote` but the route response object only includes `customerNotes` (the persistent `c.notes`). The per-visit note from the SMS 'N' keyword flow is queried then silently dropped.
- **Fix direction:** Add `customerNote: job.customerNote || null` to the response object. This is a pre-existing bug — the original route had the same omission.
- **Fix applied:** Added `customerNote: job.customerNote || null` to the route response. Also added a "NOTE FOR THIS VISIT" card in `JobDetailScreen.js` — the mobile UI previously only rendered persistent `customerNotes`, so the per-visit note would still have gone unseen despite HANDOFF claiming it was visible.

### 7. Misleading "Location access denied" message when coordinates are missing ✅ FIXED
- **File:** `TaskRight/src/screens/teamMember/JobDetailScreen.js` — useEffect ~line 82, render ~line 308-315
- **Bug:** When `customerLat`/`customerLng` are null (no geocoded address), the code sets `locationPermission = false` without ever requesting permission. The render then shows both "No address on file" AND "Location access denied" simultaneously.
- **Fix direction:** Don't set `locationPermission` when coordinates are missing — leave it as null. Use a separate `noCoordinates` flag. Render only the appropriate message based on which condition is true.
- **Fix applied:** The no-coords branch of the useEffect now returns early *without* touching `locationPermission` (stays null). The clock card renders exactly one subtext via an if/else-if: "No address on file" when `!hasCoords`, else "Location access denied" only when `locationPermission === false`.

### 8. geocodeAddress() does not check HTTP status code ✅ FIXED
- **File:** `backend/src/services/businessService.js` — `geocodeAddress()`, ~line 12
- **Bug:** No `res.statusCode` check before parsing. A 401 (expired token) or 429 (rate limit) returns HTML or error JSON that either fails JSON.parse (logged as "Geocode parse failed" with no HTTP context) or parses but has no `features` array (silently returns). No indication of the actual problem.
- **Fix direction:** Check `res.statusCode !== 200` before parsing. Log the status code and response snippet on failure.
- **Fix applied:** `res.on('end')` now returns early if `res.statusCode !== 200`, logging the status code, customer id, and a 200-char body snippet.

### 9. Manual clock-in/out sends lat=0, lng=0 as fallback coordinates ✅ FIXED
- **File:** `TaskRight/src/screens/teamMember/JobDetailScreen.js` — ~line 151, ~line 177
- **Bug:** When `getCurrentPosition` fails (location services off), the error callback posts `lat: 0, lng: 0` — real coordinates in the Gulf of Guinea, indistinguishable from genuine GPS data in the database.
- **Fix direction:** Send `lat: null, lng: null` and update the backend to accept nullable lat/lng for manual events. Or use a sentinel like `method: 'manual'` to flag the row (already done, but the fake coordinates are still misleading for analytics).
- **Fix applied:** GPS-failure callback now sends `null, null` instead of `0, 0`. Backend updated to accept nullable coords for manual events: **migration 018 changed `geofence_events.lat/lng` to nullable** (re-run on both `task_app_db` and `task_app_test` — migration was uncommitted, so edited in place rather than adding 019), and the route accepts null coords for `method: 'manual'` while still requiring valid numeric coords for `'auto'`.

### 10. Dead code: geocodeAddress() in addCustomer() never fires ✅ FIXED
- **File:** `backend/src/services/businessService.js` — `addCustomer()`, ~line 265
- **Bug:** `addCustomer(businessId, name, phoneNumber)` never sets address in the INSERT, so `customer.address` from RETURNING * is always null. The `if (customer.address)` geocode call is unreachable.
- **Fix direction:** Remove the dead geocode call from `addCustomer()`. Geocoding correctly fires from `updateCustomerDetails()` when address is set.
- **Fix applied:** Removed the unreachable `if (customer.address) geocodeAddress(...)` block from `addCustomer()`, replaced with a comment noting geocoding fires from `updateCustomerDetails()`.
