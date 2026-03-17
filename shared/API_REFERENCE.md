# TaskRight API Reference

## Overview

The TaskRight backend is a Node.js/Express API server with PostgreSQL 18 database. It provides endpoints for:
- **Businesses** (service providers): manage tasks, service cycles, staff, customers
- **Customers**: view services, select tasks, submit selections, leave feedback

### Base URL
- **Development**: `http://localhost:3000/api`
- **Production**: `https://api.taskright.com/api` (example)

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

### Business Signup
**POST** `/auth/businesses/signup`

**Request Body**:
```json
{
  "name": "ABC Cleaning Co.",
  "phoneNumber": "+14155551234"
}
```

**Response (201)**:
```json
{
  "success": true,
  "business": {
    "id": 1,
    "name": "ABC Cleaning Co.",
    "phoneNumber": "+14155551234",
    "createdAt": "2026-03-16T12:00:00Z"
  },
  "token": "eyJhbGc...",
  "expiresIn": 86400
}
```

**Error Responses**:
- `400` — `VALIDATION_ERROR` — Invalid input
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

### Customer Signup
**POST** `/auth/customers/signup`

**Request Body**:
```json
{
  "phoneNumber": "+14155559876",
  "businessId": 1
}
```

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

#### Create Task
**POST** `/businesses/:businessId/tasks`

**Authentication**: Required (Business)

**Request Body**:
```json
{
  "name": "Bathroom cleaning",
  "description": "Clean bathroom including toilet, sink, shower",
  "timeAllotmentMinutes": 45
}
```

**Response (201)**:
```json
{
  "success": true,
  "task": {
    "id": 1,
    "businessId": 1,
    "name": "Bathroom cleaning",
    "description": "...",
    "timeAllotmentMinutes": 45,
    "createdAt": "2026-03-16T12:00:00Z"
  }
}
```

#### Get All Tasks
**GET** `/businesses/:businessId/tasks`

**Response (200)**:
```json
{
  "success": true,
  "tasks": [ /* array of task objects */ ]
}
```

#### Update Task
**PUT** `/businesses/:businessId/tasks/:taskId`

**Request Body**: (same as create)

#### Delete Task
**DELETE** `/businesses/:businessId/tasks/:taskId`

**Response (200)**:
```json
{
  "success": true,
  "message": "Task deleted"
}
```

---

### Service Cycles

#### Create Service Cycle
**POST** `/businesses/:businessId/service-cycles`

**Request Body**:
```json
{
  "serviceDate": "2026-03-24T09:00:00Z",
  "submissionDeadline": "2026-03-23T18:00:00Z",
  "taskIds": [1, 2, 3],
  "customerIds": [5, 6, 7]
}
```

**Response (201)**:
```json
{
  "success": true,
  "cycle": {
    "id": 10,
    "businessId": 1,
    "serviceDate": "2026-03-24T09:00:00Z",
    "submissionDeadline": "2026-03-23T18:00:00Z",
    "status": "open",
    "createdAt": "2026-03-16T12:00:00Z"
  }
}
```

#### Get All Service Cycles
**GET** `/businesses/:businessId/service-cycles`

#### Update Service Cycle
**PUT** `/businesses/:businessId/service-cycles/:cycleId`

#### Delete Service Cycle
**DELETE** `/businesses/:businessId/service-cycles/:cycleId`

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

#### Assign Cycle to Customer
**POST** `/businesses/:businessId/customers/:customerId/assign-cycle`

**Request Body**:
```json
{
  "cycleId": 10
}
```

---

### Team Members

#### Create Team Member
**POST** `/businesses/:businessId/team-members`

**Request Body**:
```json
{
  "name": "John Smith",
  "phoneNumber": "+14155551111"
}
```

#### Get All Team Members
**GET** `/businesses/:businessId/team-members`

#### Update Team Member
**PUT** `/businesses/:businessId/team-members/:memberId`

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

---

## Rate Limiting

Currently no rate limiting enforced. Plan to implement:
- 100 requests/minute per IP
- 1000 requests/hour per authenticated user

---

## Pagination

Not yet implemented. Future: use `?page=1&limit=20` for list endpoints.

---

## WebSocket / Real-Time

Not yet implemented. Cron jobs handle scheduling (SMS reminders, auto-repeat selections).

---

## Database Schema

See `SPEC.md` for full database schema (9 tables: businesses, customers, tasks, service_cycles, selections, service_completions, feedback, team_members, team_memberships).
