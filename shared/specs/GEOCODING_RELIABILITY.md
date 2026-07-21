# Geocoding Reliability — Spec

**Status:** ✅ **BUILT (July 20, 2026)** — migration 025 + backend (`geocodeCustomer`, relevance gate, reset-on-change, `findCustomersNeedingGeocode`, `deriveGeocodeStatus`) + `jobs/geocode-retry.js` (wired into `server.js`) + mobile owner-UI note (`CustomerDetailScreen`). 165/165 backend tests (+14, `geocoding.test.js`). Backend + one migration + mobile owner-UI note. Descends from the JobDetailScreen "No address on file" investigation (July 20): the clock-in card gates on `customers.lat/lng`, but those are populated only by a **fire-and-forget** geocode that runs on **one** write path with **zero failure visibility** — so any transient failure = permanently blank coordinates = auto-geofence silently degraded to manual, forever.

**Already shipped in that investigation (do not re-do):**
- **Copy fix** — `JobDetailScreen.js` now says *"Address not mapped yet — using manual tracking"* when an address exists but coords don't (vs *"No address on file"* when there's no address). `hasAddress` derived at [JobDetailScreen.js:244](../../TaskRight/src/screens/teamMember/JobDetailScreen.js#L244).
- **Backfill** — the 8 legacy customers with addresses-but-no-coords were geocoded (table is now 9/9 addressed-and-geocoded). Two of them (ids 13, 15 — test rows "Edgeworth" / "Main Street West") resolved to a **low-confidence** fuzzy match ("South Wales, New York"), which motivates the relevance gate below.

**Goal:** make address→coordinates resolution **reliable** (survives a transient failure), **bounded** (never retries indefinitely), and **legible** (owner can see and fix an address that won't map). No geocode-on-read — see §6 for why it was rejected.

---

## 1. Current behavior (verified July 20, 2026)

- **One writer.** `geocodeAddress(customerId, address)` ([businessService.js:8](../../backend/src/services/businessService.js#L8)) — `https.get` to Mapbox `mapbox.places`, takes `features[0].center` → `UPDATE customers SET lat,lng,geocoded_at`. Fire-and-forget: no `await`, no attempt record, errors only `console.error`.
- **One caller.** `updateCustomerDetails()` fires it **only when `data.address` changes** ([businessService.js:360](../../backend/src/services/businessService.js#L360)). `addCustomer()` never takes an address, so it never geocodes (correct today — address is always added later via update).
- **Columns** (`customers`, from migration 017): `lat decimal(10,7)`, `lng decimal(10,7)`, `geocoded_at timestamptz`. All nullable. No attempt/relevance tracking.
- **Consumers of lat/lng:** team-member auto-geofence (`getJobDetail` → `customerLat/Lng` → `JobDetailScreen` `hasCoords`). Nothing else.
- **Failure modes observed:** (a) address set before geocoding existed / while token or network was down → blank forever (the 8 backfilled rows); (b) Mapbox returns a **wrong** low-confidence match rather than "no match" (ids 13/15). Mapbox almost always returns *something*, so "no result" is rare — **wrong result is the real risk.**

---

## 2. Change overview (three layers)

| # | Layer | Files | Migration |
|---|-------|-------|-----------|
| 1 | Reliable, observable on-write | `businessService.js` | — |
| 2 | Bounded background retry | new `jobs/geocode-retry.js`, `server.js` | — |
| 3 | Owner-visible "needs attention" | `businessService.js` (`getCustomerDetails`), `CustomerDetailScreen.js` | — |
| — | Attempt + relevance tracking | migration 025 | **025** |

**Shared constants** (define once in `businessService.js`, export for the job + tests):
```
GEOCODE_MAX_ATTEMPTS = 3       // hard cap — after this, stop retrying, flag for a human
GEOCODE_MIN_RELEVANCE = 0.8    // Mapbox feature.relevance below this = not trustworthy
GEOCODE_RETRY_BACKOFF = '6 hours'  // min gap between attempts (the sweep also throttles)
```

---

## 3. Migration 025 — `025_geocode_tracking.js`

Add to `customers`:
```js
table.integer('geocode_attempts').notNullable().defaultTo(0);
table.timestamp('geocode_attempted_at', { useTz: true }).nullable();
table.decimal('geocode_relevance', 3, 2).nullable(); // best candidate's Mapbox relevance, 0.00–1.00
```
`down`: drop the three columns.

**Data note for the up migration (optional but recommended):** the two known low-confidence rows (ids 13, 15) currently hold bad coords from the July 20 backfill. Either leave them (test data) or, in `up`, `NULL` out `lat/lng` for rows whose address clearly didn't match so the new gate re-evaluates them. Keep it a one-liner comment; don't over-engineer for two test rows.

---

## 4. Layer 1 — reliable, observable on-write

Rewrite `geocodeAddress` into an **awaitable** routine that records every attempt and honors the relevance gate. It still returns a promise the write path deliberately does **not** await (stays fire-and-forget for UX latency), but the job (§5) and tests **can** await it.

```
async function geocodeCustomer(customerId, address):
  if (!address || !MAPBOX token) return { skipped: true }
  // record the attempt up front so a crash mid-call still counts
  await customers.where(id).update({
    geocode_attempts: knex.raw('geocode_attempts + 1'),
    geocode_attempted_at: knex.raw('CURRENT_TIMESTAMP'),
  })
  fetch Mapbox
  const feature = features[0]
  if HTTP != 200 or !feature:            return { ok:false, reason:'no_match' }   // coords stay null
  const relevance = feature.relevance ?? 0
  if relevance < GEOCODE_MIN_RELEVANCE:
    await customers.update({ geocode_relevance: relevance })   // record what we saw, DON'T store coords
    return { ok:false, reason:'low_confidence', relevance }
  await customers.update({ lat, lng, geocoded_at: NOW, geocode_relevance: relevance })
  return { ok:true, relevance }
```

**Key decisions:**
- **G1 — Never store low-confidence coordinates.** A geofence pinned to the wrong city is worse than honest manual tracking. Below `GEOCODE_MIN_RELEVANCE`, leave `lat/lng` null (member stays on manual, which is safe) and record the relevance so the owner UI can say *why*.
- **G2 — Increment attempts before the network call**, not after, so a timeout/crash still counts toward the cap (prevents infinite retry on a hanging address).
- **G3 — Fire-and-forget stays fire-and-forget** on the write path. `updateCustomerDetails` calls `geocodeCustomer(...)` without `await` (unchanged UX). The promise return exists for the job + tests.

**`updateCustomerDetails` changes** ([businessService.js:351](../../backend/src/services/businessService.js#L351)):
- When `data.address` **changes to a new non-empty value**: reset the tracking so a corrected address re-arms fully —
  `updates.lat = null; updates.lng = null; updates.geocoded_at = null; updates.geocode_relevance = null; updates.geocode_attempts = 0;` then fire `geocodeCustomer(customerId, data.address)` (unawaited).
- When `data.address` is **cleared** (`=== ''`/null): also null the five fields; don't fire geocode.
- (No-op if address key absent — unchanged.)

> This reset-on-change is what makes the system self-heal: fixing a bad address in the owner UI clears the `failed` state and gives it a fresh 3 attempts.

**`addCustomer`:** unchanged (no address at create). Add a one-line comment noting that if address is ever added to the create payload, it must call `geocodeCustomer` + reset, same as update.

---

## 5. Layer 2 — bounded background retry (`jobs/geocode-retry.js`)

New job in the existing `node-schedule` pattern (mirror `selection-reminders.js`). Heals the residue that Layer 1's fire-and-forget missed (transient Mapbox failure at write time), **without** ever exceeding the cap.

```
function startGeocodeRetryJob():
  scheduleJob('0 * * * *', async ():   // hourly — cheap, well under Mapbox limits
    const due = await customers
      .whereNotNull('address')
      .whereNull('lat')
      .where('geocode_attempts', '<', GEOCODE_MAX_ATTEMPTS)
      .andWhere(b => b.whereNull('geocode_attempted_at')
                      .orWhereRaw(`geocode_attempted_at < NOW() - INTERVAL '${GEOCODE_RETRY_BACKOFF}'`))
      .limit(25)                        // batch cap per run — avoid burst
      .select('id','address')
    for (const c of due) await geocodeCustomer(c.id, c.address)   // serial, reuses Layer 1 (records attempts + gate)
    log summary { due, ok, failed }
```

**Why this is bounded by construction:** each pass only touches rows under the attempt cap and past the backoff window; `geocodeCustomer` increments attempts every pass. A genuinely bad address gets exactly `GEOCODE_MAX_ATTEMPTS` tries (≈3 over ≥18h) then falls out of the query permanently — until its address is edited (which resets attempts → back in the pool). **No indefinite retry.**

**Wire-up** (`server.js`): `const { startGeocodeRetryJob } = require('./src/jobs/geocode-retry');` + `startGeocodeRetryJob();` alongside the other two.

**Decisions:**
- **G4 — Hourly cron, not on-read.** The sweep cadence *is* the throttle. See §6.
- **G5 — `limit(25)` per run.** More than enough for this scale; caps burst if a bulk import ever lands.

---

## 6. Rejected: geocode-on-read

Considered triggering a geocode when a job/customer with an address-but-no-coords is loaded. **Rejected:**
- Couples a team member opening a job to Mapbox latency/failure (UI stall or error on someone else's data problem).
- **No natural throttle** — a permanently-bad address would re-fire on every open, the exact "retry indefinitely" outcome to avoid. Bounding it would require the same attempt-tracking as §5 *plus* request-path complexity, for strictly worse ergonomics than a background sweep.

The background job (§5) delivers the same self-healing with a built-in throttle and cap, off the request path.

---

## 7. Layer 3 — owner-visible "needs attention"

**Backend** — `getCustomerDetails` ([businessService.js:273](../../backend/src/services/businessService.js#L273)) selects `customers.*`, so the new columns are already present. Add a derived field:
```
function deriveGeocodeStatus(c):
  if (!c.address)                                   return 'none'
  if (c.lat != null)                                return 'ok'
  if (c.geocode_attempts >= GEOCODE_MAX_ATTEMPTS)   return 'failed'   // give up → human fix
  return 'pending'                                                    // still within retry budget
customer.geocodeStatus = deriveGeocodeStatus(customer)
customer.geocodeRelevance = customer.geocode_relevance == null ? null : Number(customer.geocode_relevance)
```
(`geocode_relevance` is `numeric` → coerce with `Number()` at the boundary, per the pg-strings rule.)

**Mobile** — `CustomerDetailScreen` address block ([CustomerDetailScreen.js:156](../../TaskRight/src/screens/business/CustomerDetailScreen.js#L156)). Below the address / Get Directions row, when `customer.geocodeStatus === 'failed'`, show a muted warning:
> ⚠ We couldn't map this address for automatic clock-in. Check the address in Details.

- Only surface `'failed'` (terminal) — `'pending'` is transient noise; `'ok'`/`'none'` show nothing.
- If `geocodeRelevance != null` on a `failed` row, optionally append *"(closest match wasn't confident)"* to distinguish a bad-match from a no-match. Nice-to-have, not required for v1.
- Fixing the address uses the **existing** edit path (Details → CustomerPreferences), which now resets attempts (Layer 1) → auto-retries.

**Decisions:**
- **G6 — Detail screen only for v1.** No list-level badge in `getCustomersByBusiness` (keep scope tight; add later if owners want an at-a-glance list indicator).
- **G7 — Team-member side already handled** by the July 20 copy fix ("Address not mapped yet") — no further member-facing change.

---

## 8. Scope / preservation
- Auto-geofence, job costing, forecast, selections: **unchanged** — this only changes *when/whether* `lat/lng` get populated and adds three tracking columns.
- Existing `geocodeAddress` call sites: only `updateCustomerDetails`. Renamed/rewritten to `geocodeCustomer`; update the reference.
- Back-compat: new columns nullable/defaulted; `geocodeStatus` is additive on the response.

## 9. Tests (`backend/src/__tests__/geocoding.test.js`, new)
Mock the Mapbox `https.get` (as existing tests do for outbound). Cover:
- on-write success (relevance ≥ 0.8) → lat/lng/relevance set, attempts incremented.
- low-confidence (< 0.8) → lat/lng stay null, relevance recorded, `reason:'low_confidence'`.
- no-match → coords null, attempt recorded.
- attempt cap → `geocodeCustomer` past `MAX_ATTEMPTS` still increments but job query excludes it.
- address change resets attempts + clears coords; address clear nulls all five.
- `deriveGeocodeStatus` truth table (none/ok/pending/failed).
- retry-job query selects only due rows (null lat, under cap, past backoff).

## 10. Doc sync (per DOC_REGISTRY)
- `HANDOFF.md`: add `customers.geocode_attempts/attempted_at/relevance` to DB schema; add S-milestone entry; note migration 025.
- `shared/API_REFERENCE.md`: `getCustomerDetails` response gains `geocodeStatus`, `geocodeRelevance`.
- `shared/DOC_REGISTRY.md`: register this spec.
- `shared/FEATURE_MAPPING.md`: mark geocoding-reliability built when shipped.

## 11. Deferred
- List-level geocode indicator in `getCustomersByBusiness` (G6).
- Business/team-member address geocoding (only customer addresses drive geofencing today).
- Surfacing the low-confidence *candidate address* to the owner as a one-tap "did you mean?" accept.
```
