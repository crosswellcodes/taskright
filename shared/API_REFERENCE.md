# TaskRight API Reference

## Overview

The TaskRight backend is a Node.js/Express API server with PostgreSQL 18 database. It provides endpoints for:
- **Businesses** (service providers): manage tasks, service cycles, staff, customers
- **Customers**: view services, select tasks, submit selections, leave feedback

### Base URL
- **Development**: `http://localhost:3000/api`
- **Production**: `https://api.taskrightpro.com/api` (example)

### Authentication
- **Method**: JWT (JSON Web Tokens)
- **Header**: `Authorization: Bearer <token>`
- **Token Format**:
  ```json
  {
    "sub": "user_id",
    "type": "business" | "customer",
    "businessId": "...",
    "customerId": "...",
    "iat": 1234567890,
    "exp": 1234567890
  }
  ```

### Response Format
All endpoints return JSON:
```json
{
  "success": true|false,
  "data": { /* response payload */ },
  "error": "error message if success=false",
  "code": "ERROR_CODE"
}
```

---

## Authentication Endpoints

### Send OTP Verification Code
**POST** `/auth/verify/send`

Used by the web signup flow to verify a phone number before account creation. Powered by Twilio Verify — requires `TWILIO_VERIFY_SERVICE_SID` in backend `.env`.

**Request Body**:
```json
{ "phoneNumber": "+14155551234" }
```

**Response (200)**:
```json
{ "success": true }
```

**Error Responses**:
- `400` — `VALIDATION_ERROR` — Phone number missing
- `429` — `RATE_LIMITED` — Too many send attempts for this number
- `500` — `INTERNAL_ERROR`

---

### Business Signup
**POST** `/auth/businesses/signup`

**Request Body**:
```json
{
  "name": "ABC Cleaning Co.",
  "phoneNumber": "+14155551234",
  "schedulingFormat": "date_based",
  "otpCode": "123456"
}
```

`otpCode` is optional. When present (web signup flow), the phone is verified against Twilio Verify before account creation. When absent (mobile app flow), verification is skipped — existing behaviour unchanged.

**Response (201)**:
```json
{
  "success": true,
  "business": {
    "id": 1,
    "name": "ABC Cleaning Co.",
    "phoneNumber": "+14155551234",
    "schedulingFormat": "date_based",
    "joinCode": "ABC123",
    "createdAt": "2026-03-16T12:00:00Z"
  },
  "token": "eyJhbGc...",
  "expiresIn": 86400
}
```

`joinCode` is a stable 6-character uppercase alphanumeric code. Share with customers as `taskrightpro.com/join/ABC123` so they can self-register. Never changes — no rotation needed at launch scale.

**Error Responses**:
- `400` — `VALIDATION_ERROR` — Invalid input
- `400` — `INVALID_OTP` — OTP code wrong or expired (web flow only)
- `409` — `DUPLICATE_PHONE` — Phone already registered
- `500` — `INTERNAL_ERROR`

---

### Business Login
**POST** `/auth/businesses/login`

**Request Body**:
```json
{
  "phoneNumber": "+14155551234",
  "otpCode": "123456"
}
```

`otpCode` is optional. When present (web portal login — see `WEB_PORTAL.md` M0), it's verified via `getProvider('otp')` before a token is issued. When absent (mobile app flow), verification is skipped — existing behaviour unchanged.

**Response (200)**:
```json
{
  "success": true,
  "business": {
    "id": 1,
    "name": "ABC Cleaning Co.",
    "phoneNumber": "+14155551234"
  },
  "token": "eyJhbGc...",
  "expiresIn": 86400
}
```

**Error Responses**:
- `400` — `VALIDATION_ERROR` — Phone not provided
- `400` — `INVALID_OTP` — OTP code wrong or expired (web flow only)
- `404` — `BUSINESS_NOT_FOUND`
- `500` — `INTERNAL_ERROR`

---

### Get Own Business Profile
**GET** `/businesses/:businessId`

Self business profile. Used by the web portal dashboard shell (header) and Account module — see `WEB_PORTAL.md` M0. Requires `requireBusiness` (the token's `businessId` must match `:businessId`).

**Response (200)**:
```json
{
  "success": true,
  "business": {
    "id": 1,
    "name": "ABC Cleaning Co.",
    "phoneNumber": "+14155551234",
    "schedulingFormat": "date_based",
    "timeZone": "America/Chicago",
    "joinCode": "ABC123",
    "entityType": "sole_prop",
    "contactFirstName": null,
    "contactLastName": null,
    "contactEmail": null,
    "businessStreet": null,
    "businessCity": null,
    "businessState": null,
    "businessZip": null,
    "smsProvisioningStatus": "pending",
    "a2pRegistrationStatus": "pending",
    "createdAt": "2026-03-16T12:00:00Z"
  }
}
```

`timeZone` (added Oct 14, 2026, migration 029) is the business's IANA zone (`businesses.timezone`, default `America/Chicago`; an invalid stored value falls back to the default). The web portal renders "today" and every clock time in it. There's no endpoint to change it yet; that belongs to Account (M7, on hold).

**Error Responses**:
- `401` — `MISSING_TOKEN` / `INVALID_TOKEN`
- `403` — `FORBIDDEN` — Token's business doesn't match `:businessId`
- `404` — `BUSINESS_NOT_FOUND`
- `500` — `INTERNAL_ERROR`

---

### Get Home Summary
**GET** `/businesses/:businessId/home-summary`

Web portal Home/Today aggregate (`WEB_PORTAL.md` M1) — Action Center, today, a 7-day week strip, lean month-to-date revenue, recent reviews, and the on-the-clock board, composed in one call instead of N client-side requests.

**Response (200)**:
```json
{
  "success": true,
  "summary": {
    "timeZone": "America/Chicago",
    "actionCenter": {
      "awaitingConfirmation": [
        { "selectionCycleId": 12, "customerId": 3, "customerName": "Jane Doe", "serviceDate": "2026-10-14", "submissionDeadline": "2026-10-13" }
      ],
      "pastDeadline": [
        { "selectionCycleId": 9, "customerId": 2, "customerName": "John Doe", "serviceDate": "2026-10-10", "submissionDeadline": "2026-10-08" }
      ],
      "unassignedUpcoming": [
        { "selectionCycleId": 12, "customerId": 3, "customerName": "Jane Doe", "serviceDate": "2026-10-14" }
      ],
      "unreadMessages": [
        { "customerId": 2, "customerName": "John Doe", "unreadCount": 2, "lastMessageAt": "2026-10-14T15:02:11.000Z" }
      ]
    },
    "today": {
      "serviceDate": "2026-10-12",
      "items": [
        { "selectionCycleId": 10, "customerId": 4, "customerName": "Ann Smith", "serviceDate": "2026-10-12", "submitted": true, "assigned": true }
      ]
    },
    "weekStrip": [
      { "date": "2026-10-12", "count": 2 }
    ],
    "revenue": { "monthToDate": 1250.00 },
    "recentReviews": [
      { "id": 5, "rating": 5, "feedbackText": "Great job!", "customerName": "Ann Smith", "createdAt": "2026-10-11T14:00:00Z" }
    ],
    "activeClocks": [
      { "teamMemberId": 7, "teamMemberName": "Ann", "selectionCycleId": 10, "customerId": 4, "customerName": "Ann Smith", "arrivalAt": "2026-10-12T14:05:00Z" }
    ]
  }
}
```

**Every date boundary is the business's local day** (`timeZone`, from `businesses.timezone`, migration 029; added Oct 14, 2026) — not the server's UTC day. "Today", the week strip, "deadline has passed" (deadline < today) and the month for `monthToDate` all use it, so from 7pm to midnight Central Home still shows the Central date. `awaitingConfirmation` = open, unsubmitted cycles whose deadline (if any) hasn't passed. `pastDeadline` = open, unsubmitted cycles whose deadline has passed. `unassignedUpcoming` = open cycles due within 7 days with no `service_assignments` row. `today`/`weekStrip` cover the next 7 days starting today. `revenue.monthToDate` sums `price` over cycles completed this calendar month (lean — not a full margin rollup; that lands with Money/M6). `unreadMessages` (added Oct 14, 2026, M4) = customers with unread inbound messages (`messages.read_at` NULL), newest first. The "failed SMS" item is **not yet implemented**, because no delivery-status column exists.

**Error Responses**:
- `401` — `MISSING_TOKEN` / `INVALID_TOKEN`
- `403` — `FORBIDDEN`
- `404` — `BUSINESS_NOT_FOUND`
- `500` — `INTERNAL_ERROR`

---

### Resolve Business Join Code
**GET** `/auth/businesses/join/:joinCode`

Pre-signup lookup used by the web customer signup page (`/join/[code]`). Returns business identity so the page can display "You're joining [Business Name]" before the customer enters their details. Case-insensitive.

**No authentication required.**

**Response (200)**:
```json
{
  "success": true,
  "businessId": 1,
  "businessName": "ABC Cleaning Co."
}
```

**Error Responses**:
- `404` — `INVALID_JOIN_CODE` — No business with this join code
- `500` — `INTERNAL_ERROR`

---

### Customer Signup
**POST** `/auth/customers/signup`

**Request Body**:
```json
{
  "phoneNumber": "+14155559876",
  "businessId": 1,
  "name": "Sarah Johnson",
  "otpCode": "123456"
}
```

`name` and `otpCode` are both optional.
- **Web flow** (`/join/[code]` page): include both — `name` is collected in Step 1, `otpCode` from Twilio Verify in Step 2. Account is only created after OTP is approved.
- **Mobile flow**: omit both — `businessId` is passed directly, verification is skipped. Existing behaviour unchanged.

If `name` is omitted, the customer's phone number is stored as a placeholder name.

**Response (201)**:
```json
{
  "success": true,
  "customer": {
    "id": 5,
    "businessId": 1,
    "phoneNumber": "+14155559876",
    "createdAt": "2026-03-16T12:00:00Z"
  },
  "token": "eyJhbGc...",
  "expiresIn": 86400
}
```

**Error Responses**:
- `400` — `VALIDATION_ERROR` — Invalid input
- `400` — `INVALID_OTP` — OTP code wrong or expired (web flow only)
- `404` — `BUSINESS_NOT_FOUND`
- `409` — `DUPLICATE_CUSTOMER` — Customer already exists for this business
- `500` — `INTERNAL_ERROR`

---

### Customer Login
**POST** `/auth/customers/login`

**Request Body**:
```json
{
  "phoneNumber": "+14155559876"
}
```

**Response (200)**:
```json
{
  "success": true,
  "customer": {
    "id": 5,
    "name": "Sarah Johnson",
    "phoneNumber": "+14155559876",
    "businessId": 1
  },
  "token": "eyJhbGc...",
  "expiresIn": 86400
}
```

**Error Responses**:
- `400` — `VALIDATION_ERROR` — Phone not provided
- `404` — `CUSTOMER_NOT_FOUND`
- `500` — `INTERNAL_ERROR`

---

### Get Task Selection (Tokenized Link)
**GET** `/auth/selection/:token`

No-auth endpoint. Called by the `/s/[token]` web page when a customer taps the link texted to them via the `T` SMS keyword. Token is a UUID stored on the `selection_cycles` row with a 7-day expiry.

**No authentication required.**

**Response (200)**:
```json
{
  "success": true,
  "cycleId": 10,
  "serviceDate": "2026-05-21",
  "businessName": "ABC Cleaning Co.",
  "availableTasks": [
    { "id": 1, "name": "Bathroom cleaning", "timeAllotmentMinutes": 45 },
    { "id": 2, "name": "Vacuum all rooms", "timeAllotmentMinutes": 30 }
  ],
  "currentTaskIds": [1, 2]
}
```

`currentTaskIds` are the task IDs from the most recent submitted selection for this customer. Pre-populates the checklist as a convenience — customer sees their usual preferences already checked.

**Error Responses**:
- `404` — `INVALID_TOKEN` — Token not found or expired

---

### Submit Task Selection (Tokenized Link)
**POST** `/auth/selection/:token/submit`

Saves the customer's task choices for the selection cycle. Can be called even if no tasks are selected (empty array is valid — customer is confirming "no specific tasks").

**No authentication required.**

**Request Body**:
```json
{
  "selectedTaskIds": [1, 2]
}
```

Empty array is valid: `{ "selectedTaskIds": [] }` — interpreted as "no specific tasks."

**Response (200)**:
```json
{
  "success": true,
  "serviceDate": "2026-05-21"
}
```

**Behavior**: Upserts a `selections` row for the cycle with `status: 'submitted'`. If a selection already exists for this cycle, it is replaced. The cycle's `selection_token` is consumed — the same token cannot be used to resubmit (prevents replay; customer must reply T again to get a new link).

**Error Responses**:
- `400` — `VALIDATION_ERROR` — `selectedTaskIds` is not an array
- `400` — `INVALID_TASKS` — One or more task IDs are not available for this cycle
- `404` — `INVALID_TOKEN` — Token not found or expired
- `500` — `INTERNAL_ERROR`

---

## Customer Endpoints

### Get Current Selection Cycle
**GET** `/customers/:customerId/selection-cycle/current`

**Authentication**: Required (Customer)

**Response (200)**:
```json
{
  "success": true,
  "selectionCycle": {
    "id": 10,
    "serviceDate": "2026-03-24T09:00:00Z",
    "submissionDeadline": "2026-03-23T18:00:00Z",
    "businessId": 1,
    "businessName": "ABC Cleaning Co.",
    "totalHours": 3,
    "status": "open",
    "availableTasks": [
      { "id": 1, "name": "Bathroom cleaning", "timeAllotmentMinutes": 45 },
      { "id": 2, "name": "Vacuum all rooms", "timeAllotmentMinutes": 30 }
    ],
    "assignedStaff": [
      { "id": 12, "name": "John Smith", "type": "individual" },
      { "id": 25, "name": "Team A", "type": "group", "members": [...] }
    ],
    "previousSelection": null  // or { selectedTasks: [...], selectedTotalHours: 1.5 }
  },
  "recentCompletion": null  // or { id: 9, serviceDate: "2026-03-17", ... }
}
```

**Error Responses**:
- `404` — No open cycle found
- `401` — Unauthorized

---

### Submit Task Selection
**POST** `/customers/:customerId/selection-cycle/:selectionCycleId/submit`

**Authentication**: Required (Customer)

**Request Body**:
```json
{
  "selectedTasks": [1, 2, 4],
  "selectedTotalHours": 1.5
}
```

**Response (200)**:
```json
{
  "success": true,
  "selection": {
    "id": 42,
    "selectionCycleId": 10,
    "customerId": 5,
    "selectedTasks": [1, 2, 4],
    "selectedTotalHours": 1.5,
    "status": "submitted",
    "submittedAt": "2026-03-16T14:30:00Z"
  }
}
```

**Error Responses**:
- `404` — Cycle or customer not found
- `400` — Validation error (tasks not available, time exceeds available, etc.)
- `409` — Already submitted for this cycle

---

### Get Upcoming Services
**GET** `/customers/:customerId/upcoming-services`

**Authentication**: Required (Customer)

**Response (200)**:
```json
{
  "success": true,
  "services": [
    {
      "id": 10,
      "serviceDate": "2026-03-24T09:00:00Z",
      "submissionDeadline": "2026-03-23T18:00:00Z",
      "businessName": "ABC Cleaning Co.",
      "totalHours": 3,
      "totalMinutesAvailable": 180,
      "availableTasks": [
        { "id": 1, "name": "Bathroom cleaning", "timeAllotmentMinutes": 45 }
      ],
      "selectionSubmitted": false
    }
  ]
}
```

---

### Get Selection History
**GET** `/customers/:customerId/selection-history`

**Authentication**: Required (Customer)

**Response (200)**:
```json
{
  "success": true,
  "history": [
    {
      "id": 42,
      "serviceDate": "2026-03-17T09:00:00Z",
      "selectedTasks": [1, 2],
      "selectedTotalHours": 1.5,
      "submittedAt": "2026-03-16T14:30:00Z",
      "status": "submitted"
    }
  ]
}
```

---

### Submit Feedback
**POST** `/customers/:customerId/feedback`

**Authentication**: Required (Customer)

**Request Body**:
```json
{
  "selectionCycleId": 10,
  "rating": 5,
  "comment": "Great job! Everything was clean.",
  "wouldRecommend": true
}
```

**Response (201)**:
```json
{
  "success": true,
  "feedback": {
    "id": 99,
    "selectionCycleId": 10,
    "customerId": 5,
    "rating": 5,
    "comment": "Great job! Everything was clean.",
    "wouldRecommend": true,
    "submittedAt": "2026-03-18T10:00:00Z"
  }
}
```

---

## Business Endpoints

### Tasks

> **Phase 2 (SERVICE_TASK_OWNERSHIP.md, migration 023):** the global `tasks` table and its
> `POST/GET/PUT/DELETE /businesses/:businessId/tasks` routes were **removed**. Tasks are now
> **owned** per-service (`service_tasks`) and per-template (`template_tasks`). There are no
> standalone task endpoints — a task is authored inline inside a Service or a Template as part
> of that resource's `tasks` array. **Task shape everywhere:** `{ id?, name, timeAllotmentMinutes }`
> (`id` present ⇒ existing `service_task`, diff-upserted in place; absent ⇒ new).

---

### Service Templates (formerly "Service Cycles")

> **Service Model (SERVICE_MODEL.md):** these endpoints manage the business-global **template
> library** (`service_templates`). A template only *seeds* a customer's Service; it is decoupled
> after instantiation. Per-customer Services are created via the Customer Services endpoints below.
> Renamed from `/service-cycles` in C4 (function symbols + paths + response keys → template vocabulary).

#### Create Service Template
**POST** `/businesses/:businessId/service-templates`

**Request Body**:
```json
{
  "name": "Weekly Cleaning",
  "frequency": "weekly",
  "daysBeforeServiceDeadline": 3,
  "daysBeforeAutoRepeat": 1,
  "tasks": [{ "name": "Vacuum", "timeAllotmentMinutes": 20 }, { "name": "Mop", "timeAllotmentMinutes": 30 }]
}
```
**Response (201)**: `{ success, serviceTemplate: { id, businessId, name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, tasks: [{ id, name, timeAllotmentMinutes }], createdAt } }`

`GET` returns `serviceTemplates: [{ …, tasks: [{ id, name, timeAllotmentMinutes }] }]`. `PUT` accepts `tasks` (replaces the menu wholesale) and returns the updated `tasks`.

#### Get All Service Templates
**GET** `/businesses/:businessId/service-templates` → `{ success, serviceTemplates: [...], total }`

#### Update Service Template
**PUT** `/businesses/:businessId/service-templates/:templateId` → `{ success, serviceTemplate }`

#### Delete Service Template
**DELETE** `/businesses/:businessId/service-templates/:templateId`
Existing customer Services are unaffected (`template_id` is `ON DELETE SET NULL`).

---

### Customers (Business View)

#### Add Customer
**POST** `/businesses/:businessId/customers`

**Request Body**:
```json
{
  "name": "Sarah Johnson",
  "phoneNumber": "+14155559876"
}
```
Both are required (`phoneNumber` in E.164). `409 DUPLICATE_CUSTOMER` if the phone already exists for this business. Returns `201 { success, customer: { id, businessId, name, phoneNumber, createdAt } }`.

#### Get All Customers
**GET** `/businesses/:businessId/customers`

→ `{ success, customers: [{ id, name, phoneNumber, assignedCycles: [{ id, name, frequency, totalHours }], address, lat, lng, geocodeStatus }], total }`. `address`, `lat`/`lng` (numbers or `null`) and `geocodeStatus` were added Oct 13, 2026 for the web portal's customer map (WEB_PORTAL M3). They're additive, and only `ok` rows have coordinates.

#### Get Customer Details
**GET** `/businesses/:businessId/customers/:customerId`

Response `customer` also carries `lat`/`lng` (numbers or `null`). **Fix (Oct 13, 2026):** `getCustomerDetails` always computed `geocodeStatus`/`geocodeRelevance`, but the route's field mapping dropped them, so the mobile "couldn't map this address" note never rendered. They're returned now.

Response `customer` includes geocoding legibility for the address → auto-geofence pipeline:
- **`geocodeStatus`** — `none` (no address) · `ok` (coords resolved) · `pending` (address set, still within the retry budget) · `failed` (address couldn't be mapped after `GEOCODE_MAX_ATTEMPTS`; owner should check it). Drives the "couldn't map this address for automatic clock-in" note on `CustomerDetailScreen`.
- **`geocodeRelevance`** — number `0–1` or `null`; the best Mapbox candidate's confidence. On a `failed` row a non-null value means a low-confidence match was rejected (not stored) rather than no match at all.

See `shared/specs/GEOCODING_RELIABILITY.md`. Coordinates are stored only when relevance ≥ `GEOCODE_MIN_RELEVANCE` (0.8) — a confident-wrong pin is worse than manual tracking.

#### Delete Customer
**DELETE** `/businesses/:businessId/customers/:customerId`

> **Note:** `POST .../assign-cycle` was **removed in C4**. To seed a Service from a template,
> `POST .../services` with `{ templateId }` (see Customer Services below).

---

### Customer Services (Service Model — per-customer service definitions)

A **Service** is a customer's own service definition (name, frequency, deadlines, task menu, hours,
price, schedule) living on `customer_services`. Built directly on the customer profile; a template
only seeds initial values. Downstream job costing / reviews are unaffected (they key off the
Service Call / `selection_cycles`).

#### Create Service
**POST** `/businesses/:businessId/customers/:customerId/services`

**Request Body** (from scratch, or pass `templateId` to seed defaults; explicit fields override):
```json
{
  "templateId": null,
  "name": "Alice Weekly",
  "frequency": "weekly",
  "daysBeforeServiceDeadline": 2,
  "daysBeforeAutoRepeat": 1,
  "tasks": [{ "name": "Vacuum", "timeAllotmentMinutes": 20 }, { "name": "Mop", "timeAllotmentMinutes": 30 }],
  "totalHours": 3,
  "startDate": "2026-07-20",
  "dayOfWeek": null,
  "pricePerVisit": 150,
  "assignee": { "teamMemberId": 1 }
}
```
`201` → `{ success, service }`. Generates the upcoming Service Calls and the Service's own task menu
(`service_tasks`). When seeded from a template, its `template_tasks` are copied into `service_tasks`.
Scheduling validated per business format (`startDate` for date-based, `dayOfWeek` 0–6 for day-of-week).
Multiple Services per customer are allowed.

**`assignee`** (optional, create-flow team assignment) — `{ teamMemberId }` **or** `{ teamId }` (XOR). When present, after the Calls are generated the same person/group is assigned to **every generated open Call** (all 4 for recurring, the single Call for `one_time`) — the service-level fan-out. **Validated-first**: a bad assignee (not owned by the business, or both/neither id) fails the whole create (`400`/`404`, zero rows written — no half-create). Omit it → nothing assigned (the normal unassigned state). Per-visit override still lives on the dashboard (`PUT .../assignments/:selectionCycleId`, last-write-wins).

**`frequency`** ∈ `one_time | weekly | biweekly | monthly | yearly`. **`one_time`** is an ad-hoc single-visit sale — it generates **exactly one** Service Call (recurring frequencies generate 4 upcoming) and never recurs. (Same set is accepted on Service Templates.) `pricePerVisit` applies equally to a one-time sale or a recurring service.

#### Get Service (full definition)
**GET** `/businesses/:businessId/customers/:customerId/services/:serviceId`
→ `{ success, service: { id, customerId, templateId, name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, totalHours, pricePerVisit, startDate, dayOfWeek, tasks: [{ id, name, timeAllotmentMinutes }] } }`

#### Update Service (definition-only)
**PATCH** `/businesses/:businessId/customers/:customerId/services/:serviceId`
Accepts any subset of `{ name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, totalHours, pricePerVisit, tasks, startDate, dayOfWeek }`. `tasks` is **diff-upserted by id** (item with `id` → update in place; without `id` → insert; existing row absent from the payload → delete) so live selections never orphan (`selections.selected_tasks` references `service_tasks.id`). Does **not** regenerate or delete Service Calls; a deadline change recomputes `submission_deadline` on open calls only.

#### Delete Service
**DELETE** `/businesses/:businessId/customers/:customerId/services/:serviceId`
Cascades open Service Calls + menu. Refuses with `409 HAS_HISTORY` if any Service Call is completed (preserves job-costing / review history).

#### Assign Service (fan out to all open Calls)
**PUT** `/businesses/:businessId/customers/:customerId/services/:serviceId/assignment`
Body: `{ teamMemberId }` **or** `{ teamId }` (XOR). Assigns one person/group to **every open Service Call** of the service (`upsert` per Call — idempotent; **never touches completed Calls**). Ownership-validated: the service **and** the assignee must belong to the business (`404` otherwise; `400` on XOR violation). → `{ success, assignedCount }`. Same fan-out the create-flow `assignee` uses, exposed for reuse (bulk reassign-all-visits). Per-visit override remains on the dashboard `PUT .../assignments/:selectionCycleId` (last-write-wins).

---

### Team Members

#### Create Team Member
**POST** `/businesses/:businessId/team-members`

**Request Body**:
```json
{
  "name": "John Smith",
  "phoneNumber": "+14155551111",
  "weeklyHours": 40,
  "hourlyRate": 27.5
}
```
`hourlyRate` is optional (non-negative number, nullable). Returned as `teamMember.hourlyRate` (number or null).

#### Get All Team Members
**GET** `/businesses/:businessId/team-members`
Each entry includes `hourlyRate` (number or null) alongside `weeklyHours`, `groups`, etc. **Added Oct 14, 2026 (web portal M5):** `inviteAccepted` (bool) and `inviteCode` (the pending code, or `null` once accepted, since the code is cleared on accept). This lets the portal re-show a pending member's code.

#### Update Team Member
**PUT** `/businesses/:businessId/team-members/:memberId`

**Request Body** (all fields optional): `{ name, phoneNumber, weeklyHours, hourlyRate }`
**Validation (added Oct 14, 2026; same rules as create):** a non-empty `name` (trimmed), `phoneNumber` in E.164, and `weeklyHours` from 1 to 168 → `400 VALIDATION_ERROR`. A `phoneNumber` already used by another member of the business → `409 DUPLICATE_TEAM_MEMBER`.
`hourlyRate` (non-negative number, nullable — send `null`/`""` to clear) feeds job-costing labor: the labor line is auto-computed on a **geofence departure** as `amount = hoursActual × hourlyRate` (0.00 if the rate is null at that time). Setting the rate applies to labor computed after it's set; existing per-job labor can be adjusted on the Service Call detail screen. Returned as `teamMember.hourlyRate` (number or null).

**Team job resolution (2026-07-14, `TEAM_LABOR_COSTING.md` — no new endpoints):** the member-facing job views (`GET /api/team-members/:teamMemberId/jobs`, `/jobs/:selectionCycleId`, `PATCH .../complete`, `POST .../geofence`) now resolve a Call assigned to a **team** for every member of that team, not just individually-assigned members. `GET .../jobs` therefore includes group jobs and each row carries `isTeamAssigned` (bool) + `teamName` (nullable). Each group member records their own geofence → their own per-member labor line at their own rate, so a team-assigned Call's `laborLines`/profitability populate like an individual job's. Completion is first-to-complete-wins: a later member's `complete` returns `409 ALREADY_COMPLETED` (benign — the client treats it as "a teammate already completed this").

**Clock-in transparency (2026-07-23, `GEOFENCE_TRANSPARENCY.md`):**
- `GET /api/team-members/:teamMemberId/jobs` — "upcoming" (service date ≥ today) uses the business's day in `businesses.timezone` (Oct 15, 2026), so from 7pm to midnight Central tonight's jobs stay listed. Each job row now also carries **`autoTrackable`** (bool): true when the customer has geocoded coordinates (auto geofence clock-in available), false → manual tracking. (GT-B1: a boolean the client can't misuse, not raw coords.)
- **GET** `/api/team-members/:teamMemberId/active-clock` — the member's currently-open clock-in, if any, derived **read-only** from `geofence_events` (the latest event for a (member, cycle) is an `arrival` with no later `departure`). Auth: `requireTeamMember` (own id only). No writes, no migration.

  **Response (200)**:
  ```json
  {
    "success": true,
    "activeClock": {
      "selectionCycleId": 42,
      "customerId": 7,
      "customerName": "Alice Smith",
      "arrivalAt": "2026-07-23T14:12:00.000Z"
    }
  }
  ```
  `activeClock` is `null` when the member is not clocked into anything. Powers the cross-screen "you're clocked in" banner.

#### Delete Team Member
**DELETE** `/businesses/:businessId/team-members/:memberId`

Cascades: their `service_assignments` (those Calls become unassigned), `team_memberships` and `geofence_events` are deleted. `job_costs` rows are kept with `team_member_id` set to NULL (labor $ history preserved).

#### Active Clocks Board (web portal M5)
**GET** `/businesses/:businessId/active-clocks`

Every team member currently clocked in (their latest geofence event on a Call is an `arrival` with no later `departure`). It's read-only and uses the same query as Home's on-the-clock board (`getActiveClocksForBusiness`).
→ `{ success, activeClocks: [{ teamMemberId, teamMemberName, selectionCycleId, customerId, customerName, arrivalAt }] }`

---

### Team Groups

#### Create Group
**POST** `/businesses/:businessId/groups`

**Request Body**: `{ "name": "Team A" }`. Members are set separately (below).

**Response (201)**: `{ "success": true, "group": { "id": 25, "name": "Team A", "memberCount": 0 } }`

#### List Groups
**GET** `/businesses/:businessId/groups` → `{ success, groups: [{ id, name, memberCount, members: [{ id, name }] }] }`

#### Rename Group
**PUT** `/businesses/:businessId/groups/:groupId`. Body `{ name }`; `404` if the group isn't yours.

#### Set Group Members
**PUT** `/businesses/:businessId/groups/:groupId/members`. Body `{ memberIds: number[] }` **replaces** the membership, deduplicating repeated ids.
**Ownership (hardened Oct 14, 2026, M5):** every id must be a team member of this business → `404 NOT_FOUND` otherwise (nothing changes). Non-numeric ids → `400 VALIDATION_ERROR`. Previously any member id was accepted. Because a group assignment resolves to every member (S17), another business's member could have been shown this business's jobs.

#### Delete Group
**DELETE** `/businesses/:businessId/groups/:groupId`. Cascades its `team_memberships` and any `service_assignments` to it (those Calls become unassigned). Members stay on the team.

---

### Service Assignments

#### List Assignments
**GET** `/businesses/:businessId/assignments?serviceDate=YYYY-MM-DD`
**or** `?from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive, at most 62 days, same rules as the forecast range; added Oct 14, 2026 for the portal's Team week board).

→ `{ success, assignments: [{ selectionCycleId, serviceDate, customerId, teamMemberId, teamMemberName, teamId, teamName }] }` (`serviceDate` was added Oct 14, 2026). Needs `serviceDate` or a valid range (`400 VALIDATION_ERROR` otherwise).

#### Assign Staff to Cycle
**PUT** `/businesses/:businessId/assignments/:selectionCycleId`

**Request Body**:
```json
{
  "teamMemberId": 1,  // OR
  "teamId": 25
}
```

Upserts the Call's single `service_assignments` row (last-write-wins). If both ids are sent, `teamMemberId` wins.

**Ownership (hardened Oct 13, 2026, WEB_PORTAL M2):** the Call must belong to the business (`404 NOT_FOUND` otherwise), and so must the assignee (`404 NOT_FOUND` for a member/group of another business; `400 VALIDATION_ERROR` if neither id is sent). Before this, any authenticated business could overwrite another business's assignment by Call id.

**Response (200)**:
```json
{ "success": true, "message": "Assignment saved" }
```

#### Delete Assignment
**DELETE** `/businesses/:businessId/assignments/:selectionCycleId`

---

### Selections & Feedback (Business View)

#### Get Forecast (Service Calls by Day)
**GET** `/businesses/:businessId/selections[?from=YYYY-MM-DD&to=YYYY-MM-DD]`

Calls grouped by `serviceDate`, then by Service. **Default window:** today → today+30 (the mobile Dashboard/Forecast contract), where "today" is the business's day in `businesses.timezone` (Oct 15, 2026), not the server's UTC day. **Optional range** (added Oct 13, 2026 for the web portal's month calendar): `from` + `to`, both required together, inclusive, any dates past or future. Returns `400 VALIDATION_ERROR` for a partial range, a bad format, `from > to`, or a span over **62 days**.

**Response (200)**:
```json
{
  "success": true,
  "summary": {
    "totalCustomers": 9,
    "upcomingServices": [
      {
        "serviceDate": "2026-10-14T05:00:00.000Z",
        "customerSelectionsStatus": { "submitted": 1, "pending": 1 },
        "totalHours": 4,
        "serviceCycles": [
          {
            "id": 12,
            "name": "Weekly Clean",
            "pendingCustomers":   [{ "id": 5, "name": "Sarah", "selectionCycleId": 99,  "lifecycleState": "proposed" }],
            "submittedCustomers": [{ "id": 6, "name": "Tom",   "selectionCycleId": 100, "lifecycleState": "confirmed" }]
          }
        ]
      }
    ]
  }
}
```
`serviceDate` is an ISO timestamp, so split on `'T'`. `lifecycleState` (additive, Oct 13, 2026) follows the same SCL4 rule as `GET .../selection-cycles/:id`: `completed` > `confirmed` (submitted selection) > `proposed`. A completed Call with no submission stays in `pendingCustomers` but reads `completed`.

#### Mark Service Complete
**POST** `/businesses/:businessId/customers/:customerId/mark-service-complete`

**Request Body**:
```json
{
  "selectionCycleId": 10,
  "completedAt": "2026-03-24T11:00:00Z"
}
```

#### Get Service Call Detail
**GET** `/businesses/:businessId/selection-cycles/:selectionCycleId`

Full detail for a single Service Call, framed as a **proposed → confirmed → completed lifecycle** (see `shared/specs/SERVICE_CALL_LIFECYCLE.md`, built 2026-07-14). **No new endpoint** — this documents the enriched payload. 404 if the Call isn't owned by the business.

The `lifecycleState` is derived: `completed` if the cycle is completed; else `confirmed` if a `submitted` selection exists; else `proposed` (a `draft` selection is **not** a confirmation). `tasks[]` is the resolved list to render — the full default `service_tasks` menu (`source: "proposed"`) before confirmation, the customer's submitted subset with **resolved names** (`source: "confirmed"`) after. On a completed Call with no submitted selection the menu is shown flagged `scopeIsAssumed: true` (never an empty list). Numeric fields are coerced (`expectedHours`/`confirmedHours`/`expectedPrice`).

**Response (200)**:
```json
{
  "success": true,
  "serviceCall": {
    "selectionCycleId": 10,
    "serviceDate": "2026-07-22",
    "submissionDeadline": "2026-07-19",
    "status": "open",
    "customerId": 5,
    "customerName": "Sarah Johnson",
    "serviceCycleName": "Weekly Cleaning",
    "lifecycleState": "proposed",
    "tasks": [
      { "id": 31, "name": "Wipe counters", "minutes": 60, "source": "proposed" },
      { "id": 32, "name": "Vacuum floors", "minutes": 90, "source": "proposed" }
    ],
    "expectedHours": 3,
    "confirmedHours": null,
    "expectedPrice": 150,
    "scopeIsAssumed": false,
    "selectedTasks": [],
    "selectionStatus": null,
    "completedAt": null,
    "completionNotes": null,
    "teamMember": null,
    "team": null
  }
}
```

**Backward-compat:** `selectedTasks` (raw `service_tasks` ids) and `selectionStatus` (`draft`/`submitted`/null) are retained alongside the new fields. The `upcomingServices[]` rows on **Get Customer Details** likewise carry a derived `lifecycleState` (`proposed`/`confirmed`) for the list badge.

#### Get Customer Feedback
**GET** `/businesses/:businessId/customers/:customerId/feedback/latest`

**Response (200)**:
```json
{
  "success": true,
  "feedback": {
    "id": 99,
    "rating": 5,
    "comment": "Great job!",
    "wouldRecommend": true,
    "submittedAt": "2026-03-18T10:00:00Z"
  }
}
```

---

### Job Costing (Business View)

All routes require `authenticate` + `requireBusiness`. A "job" is a `selection_cycle`. Added 2026-07-04 (see `shared/specs/JOB_COSTING.md` and `JOB_COSTING_DATA_GAPS.md`).

#### Get Cost Categories
**GET** `/businesses/:businessId/cost-categories`

Returns the four GAAP system defaults (`business_id = null`, codes 4000/5000/5100/5200) plus this business's custom categories. Response: `{ success, categories: [{ id, business_id, code, name, type, is_system }] }`.

#### Set / Override Job Price
**PATCH** `/businesses/:businessId/jobs/:selectionCycleId/price`

Body: `{ price }` — non-negative number or `null`. Also the ad-hoc-job path (Rule 5). Cycles otherwise pre-fill `price` from the customer's `price_per_visit` at creation time (Rule 4). Response: `{ success, selectionCycle }`.

#### Set Assignment Recurring Price
**PATCH** `/businesses/:businessId/customers/:customerId/assignments/:assignmentId`

Body: `{ pricePerVisit }` — non-negative number or `null`. Sets `customer_cycle_assignments.price_per_visit`, which future cycle generation copies into new jobs' `price`. Response: `{ success, assignment }`. The **GET customer detail** payload (`GET /businesses/:id/customers/:customerId`) surfaces `assignmentId` (`cca.id`) and `pricePerVisit` on each `customer.assignedCycles[]` entry so the CustomerDetailScreen can drive this PATCH and show the current recurring price (added 2026-07-05 for the Profitability card).

#### Get Job Costs (per-job payload)
**GET** `/businesses/:businessId/jobs/:selectionCycleId/costs`

**Response (200)**:
```json
{
  "success": true,
  "costs": {
    "selectionCycleId": 10,
    "serviceDate": "2026-07-11T00:00:00.000Z",
    "status": "open",
    "price": 200,
    "estimatedHours": 1.5,
    "laborLines": [
      { "costId": 4, "teamMemberId": 1, "memberName": "Bob",
        "hoursActual": 2, "hourlyRate": 20, "amount": 40, "source": "auto" }
    ],
    "materialsAmount": 50,
    "materialsCostId": 5,
    "overheadAmount": 30,
    "overheadCostId": 6,
    "totalCost": 120,
    "marginDollars": 80,
    "marginPercent": 40,

    "expectedHours": 3,
    "confirmedHours": 1.5,
    "proposedLaborHours": 1.5,
    "proposedLabor": 30,
    "proposedLaborBreakdown": [
      { "teamMemberId": 1, "name": "Bob", "hourlyRate": 20 }
    ],
    "expectedLaborIncomplete": false,
    "expectedTotalCost": 110,
    "expectedMarginDollars": 90,
    "expectedMarginPercent": 45
  }
}
```
`estimatedHours` (Rule 7) = Σ `tasks.time_allotment_minutes` for the selected tasks ÷ 60, computed at query time — now **falls back to `expectedHours`** when no selection is submitted (was `0`). When `price` is null, `marginDollars`/`marginPercent` are `null` (Rule 3 — UI shows "Price not set"). `source` is `"auto"` (geofence-tracked) or `"manual"` (owner-corrected). `materialsCostId`/`overheadCostId` are the single v1 line's id (or `null` when none) so the per-job UI can drive a single editable field — POST when null, PATCH the existing line otherwise (added 2026-07-05 for the ServiceCallDetailScreen costing UI).

**Proposed / expected costing (added 2026-07-15, `SERVICE_CALL_LIFECYCLE.md` §9 — no new endpoint):** the *expected* labor cost + margin shown **before** the job runs. `proposedLabor` = `proposedLaborHours × Σ(assignee rates)` where `proposedLaborHours = confirmedHours ?? expectedHours` (PJC1/PJC3); a group sums every member's current card rate. `proposedLaborBreakdown` lists the assignee(s) + rate (null when unset). `expectedLaborIncomplete` is `true` when there's **no assignee, unknown hours, or any rate-less member** — the number is then a **floor**, never blank (PJC4). `expectedTotalCost` = `proposedLabor + materials + overhead`; `expectedMarginDollars/Percent` = vs `price` (null when no price). Rates are live (not snapshotted like actual labor — PJC5). The mobile screen renders these while the Call is `proposed`/`confirmed` and switches to the actuals-based `totalCost`/`margin*` at `completed`.

#### Add Cost Line (manual)
**POST** `/businesses/:businessId/jobs/:selectionCycleId/costs`

Body: `{ costCategoryId, amount, teamMemberId?, hoursActual? }`. Always stamps `source='manual'`. Labor-type categories **require** `teamMemberId` + `hoursActual`; non-labor categories must omit them (400 otherwise). Duplicate labor line for the same member+job → 409 (Rule 6). Response (201): `{ success, data }`.

#### Update Cost Line
**PATCH** `/businesses/:businessId/jobs/:selectionCycleId/costs/:costId`

Body: `{ amount?, hoursActual? }` (at least one). Marks the row `source='manual'` so a later geofence recompute won't overwrite it (D1). Response: `{ success, data }`.

#### Delete Cost Line
**DELETE** `/businesses/:businessId/jobs/:selectionCycleId/costs/:costId` → `{ success }`.

#### Business Profitability Rollup (web portal M6)
**GET** `/businesses/:businessId/profitability[?from=YYYY-MM-DD&to=YYYY-MM-DD]`

Business-wide version of the per-customer rollup below, over **completed** Calls whose `service_date` is in range (inclusive). Defaults to the current calendar month (UTC); max 366 days (`400 VALIDATION_ERROR` for a partial, inverted or too-long range). The same rules as per-customer apply: an unpriced job counts as $0 revenue but its costs count, and margin % is `null` when revenue is 0. It runs a fixed number of SQL aggregates regardless of range.

```json
{
  "success": true,
  "profitability": {
    "range": { "from": "2026-10-01", "to": "2026-10-31" },
    "totals": { "revenue": 495, "laborCost": 270, "materialsCost": 115, "overheadCost": 65, "totalCost": 450,
                "marginDollars": 45, "marginPercent": 9.09, "completedJobCount": 2, "unpricedJobCount": 0 },
    "byCategory": [ { "code": 4000, "name": "Service Revenue", "type": "revenue", "amount": 495 },
                    { "code": 5000, "name": "Direct Labor", "type": "labor", "amount": 270 } ],
    "byCustomer": [ { "customerId": 19, "customerName": "Jane", "revenue": 495, "totalCost": 450, "marginDollars": 45, "marginPercent": 9.09, "jobs": 2 } ],
    "byService":  [ { "serviceId": 31, "serviceName": "Weekly Clean", "customerId": 19, "customerName": "Jane", "revenue": 495, "totalCost": 450, "marginDollars": 45, "marginPercent": 9.09, "jobs": 2 } ],
    "jobs": [ { "selectionCycleId": 88, "serviceDate": "2026-10-12", "customerId": 19, "customerName": "Jane", "serviceId": 31, "serviceName": "Weekly Clean",
                "price": 345, "laborCost": 150, "materialsCost": 50, "overheadCost": 20, "totalCost": 220, "marginDollars": 125, "marginPercent": 36.23, "hasManualEdits": false } ],
    "pipeline": { "openJobCount": 49, "expectedRevenue": 5408 }
  }
}
```
- `byCategory`: a GAAP-coded statement. 4000 revenue, plus every system cost category (5000/5100/5200, always listed for a stable shape) and any business category with activity in range. Codes are integers.
- `byCustomer` / `byService`: sorted by revenue, then margin.
- `jobs`: newest first. Per-job `marginDollars`/`marginPercent` are `null` when the job has no price. `hasManualEdits` is true if any cost line on it is `source='manual'`.
- `pipeline`: **open** Calls in the same window and the sum of their `price` (scheduled, not yet earned). It isn't counted in totals.

#### Customer Profitability (aggregate)
**GET** `/businesses/:businessId/customers/:customerId/profitability`

Aggregates **completed** cycles only. Response: `{ success, profitability: { totalRevenue, totalCost, totalMarginDollars, totalMarginPercent, completedJobCount, jobs: [{ selectionCycleId, serviceDate, price, totalCost, marginDollars }] } }`.

---

### Review Requests

No-auth review endpoints (no JWT — same public pattern as `GET /auth/selection/:token`). Component 1/3, added 2026-07-05 (see `shared/specs/REVIEW_REQUESTS.md`). Triggered by a geofence **departure** event, which inline-creates a one-per-job `review_tokens` row (Rule 3, `selection_cycle_id` unique) and fires the review SMS fire-and-forget — honoring `customers.review_requests_opted_out` (Rule 2). Feedback lands in the `feedbacks` table with new columns `source` (`'in_app'` default | `'sms_request'`) and `rating` (smallint 1–5, nullable).

#### Get Review Context (no-auth)
**GET** `/review/:token`

Returns non-sensitive context for the `/review/[token]` page. Sets `opened_at` on first load. Response: `{ success, valid, customerName, businessName, serviceDate, alreadySubmitted }`. Missing **or** expired tokens (Rule 4) return `{ success: true, valid: false }` (indistinguishable, so the page can't probe).

#### Submit Review (no-auth)
**POST** `/review/:token`

Body: `{ rating: 1–5, comment? }`. Writes a `feedbacks` row (`source='sms_request'`, `rating`, `feedback_text=comment`) and sets `review_tokens.submitted_at`. Idempotent (Rule 5) — a resubmit returns `{ success: true }` without writing a second row. `410` for expired (Rule 4), `404` for missing token, `400` for out-of-range rating. If voluntary in-app feedback already exists for the same job, it is updated in place (avoids the `feedbacks` unique(`customer_id`,`selection_cycle_id`) collision).

#### Opt-Out Toggle (business owner)
**PATCH** `/businesses/:businessId/customers/:customerId`

The existing customer-update endpoint now also accepts `{ reviewRequestsOptedOut: boolean }` (owner-controlled, Rule 7). Persists to `customers.review_requests_opted_out`; echoed back on the response `customer` object. The **GET customer detail** payload (`GET /businesses/:id/customers/:customerId`) also surfaces `reviewRequestsOptedOut` so the CustomerDetailScreen can render + drive the toggle (added 2026-07-05 for Component 3, same additive-field pattern as the job-costing `assignmentId`/`materialsCostId`).

---

## Webhook Endpoints

Twilio posts to these endpoints. They accept `application/x-www-form-urlencoded` (not JSON) and always return `200` with TwiML `<Response/>` to prevent Twilio retries. No JWT authentication — called directly by Twilio.

### Inbound SMS
**POST** `/webhooks/inbound-sms`

**Authentication**: None (Twilio webhook — see note on signature validation below)

**Request Body** (urlencoded, sent by Twilio):
```
To=+14155550100&From=+14155559876&Body=Can+I+reschedule%3F&MessageSid=SM123abc&NumMedia=0
```

| Field | Description |
|-------|-------------|
| `To` | Business's dedicated Twilio phone number |
| `From` | Customer's phone number |
| `Body` | SMS message text (may be empty for MMS-only messages) |
| `MessageSid` | Twilio SID — used for deduplication |
| `NumMedia` | Count of attached media files (0 for SMS, ≥1 for MMS) |
| `MediaUrl0` | URL of first media file — requires Twilio Basic auth to fetch |
| `MediaContentType0` | MIME type of first media file (e.g., `image/jpeg`) |

**Response (200)**:
```xml
<Response/>
```

**Behavior**: Looks up business by `To` phone, customer by `From` + business. Stores inbound message in `messages` table. Unknown callers (no matching customer) are stored with `customer_id = null`. Duplicate `MessageSid` values are silently ignored. For MMS: each `MediaUrl*` is downloaded to `backend/uploads/messages/` with Twilio Basic auth (async, post-response) and the local paths stored in `messages.media_urls` as JSONB. Files served statically at `/uploads/messages/*`.

**SMS Keyword Handling**: After storing the message, if the sender is a known customer and the body is non-empty, the handler processes single-letter keywords:

| Keyword | Action |
|---------|--------|
| `C` | Confirm current open selection cycle. Auto-replies with confirmation or contextual guidance. |
| `T` | Generate a 7-day tokenized link and text it back: `taskrightpro.com/s/<token>`. Customer taps to review/edit tasks in a browser — no app needed. |
| `D` | Auto-reply that the date change request has been forwarded to the business. |
| `N` | Set `customers.pending_sms_action = 'note_pending'`, prompt for note content. Next SMS from this customer (any content) is saved as `selection_cycles.customer_note` and state is cleared. |
| Other | No auto-reply. Message sits in the business thread as a personal customer service touchpoint for the owner. |

Keyword matching is case-insensitive, whitespace-trimmed. The stateful `note_pending` check runs before keyword matching so a customer's note content is never misread as a keyword.

**Note**: Twilio subaccount webhooks are signed with the subaccount's auth token, which TaskRight does not store. Signature validation is currently skipped. See HANDOFF.md Open Questions for production options.

---

## Communication Endpoints

### Unified Inbox (web portal M4)
**GET** `/businesses/:businessId/messages/inbox`

**Authentication**: Required (Business)

One thread per customer that has any message, with its latest message and unread count, newest first. Unread means an **inbound** message with `read_at` NULL (migration 028, Oct 14, 2026; existing inbound history was backfilled as read). Inbound texts from unknown numbers (`customer_id` NULL) aren't included yet.

**Response (200)**:
```json
{
  "success": true,
  "threads": [
    {
      "customerId": 5,
      "customerName": "Sarah Johnson",
      "phoneNumber": "+14155559876",
      "unreadCount": 2,
      "lastMessage": { "id": 88, "direction": "inbound", "body": "See you then!", "hasMedia": false, "createdAt": "2026-10-14T15:02:11.000Z" }
    }
  ],
  "totalUnread": 2
}
```

### Mark Thread Read (web portal M4)
**POST** `/businesses/:businessId/customers/:customerId/messages/read`

**Authentication**: Required (Business)

Sets `read_at` on the customer's unread inbound messages. It's idempotent and an explicit write (the GET thread endpoint never marks anything read). → `{ success, markedRead }`. `404 CUSTOMER_NOT_FOUND` for another business's customer. The mobile app doesn't call it yet, so reading a thread on the phone doesn't clear web unread badges.

### Get Customer Message Thread
**GET** `/businesses/:businessId/customers/:customerId/messages`

**Authentication**: Required (Business)

**Query Parameters**:
| Param | Default | Description |
|-------|---------|-------------|
| `limit` | 50 | Max messages to return (capped at 100) |
| `before` | — | Message `id` for cursor pagination (returns messages older than this id) |

**Response (200)**:
```json
{
  "success": true,
  "messages": [
    {
      "id": 1,
      "direction": "outbound",
      "body": "Welcome to ABC Cleaning Co.! Your first service is scheduled for 2026-05-21.",
      "fromPhone": "+14155550100",
      "toPhone": "+14155559876",
      "smsMessageId": "SM123abc",
      "createdAt": "2026-05-14T10:00:00.000Z",
      "mediaUrls": null
    },
    {
      "id": 2,
      "direction": "inbound",
      "body": "Can I reschedule?",
      "fromPhone": "+14155559876",
      "toPhone": "+14155550100",
      "smsMessageId": "SM456def",
      "createdAt": "2026-05-14T10:05:00.000Z",
      "mediaUrls": null
    },
    {
      "id": 3,
      "direction": "inbound",
      "body": "",
      "fromPhone": "+14155559876",
      "toPhone": "+14155550100",
      "smsMessageId": "MM789ghi",
      "createdAt": "2026-05-14T10:10:00.000Z",
      "mediaUrls": ["/uploads/messages/MM789ghi_0.jpeg"]
    }
  ],
  "pagination": {
    "hasMore": false,
    "nextCursor": null
  }
}
```

Messages are returned oldest-first (ready for chat thread display). To page backward, pass `before=<lowest id from previous response>`.

**Error Responses**:
- `401` — Unauthorized
- `403` — Business token doesn't match `:businessId`
- `404` — Customer not found or doesn't belong to this business
- `500` — `INTERNAL_ERROR`

---

### Send Manual SMS to Customer
**POST** `/businesses/:businessId/customers/:customerId/messages`

**Authentication**: Required (Business)

**Request Body**:
```json
{
  "body": "Hi Sarah, just a heads up we're running 15 minutes late today."
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": {
    "id": 42,
    "direction": "outbound",
    "body": "Hi Sarah, just a heads up we're running 15 minutes late today.",
    "fromPhone": "+14155550100",
    "toPhone": "+14155559876",
    "smsMessageId": "SMabc123",
    "createdAt": "2026-05-14T15:30:00.000Z",
    "mediaUrls": null
  }
}
```

**Behavior**: Sends the SMS through the business's provider (`getProvider('send')`) and logs it to the `messages` table. In dev mode (no provider credentials), it logs to the console and inserts with `smsMessageId: null`. Returns the inserted message row so the UI can append it without refetching.

**Fixed Oct 14, 2026:** this route read `req.business`, which no middleware sets, so **every send crashed** with a generic 500. It now loads the business row itself.

**Error Responses**:
- `400` — `VALIDATION_ERROR` — Body is empty
- `401` — Unauthorized
- `404` — `CUSTOMER_NOT_FOUND`
- `502` — `SMS_SEND_FAILED` — the provider rejected the send (e.g. Twilio 21211 invalid recipient). `error` carries the provider's reason; nothing is logged.
- `500` — `INTERNAL_ERROR`

---

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `DUPLICATE_PHONE` | 409 | Phone number already registered |
| `DUPLICATE_CUSTOMER` | 409 | Customer already exists |
| `BUSINESS_NOT_FOUND` | 404 | Business doesn't exist |
| `CUSTOMER_NOT_FOUND` | 404 | Customer doesn't exist |
| `CYCLE_NOT_FOUND` | 404 | Service cycle doesn't exist |
| `TASK_NOT_FOUND` | 404 | Task doesn't exist |
| `UNAUTHORIZED` | 401 | Authentication required or invalid token |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `INTERNAL_ERROR` | 500 | Server error |
| `INVALID_OTP` | 400 | OTP code incorrect, expired, or already used |
| `RATE_LIMITED` | 429 | Too many OTP send attempts for this phone |
| `INVALID_JOIN_CODE` | 404 | No business found with this join code |
| `INVALID_TOKEN` | 404 | Task selection token not found or expired |
| `INVALID_TASKS` | 400 | One or more task IDs not available for the selection cycle |

---

## Rate Limiting

Currently no rate limiting enforced. Plan to implement:
- 100 requests/minute per IP
- 1000 requests/hour per authenticated user

---

## Pagination

The `/messages` endpoint uses **cursor pagination**: pass `before=<message id>` to page backward through the thread. All other list endpoints are unpaginated — deferred to Phase 2.

---

## WebSocket / Real-Time

Not yet implemented. Cron jobs handle scheduling (SMS reminders, auto-repeat selections). SMS communication goes via Twilio webhooks — see Webhook Endpoints above.

---

## Database Schema

See `SPEC.md` for full database schema. Migrations 001–019 cover the full schema including:
- **013** `messages` table (SMS communication history) + 4 Twilio provisioning columns on `businesses`
- **014** `join_code` on `businesses` (stable 6-char customer invite code)
- **015** `pending_sms_action` on `customers`; `customer_note`, `selection_token`, `selection_token_expires_at` on `selection_cycles`
- **016** A2P 10DLC registration columns on `businesses`
- **017** job costing: `cost_categories` (+ GAAP seed 4000/5000/5100/5200), `job_costs`; `team_members.hourly_rate`, `customers.lat/lng/geocoded_at`, `customer_cycle_assignments.price_per_visit`, `selection_cycles.price`
- **018** `geofence_events` (lat/lng nullable for manual clock-in/out)
- **019** job-costing integrity: `job_costs.source` (`auto|manual`); open-cycle `price` backfill; partial unique index on labor rows (Rule 6); recompute/aggregate indexes; `cost_categories` scope-unique indexes; FK ON DELETE (job_costs → CASCADE/SET NULL, geofence_events → CASCADE)
