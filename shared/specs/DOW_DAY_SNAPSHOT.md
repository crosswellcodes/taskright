# Day-of-Week Day Snapshot Parity — Spec

**Status:** ✅ **BUILT (July 17, 2026)**. **Mobile-only. No backend change, no migration, no new endpoint.** Added a "Review {Weekday} — see what's scheduled ›" button to the day-of-week branch of `AssignCycleScreen`, reusing the existing `ServiceDaySnapshotScreen` (purely presentational) and the `forecast` data already fetched. Babel-checked; RN sim verification is the user's.

**Goal:** give a **day-of-week** business owner the same "what's already scheduled on this day" review that a **date-based** owner gets during service create. Today, date-based owners tap a first service date → land on `ServiceDaySnapshot` (day overview + active service cycles) → **Confirm This Date**. Day-of-week owners pick a weekday + a start date on an inline calendar (with volume dots) but have **no way to see the day's detail** before committing.

---

## 1. Current behavior (verified July 17, 2026)

- `AssignCycleScreen` (create mode). `isDayOfWeek = user.schedulingFormat === 'day_of_week'`.
- **Date-based branch:** "First Service Date" button → calendar modal; on day press → `forecastItem = forecast.find(f => f.serviceDate === tappedDate)` → `navigation.navigate('ServiceDaySnapshot', { date, forecastItem })` (AssignCycleScreen.js ~483).
- **Day-of-week branch:** weekday buttons (`setStartDate(nextOccurrence)`) + an inline `Calendar` ("Service Volume — tap a date to set your start") whose `onDayPress` only calls `setStartDate(day.dateString)` — no review step (AssignCycleScreen.js ~416).
- `ServiceDaySnapshotScreen` is **presentational**: it renders the `forecastItem` param (day overview: Service Calls / Total Hours / Submitted / Pending + Active Service Cycles) and, on **Confirm This Date**, navigates back with `{ confirmedDate: date }`, which `AssignCycleScreen` reads into `startDate`.
- `forecast` (from `getForecast`) = per-date items over today→30 days, each `{ serviceDate, totalHours, customerSelectionsStatus{submitted,pending}, serviceCycles[] }`. **Already in hand** in the day-of-week branch (it draws the volume dots).

## 2. Change (flavor 1 — single-date review)

Add a **"Review {Weekday} — what's scheduled ›"** affordance to the day-of-week branch, shown once `selectedDay !== null` and a `startDate` is set (i.e., alongside the "Starting: …" label). On tap:

```
const forecastItem = forecast.find(f => f.serviceDate?.split('T')[0] === startDate) || null;
navigation.navigate('ServiceDaySnapshot', { date: startDate, forecastItem });
```

This is the **same** navigation the date-based modal already uses. `ServiceDaySnapshot` is reused **unchanged** — its "Confirm This Date" returns `confirmedDate = startDate` (a no-op set that closes the loop consistently), and "Choose a Different Date" `goBack`s to the calendar.

**Why a button (not hijacking the calendar tap):** the inline day-of-week calendar's purpose is quick tap-to-set-start with volume dots; navigating away on every tap would defeat that. An explicit review affordance gives full parity of *information* without disrupting the quick-set interaction. (Date-based has no such quick-set calendar, so its tap→review is fine there.)

### Decisions
- **DOW1 — Reviews the chosen `startDate`** (the specific upcoming occurrence), not an aggregate of all that weekday's dates. That's flavor 1; the weekday aggregate ("typical Tuesday") is **flavor 2, deferred** (§4).
- **DOW2 — Reuse `ServiceDaySnapshotScreen` as-is.** No new screen, no prop changes. The snapshot already handles the empty state ("No services scheduled") when `forecastItem` is null or has no calls.
- **DOW3 — Affordance placement:** below the "Starting: {date}" label in the day-of-week block. Label reads "Review {DAY_NAMES[selectedDay]} — see what's scheduled ›".

## 3. Scope / preservation
- Date-based create flow: **unchanged.**
- Edit mode: unaffected (the schedule UI + `forecast` are create-only).
- Backend / `getForecast` / `ServiceDaySnapshot`: **unchanged.**

## 4. Deferred — flavor 2 (weekday aggregate)
"What does my {Weekday} generally look like" — filter `forecast` by `new Date(serviceDate).getUTCDay() === selectedDay`, sum hours/submitted/pending, union `serviceCycles` across the ~4 occurrences in the 30-day window, shown in a relabeled/aggregated snapshot. No backend change either. Revisit if owners ask for a recurring-load overview.

## 4a. Post-build fix — "Confirm This Date" pushed a fresh screen (July 17, 2026)

Testing the new flow surfaced a **pre-existing** bug (also affecting the date-based flow): `ServiceDaySnapshot`'s "Confirm This Date" called `navigation.navigate('AssignCycle', { confirmedDate })`. The app is on **React Navigation v7**, where `navigate` only reuses an existing screen when its params **also match** — the live `AssignCycle` was opened with `{customerId, customerName}`, so v7 **pushed a fresh (blank) AssignCycle** with only `{confirmedDate}` instead of returning to the origin. (This was written for v6's "navigate goes back by name" behavior and silently broke on the v7 upgrade.)

**Fix:** use v7's `popTo`, which matches by **name only**, with `merge: true` to preserve the origin's params:
```
navigation.popTo('AssignCycle', { confirmedDate: date }, { merge: true });
```
Pops back to the original AssignCycle (customer context intact) and adds `confirmedDate`. Fixes **both** the day-of-week and date-based confirm paths.

## 5. Verification
RN sim (business "Task Done Right LLC", biz 22, day_of_week): create a service → pick a weekday → tap **Review** → confirm the snapshot shows that date's calls/hours (or the empty state) → **Confirm This Date** returns to create with the date intact. Babel-check the changed screen.
