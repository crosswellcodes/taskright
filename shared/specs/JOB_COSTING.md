# Job Costing — Feature Spec
**Status:** Design complete. Pending implementation.
**Dependencies:** Mapbox API (existing key), `@react-native-community/geolocation` (new package)
**Cross-reference:** Geo-fencing infrastructure defined here is also consumed by `REVIEW_REQUESTS.md`

---

## Overview

Job costing gives business owners visibility into profitability at the individual job and customer level.

**Core equation:**
```
Total Cost   = Labor + Materials + Overhead
Margin ($)   = Price − Total Cost
Margin (%)   = Margin ($) / Price × 100
```

Labor is itemized per team member (hours × rate). Materials and overhead are single dollar amounts per job in v1. Price is tracked per customer per recurring cycle, with per-job override for ad hoc work.

---

## Cost Categories & Chart of Accounts Codes

System-defined categories follow GAAP-aligned numbering in the 4000–5000 range. This makes future QuickBooks integration straightforward — codes map directly to standard chart of accounts ranges.

| Code | Name | Type | Notes |
|------|------|------|-------|
| 4000 | Service Revenue | revenue | Price charged per job |
| 5000 | Direct Labor | labor | Sum of all team member labor |
| 5100 | Materials / Supplies | materials | Single dollar amount per job (v1) |
| 5200 | Job Overhead | overhead | Single dollar amount per job (v1) |

Custom categories (v2) are allocated in the 5300–5999 range, scoped per business. System defaults have no `business_id` (shared across all businesses).

---

## Data Model

### New Tables

#### `cost_categories`

| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| business_id | int | FK → businesses, NULL for system defaults |
| code | int | Unique per business scope (nulls = system scope) |
| name | varchar(100) | |
| type | varchar(20) | `'labor'` \| `'materials'` \| `'overhead'` \| `'revenue'` |
| is_system | boolean | true for built-in categories |
| created_at | timestamptz | |

**Seed data** (inserted in migration):
```
(NULL, 4000, 'Service Revenue',      'revenue',   true)
(NULL, 5000, 'Direct Labor',         'labor',     true)
(NULL, 5100, 'Materials / Supplies', 'materials', true)
(NULL, 5200, 'Job Overhead',         'overhead',  true)
```

---

#### `job_costs`
One row per cost line item per job. Labor lines reference a team member; materials and overhead lines do not.

| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| selection_cycle_id | int | FK → selection_cycles |
| cost_category_id | int | FK → cost_categories |
| amount | decimal(10,2) | Dollar amount |
| team_member_id | int | FK → team_members, NULL for non-labor lines |
| hours_actual | decimal(5,2) | NULL for non-labor lines |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Constraint:** If `cost_categories.type = 'labor'`, then `team_member_id` and `hours_actual` must be non-null.

---

#### `geofence_events`
One row per arrival or departure event, per team member, per job. Departure events trigger automatic labor cost creation and (if applicable) a review request SMS.

| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| selection_cycle_id | int | FK → selection_cycles |
| team_member_id | int | FK → team_members |
| event_type | varchar(20) | `'arrival'` \| `'departure'` |
| occurred_at | timestamptz | Device-reported time (not server receipt time) |
| lat | decimal(10,7) | |
| lng | decimal(10,7) | |
| method | varchar(20) | `'auto'` (geo-fence) \| `'manual'` (team member clock-in/out) |
| created_at | timestamptz | |

---

### Modified Tables

#### `team_members` — new column
| Column | Type | Notes |
|--------|------|-------|
| hourly_rate | decimal(8,2) | Nullable. Labor cost = hours_actual × hourly_rate. If null, hours are recorded but amount = $0.00. |

#### `customers` — new columns
| Column | Type | Notes |
|--------|------|-------|
| lat | decimal(10,7) | Geocoded from address via Mapbox. Nullable. |
| lng | decimal(10,7) | |
| geocoded_at | timestamptz | When lat/lng was last resolved. Null = not yet geocoded. |

#### `customer_cycle_assignments` — new column
| Column | Type | Notes |
|--------|------|-------|
| price_per_visit | decimal(8,2) | Nullable. Default recurring price for this customer in this cycle. |

#### `selection_cycles` — new column
| Column | Type | Notes |
|--------|------|-------|
| price | decimal(8,2) | Nullable. Job-specific price. Auto-populated from `customer_cycle_assignments.price_per_visit` when the cycle is created. Can be overridden per job. For ad hoc jobs with no assignment, set directly. |

---

## Geo-fencing Infrastructure

### Address Geocoding (Mapbox)

When a customer is created or their address is updated, resolve lat/lng via Mapbox Geocoding.

- **Endpoint:** `GET https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token={MAPBOX_ACCESS_TOKEN}&country=US&limit=1`
- **Trigger:** `businessService.createCustomer()` and `businessService.updateCustomer()` — fire-and-forget after the DB write, same pattern as Twilio provisioning.
- **Failure handling:** Non-blocking. If geocoding fails, `lat`/`lng` remain null and geo-fencing degrades to manual clock-in. A flag should appear on the customer record in the mobile UI.
- **Env var:** `MAPBOX_ACCESS_TOKEN` — confirm this is already set for the address autocomplete feature.

### Mobile — Foreground Geo-fence (React Native, v1)

Package: `@react-native-community/geolocation` (foreground only).

**Behavior in JobDetailScreen:**
1. On screen mount for an active (non-completed) job: begin foreground location polling if the job has a `lat`/`lng`.
2. **Arrival:** When device enters a 100m radius of the job's coordinates → POST arrival event to backend.
3. **Departure:** When device exits the 100m radius after a recorded arrival → POST departure event.
4. **Manual fallback:** If `lat`/`lng` is null on the job (geocoding failed or address not provided), show "Clock In" / "Clock Out" buttons. Manual events POST with `method: 'manual'`.
5. On screen unmount: stop location polling.

**Permission:** Request `ACCESS_FINE_LOCATION` on JobDetailScreen mount (foreground only). If denied, show manual clock-in buttons.

### Actual Labor Hours — Server-Side Calculation

On departure event receipt:
1. Find the matching arrival event: same `team_member_id` + `selection_cycle_id`, most recent `event_type = 'arrival'`.
2. If found: `hours_actual = (departure.occurred_at − arrival.occurred_at)` in decimal hours.
3. Fetch `team_members.hourly_rate` for this member.
4. Auto-create a `job_costs` row:
   - `cost_category_id` = id of code 5000 (Direct Labor) for this business
   - `amount = hours_actual × hourly_rate` (0.00 if rate is null)
   - `hours_actual` = calculated value
   - `team_member_id` = this member
5. If no matching arrival found: create the event record but do not create a labor cost line. Business owner can add it manually.

---

## API Surface

### Geo-fence Events
```
POST /api/team-members/:id/jobs/:selectionCycleId/geofence
Body:     { eventType: 'arrival'|'departure', occurredAt: ISO8601, lat: number, lng: number, method: 'auto'|'manual' }
Response: { success: true, data: { event, laborCostCreated: boolean } }
Auth:     requireTeamMember
Side effects on departure: creates job_costs labor line, triggers review request SMS (see REVIEW_REQUESTS.md)
```

### Job Costs (Business Owner)
```
GET    /api/businesses/:id/jobs/:selectionCycleId/costs
       Response: { price, laborLines: [{ teamMemberId, memberName, hoursActual, hourlyRate, amount }],
                   materialsAmount, overheadAmount, totalCost, marginDollars, marginPercent }

POST   /api/businesses/:id/jobs/:selectionCycleId/costs
       Body:     { costCategoryId, amount, teamMemberId?, hoursActual? }
       Response: { success: true, data: costLine }
       Use:      Manual entry / correction

PATCH  /api/businesses/:id/jobs/:selectionCycleId/costs/:costId
       Body:     { amount }
       Response: { success: true, data: costLine }

DELETE /api/businesses/:id/jobs/:selectionCycleId/costs/:costId
       Response: { success: true }

PATCH  /api/businesses/:id/jobs/:selectionCycleId/price
       Body:     { price }
       Response: { success: true }
       Use:      Override job price or set ad hoc price
```

### Team Member Rate (extend existing PATCH)
```
PATCH /api/businesses/:id/team-members/:memberId
      Body: { hourlyRate }   ← add to existing endpoint
```

### Customer Cycle Assignment Price (extend existing or new)
```
PATCH /api/businesses/:id/customers/:customerId/assignments/:assignmentId
      Body: { pricePerVisit }
```

### Customer Profitability (Aggregate)
```
GET /api/businesses/:id/customers/:customerId/profitability
    Response: { totalRevenue, totalCost, totalMarginDollars, totalMarginPercent,
                completedJobCount, jobs: [{ selectionCycleId, serviceDate, price, totalCost, margin }] }
    Filter:   Only completed selection_cycles (status = 'completed')
```

### Cost Categories
```
GET /api/businesses/:id/cost-categories
    Response: system defaults + any custom categories for this business
```

---

## Business Rules

1. Auto labor line is created server-side on departure event if a matching arrival exists. Manual overrides are always permitted.
2. If `hourly_rate` is null for a team member, labor `amount` = $0.00 and hours are still recorded. Mobile UI should surface a warning prompting the business owner to set the rate.
3. Margin calculation requires `selection_cycles.price` to be non-null. If null, display "Price not set" instead of margin.
4. `selection_cycles.price` is auto-populated from `customer_cycle_assignments.price_per_visit` at cycle creation time. If `price_per_visit` is null, `price` starts null.
5. For ad hoc jobs (no `customer_cycle_assignment`), price must be set directly on the selection cycle via the PATCH price endpoint.
6. Only one labor `job_costs` row per team member per job (prevent duplicates from multiple departure events). If a second departure fires, update the existing row rather than creating a new one.
7. Estimated hours = sum of `tasks.time_allotment_minutes` for all selected tasks on this job, converted to decimal hours. Used only for display comparison — not stored, calculated at query time.

---

## UI Additions

### ServiceCallDetailScreen (per-job view)
New "Job Costing" section below existing content:
- **Price** — editable field, pre-filled from assignment or blank
- **Labor** — table: Member Name | Est. Hours | Actual Hours | Rate | Cost. Subtotal row.
- **Materials** — single editable dollar field
- **Overhead** — single editable dollar field
- **Total Cost** — calculated, read-only
- **Margin** — `$X (Y%)`, read-only. Grayed out if price not set.
- Clock In / Clock Out buttons (shown if geo-fence unavailable)

### CustomerDetailScreen (aggregate view)
New "Profitability" summary card:
- Total Revenue | Total Cost | Margin ($) | Margin (%) | Job Count
- Tap to expand: per-job breakdown list

---

## Migrations
- `017_job_costing.js` — `cost_categories` table (+ seed data), `job_costs` table, `team_members.hourly_rate`, `customers.lat/lng/geocoded_at`, `customer_cycle_assignments.price_per_visit`, `selection_cycles.price`
- `018_geofence_events.js` — `geofence_events` table

---

## Open Questions

- **Geo-fence radius:** 100m is the default. Should this be configurable per business (e.g., large rural properties need a bigger radius)?
- **Geocoding failure UI:** When Mapbox fails to resolve an address, what should the business owner see on the customer record? (Proposed: inline alert with "Retry" button.)
- **Multiple departures:** Rule 6 says update the existing labor row on a second departure. Should the business owner be notified when this happens (suggests the team member is returning to a job)?
