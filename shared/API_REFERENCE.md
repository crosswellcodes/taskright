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
  "phoneNumber": "+14155551234"
}
```

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
  "phoneNumber": "+14155559876"
}
```

#### Get All Customers
**GET** `/businesses/:businessId/customers`

#### Get Customer Details
**GET** `/businesses/:businessId/customers/:customerId`

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
Each entry includes `hourlyRate` (number or null) alongside `weeklyHours`, `groups`, etc.

#### Update Team Member
**PUT** `/businesses/:businessId/team-members/:memberId`

**Request Body** (all fields optional): `{ name, phoneNumber, weeklyHours, hourlyRate }`
`hourlyRate` (non-negative number, nullable — send `null`/`""` to clear) feeds job-costing labor: the labor line is auto-computed on a **geofence departure** as `amount = hoursActual × hourlyRate` (0.00 if the rate is null at that time). Setting the rate applies to labor computed after it's set; existing per-job labor can be adjusted on the Service Call detail screen. Returned as `teamMember.hourlyRate` (number or null).

**Team job resolution (2026-07-14, `TEAM_LABOR_COSTING.md` — no new endpoints):** the member-facing job views (`GET /api/team-members/:teamMemberId/jobs`, `/jobs/:selectionCycleId`, `PATCH .../complete`, `POST .../geofence`) now resolve a Call assigned to a **team** for every member of that team, not just individually-assigned members. `GET .../jobs` therefore includes group jobs and each row carries `isTeamAssigned` (bool) + `teamName` (nullable). Each group member records their own geofence → their own per-member labor line at their own rate, so a team-assigned Call's `laborLines`/profitability populate like an individual job's. Completion is first-to-complete-wins: a later member's `complete` returns `409 ALREADY_COMPLETED` (benign — the client treats it as "a teammate already completed this").

#### Delete Team Member
**DELETE** `/businesses/:businessId/team-members/:memberId`

---

### Team Groups

#### Create Group
**POST** `/businesses/:businessId/groups`

**Request Body**:
```json
{
  "name": "Team A",
  "memberIds": [1, 2, 3]
}
```

**Response (201)**:
```json
{
  "success": true,
  "group": {
    "id": 25,
    "businessId": 1,
    "name": "Team A",
    "members": [
      { "id": 1, "name": "John Smith" },
      { "id": 2, "name": "Jane Doe" }
    ]
  }
}
```

---

### Service Assignments

#### Assign Staff to Cycle
**PUT** `/businesses/:businessId/assignments/:selectionCycleId`

**Request Body**:
```json
{
  "teamMemberId": 1,  // OR
  "teamId": 25
}
```

**Response (200)**:
```json
{
  "success": true,
  "assignment": {
    "id": 99,
    "selectionCycleId": 10,
    "teamMemberId": 1,
    "teamId": null
  }
}
```

#### Delete Assignment
**DELETE** `/businesses/:businessId/assignments/:selectionCycleId`

---

### Selections & Feedback (Business View)

#### Get All Selections
**GET** `/businesses/:businessId/selections`

**Response (200)**:
```json
{
  "success": true,
  "selections": [
    {
      "customerId": 5,
      "customerName": "Sarah Johnson",
      "cycleId": 10,
      "selectedTasks": [1, 2],
      "selectedTotalHours": 1.5,
      "submittedAt": "2026-03-16T14:30:00Z"
    }
  ]
}
```

#### Mark Service Complete
**POST** `/businesses/:businessId/customers/:customerId/mark-service-complete`

**Request Body**:
```json
{
  "selectionCycleId": 10,
  "completedAt": "2026-03-24T11:00:00Z"
}
```

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
    "marginPercent": 40
  }
}
```
`estimatedHours` (Rule 7) = Σ `tasks.time_allotment_minutes` for the selected tasks ÷ 60, computed at query time. When `price` is null, `marginDollars`/`marginPercent` are `null` (Rule 3 — UI shows "Price not set"). `source` is `"auto"` (geofence-tracked) or `"manual"` (owner-corrected). `materialsCostId`/`overheadCostId` are the single v1 line's id (or `null` when none) so the per-job UI can drive a single editable field — POST when null, PATCH the existing line otherwise (added 2026-07-05 for the ServiceCallDetailScreen costing UI).

#### Add Cost Line (manual)
**POST** `/businesses/:businessId/jobs/:selectionCycleId/costs`

Body: `{ costCategoryId, amount, teamMemberId?, hoursActual? }`. Always stamps `source='manual'`. Labor-type categories **require** `teamMemberId` + `hoursActual`; non-labor categories must omit them (400 otherwise). Duplicate labor line for the same member+job → 409 (Rule 6). Response (201): `{ success, data }`.

#### Update Cost Line
**PATCH** `/businesses/:businessId/jobs/:selectionCycleId/costs/:costId`

Body: `{ amount?, hoursActual? }` (at least one). Marks the row `source='manual'` so a later geofence recompute won't overwrite it (D1). Response: `{ success, data }`.

#### Delete Cost Line
**DELETE** `/businesses/:businessId/jobs/:selectionCycleId/costs/:costId` → `{ success }`.

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
      "twilioMessageSid": "SM123abc",
      "createdAt": "2026-05-14T10:00:00.000Z"
    },
    {
      "id": 2,
      "direction": "inbound",
      "body": "Can I reschedule?",
      "fromPhone": "+14155559876",
      "toPhone": "+14155550100",
      "twilioMessageSid": "SM456def",
      "createdAt": "2026-05-14T10:05:00.000Z",
      "mediaUrls": null
    },
    {
      "id": 3,
      "direction": "inbound",
      "body": "",
      "fromPhone": "+14155559876",
      "toPhone": "+14155550100",
      "twilioMessageSid": "MM789ghi",
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
    "twilioMessageSid": "SMabc123",
    "createdAt": "2026-05-14T15:30:00.000Z"
  }
}
```

**Behavior**: Sends SMS via the business's dedicated Twilio Messaging Service and logs the message to the `messages` table. In dev mode (no Twilio credentials), logs to console and inserts with `twilioMessageSid: null`. Returns the inserted message row so the mobile UI can append it to the thread without refetching.

**Error Responses**:
- `400` — `VALIDATION_ERROR` — Body is empty
- `401` — Unauthorized
- `404` — `CUSTOMER_NOT_FOUND`
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
