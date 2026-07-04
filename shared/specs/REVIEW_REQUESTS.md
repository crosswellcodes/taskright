# Review Requests — Feature Spec
**Status:** Design complete. All decisions resolved.
**Dependencies:** Geo-fencing infrastructure (`JOB_COSTING.md`), Twilio Messaging Service (existing), `/review/[token]` page (new Next.js route)

---

## Overview

When a team member departs a jobsite (geo-fence exit), the system automatically sends an SMS to the customer with a link to a no-auth review page. The customer submits a star rating and optional comment. Responses are captured internally and surface alongside existing in-app feedback in the business owner's views.

Internal review capture is the primary goal. Word-of-mouth and internal rating monitoring deliver more actionable signal for SMBs than public platform monitoring. A future option to surface internal reviews to Google is planned but not in scope for v1.

---

## Flow

```
Team member departs jobsite
        ↓
geofence_events record written (type: 'departure')
        ↓
Server checks: customer opted out? → if yes, stop here
        ↓
Server checks: review token already exists for this job? → if yes, stop here
        ↓
[Cooldown check — TBD, see Open Questions]
        ↓
Create review_tokens record (7-day expiry)
        ↓
[Timing delay — TBD, see Open Questions]
        ↓
Send outbound SMS via Twilio Messaging Service
        ↓
Customer opens taskrightpro.com/review/[token]
        ↓
Customer submits rating + optional comment
        ↓
Write to feedbacks table (source: 'sms_request')
        ↓
Business owner sees response in CustomerDetailScreen feedback views
```

---

## Data Model

### New Table: `review_tokens`

| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| selection_cycle_id | int | FK → selection_cycles, unique (one token per job) |
| customer_id | int | FK → customers |
| business_id | int | FK → businesses (denormalized for routing) |
| token | varchar(36) | UUID, unique |
| expires_at | timestamptz | 7 days from `created_at` |
| sent_at | timestamptz | Nullable. When SMS was dispatched. |
| opened_at | timestamptz | Nullable. Set on first page load (for open-rate tracking). |
| submitted_at | timestamptz | Nullable. Set when feedback is submitted. |
| created_at | timestamptz | |

Unique constraint on `selection_cycle_id` — one token per job, enforced at DB level.

---

### Modified Tables

#### `feedbacks` — new column
| Column | Type | Notes |
|--------|------|-------|
| source | varchar(20) | `'in_app'` (default for existing rows) \| `'sms_request'`. Distinguishes solicited vs. unsolicited feedback in business owner views. |

> ⚠️ Verify current `feedbacks` schema against `003_feedbacks.js` and `008_feedback_business_notes.js` before writing migration. Confirm `selection_cycle_id` and `customer_id` columns exist and that adding a `source` column with a default does not break existing queries.

#### `customers` — new column
| Column | Type | Notes |
|--------|------|-------|
| review_requests_opted_out | boolean | Default false. Set by business owner on behalf of customer. |

---

## API Surface

### No-Auth Review Page (public, no JWT)
```
GET  /api/review/:token
     Response: { valid: boolean, customerName, businessName, serviceDate }
     Notes:    Returns only non-sensitive data. Sets review_tokens.opened_at on first call.
               Returns { valid: false } for expired or non-existent tokens.

POST /api/review/:token
     Body:     { rating: number (1–5), comment?: string }
     Response: { success: true }
     Side effects: writes feedbacks row (source: 'sms_request'), sets review_tokens.submitted_at
     Idempotent: if already submitted, return { success: true } without writing a second row
```

### Business Owner — Opt-Out Toggle
```
PATCH /api/businesses/:id/customers/:customerId
      Body: { reviewRequestsOptedOut: boolean }
      Notes: Extend existing customer update endpoint
```

---

## SMS Content

Sent via the business's Twilio Messaging Service (same infrastructure as all other outbound SMS).

```
Hi [customer.name], how was your [business.name] service today?
Leave a quick note — it only takes a moment:
[WEBSITE_URL]/review/[token]
```

`WEBSITE_URL` env var controls the domain (existing — already used for the task selection SMS link).

**If opted out:** No SMS is sent. No token is created. Stop at the opt-out check in the flow.

---

## No-Auth Review Page (`/review/[token]`)

New Next.js App Router route: `TaskRight-Website/src/app/review/[token]/page.tsx`

Follows the same pattern as `/s/[token]` (no-auth task selection page).

**States:**

| State | Condition | UI |
|-------|-----------|-----|
| Valid | Token exists, not expired, not submitted | Star selector (1–5) + optional comment + Submit |
| Already submitted | `submitted_at` is non-null | "You've already shared feedback for this service. Thank you." |
| Expired | Past `expires_at` | "This review link has expired." |
| Invalid | Token not found | "This link isn't valid." |

**On submit:** POST to backend → show "Thank you — your feedback has been shared with [business.name]."

**On load (first open):** GET to backend sets `opened_at` (for open-rate tracking in future analytics).

---

## Business Rules

1. Review request is triggered only by a `geofence_events` departure record — not by the manual "Mark Service Complete" button. A team member completing a job without going through geo-fencing does not trigger a review request.
2. If `customers.review_requests_opted_out = true`, no token is created and no SMS is sent.
3. One token per job (`selection_cycle_id` unique constraint). If a second departure event fires for the same job (e.g., team member re-enters and exits the geo-fence), the existing token is reused — no second SMS.
4. Tokens expire 7 days after creation. Expired tokens reject both GET and POST.
5. Submitted tokens are idempotent — a second POST returns `{ success: true }` but does not write a second feedback row.
6. The `source: 'sms_request'` column on `feedbacks` allows business owner views to distinguish SMS-solicited reviews from in-app feedback submitted voluntarily by the customer.
7. Opt-out is controlled by the business owner on behalf of the customer (no self-service opt-out mechanism in v1). The opt-out flag persists across all future jobs for that customer until the owner reverses it.

---

## Resolved Decisions

### Item 7 — Timing: Immediate
SMS is sent inline when the departure event is received — no delay, no job queue. The customer decides when to respond. A delay would feel laggy and add infrastructure complexity for no UX gain.

**Implementation note:** The departure handler in `POST /api/team-members/:id/jobs/:selectionCycleId/geofence` calls `notificationService` for the review SMS in the same async block as labor cost creation. Fire-and-forget, same pattern as other outbound SMS.

---

### Item 9 — Cooldown: One per job (matches service cycle cadence)
Customers are asked at the same frequency as their service — weekly customers get a weekly ask, monthly customers get a monthly ask. The intent is to foster direct communication and reinforce the two-way SMS channel. Customers who want fewer requests can ask their service provider to opt them out.

**Implementation note:** No time-based cooldown query is needed. The unique constraint on `review_tokens.selection_cycle_id` already enforces one request per job. The natural job schedule is the cadence. No additional logic required in the departure handler.

---

## Migrations
- `019_review_tokens.js` — `review_tokens` table, `feedbacks.source` column (default `'in_app'`), `customers.review_requests_opted_out` column (default `false`)
