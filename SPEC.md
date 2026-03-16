# Task App: Comprehensive Technical Specification

**Version:** 1.0  
**Last Updated:** March 9, 2026  
**Status:** Ready for Implementation  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Solution Overview](#solution-overview)
4. [Tech Stack](#tech-stack)
5. [Database Schema](#database-schema)
6. [API Specification](#api-specification)
7. [Authentication & Authorization](#authentication--authorization)
8. [User Flows](#user-flows)
9. [Error Handling](#error-handling)
10. [System Architecture](#system-architecture)
11. [Development Setup](#development-setup)
12. [Deployment & Scaling](#deployment--scaling)
13. [Future Phases](#future-phases)

---

## Executive Summary

This document defines the complete technical specification for a mobile task management application designed to solve communication gaps in the service labor market (house cleaning, lawn services, exterior home services, etc.).

**Two-Sided Platform:**
- **Business Owners:** Manage customers, define service offerings, track selections, and schedule work
- **Customers:** Receive service options, select preferred tasks, and confirm scheduling

**MVP Scope:**
- iOS mobile app (React Native)
- Node.js/Express backend
- PostgreSQL database
- SMS notifications (Twilio)
- Local development with zero infrastructure costs
- Scalable architecture for growth (10 → 100+ businesses)

---

## Problem Statement

### Current Market Gap

Service businesses (cleaning, lawn care, etc.) face a critical pain point:

**The Challenge:**
- Customer needs and preferences change over time
- Keeping up requires consistent, time-intensive communication
- Result: Services don't meet customer needs, business wastes time on misaligned work
- Customers feel unheard; businesses feel inefficient

### Current Manual Process

Today, businesses manage this through:
- Phone calls (time-consuming)
- Email chains (unclear)
- Text messages (disorganized)
- Spreadsheets (disconnected from service delivery)
- Repeated conversations (no institutional memory)

**Impact:**
- 10-30 hours/month per business owner on communication
- High customer churn due to unmet expectations
- Missed optimization opportunities

---

## Solution Overview

### Core Value Proposition

A mobile-first platform that enables **structured, repeatable service customization** without ongoing manual communication.

**Business Owner Benefits:**
- Define service tasks once, reuse infinitely
- Set customer service scopes (hours, frequency) upfront
- View real-time labor/resource forecasts
- Reduce communication overhead by 80%
- Maintain control over service scope

**Customer Benefits:**
- Simple, intuitive interface (pick tasks, confirm)
- Clear understanding of what to expect
- Historical record of preferences
- SMS reminders (no app fatigue)
- One-step confirmation for repeat services

### How It Works

**Initial Setup:**
1. Business owner signs up, defines tasks (e.g., "Vacuum living room" = 20 mins)
2. Business owner creates service cycles (e.g., "Weekly Cleaning" with weekly frequency)
3. Business owner adds customer and assigns total service hours (e.g., 3 hours for Alice)

**Ongoing Cycle:**
1. System alerts customer 3 days before service: "Time to confirm or change your selections"
2. Customer opens app, sees available tasks, selects from menu (can't exceed 3 hours)
3. Customer submits selections (locked in)
4. Business owner sees forecast: "50 customers, 120 total hours, Task X selected by 35 customers"
5. Service provider completes service, marks complete in app
6. Customer gets SMS: "Service complete! Next service is [date]. Confirm or change by [deadline]."
7. **Cycle repeats**

---

## Tech Stack

### Frontend
- **Framework:** React Native
- **Target Platform:** iOS (MVP)
- **Future:** Android support planned
- **Why:** Fast iteration, code reuse potential, native performance

### Backend
- **Runtime:** Node.js (v20+)
- **Framework:** Express.js
- **Database:** PostgreSQL 18
- **Query Builder:** Knex.js (with migration support)
- **Port:** 3000 (local dev), configurable for production

### Database
- **Engine:** PostgreSQL 18
- **Schema Management:** Knex.js migrations
- **Data Types:** JSONB for flexible fields (selected_tasks, total_hour_options)
- **Relationships:** Foreign keys with CASCADE delete for data integrity

### Notifications
- **SMS:** Twilio (pay-as-you-go, ~$0.01 per SMS)
- **Push:** Firebase (Phase 2)
- **Scheduling:** Node.js cron jobs for automated reminders

### Hosting & Infrastructure
- **Local Dev:** Mac (PostgreSQL + Node.js running locally)
- **MVP Deployment:** Heroku ($50-150/month)
- **Scale Deployment:** AWS (future, cost-optimized)
- **Version Control:** Git (GitHub/GitLab)

### Authentication
- **Method:** JWT (JSON Web Tokens)
- **Library:** jsonwebtoken (npm)
- **Storage:** Token stored in app memory/secure storage (iOS)
- **Expiration:** 24 hours (refreshable)

---

## Database Schema

### Overview

The database is designed with **9 core tables** plus 2 Knex system tables for migration tracking.

**Key Principles:**
- Normalized structure (reduces redundancy)
- Foreign key relationships (maintains data integrity)
- Timestamps on all tables (audit trail)
- JSONB fields for flexible data (selected_tasks array, hour options)
- CASCADE delete (clean data when parent deleted)

---

### Table Definitions

#### **1. Businesses**

Stores business owner profiles.

```sql
CREATE TABLE businesses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `id`: Auto-incrementing unique identifier
- `name`: Business name (e.g., "CleanCo Cleaning")
- `phone_number`: Business owner's phone (used for login)
- `created_at`: When account was created
- `updated_at`: Last modification timestamp

**Example Row:**
```json
{
  "id": 1,
  "name": "CleanCo Cleaning",
  "phone_number": "+1234567890",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

---

#### **2. Customers**

Stores customer profiles linked to businesses.

```sql
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
```

**Fields:**
- `id`: Auto-incrementing unique identifier
- `business_id`: Links to parent business (foreign key)
- `name`: Customer name (e.g., "Alice Smith")
- `phone_number`: Customer's phone (for SMS notifications)
- `created_at`: When customer was added
- `updated_at`: Last modification timestamp

**Relationship:** One business has many customers. If business deleted, all customers deleted (CASCADE).

**Example Row:**
```json
{
  "id": 1,
  "business_id": 1,
  "name": "Alice Smith",
  "phone_number": "+1111111111",
  "created_at": "2026-01-15T11:00:00Z",
  "updated_at": "2026-01-15T11:00:00Z"
}
```

---

#### **3. ServiceCycles**

Defines service frequency templates (weekly, monthly, etc.).

```sql
CREATE TABLE service_cycles (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  days_before_service_deadline INTEGER NOT NULL,
  days_before_auto_repeat INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
```

**Fields:**
- `id`: Auto-incrementing unique identifier
- `business_id`: Links to business that created this cycle
- `name`: Cycle name (e.g., "Weekly Cleaning")
- `frequency`: "weekly", "monthly", or "yearly"
- `days_before_service_deadline`: How many days before service should customer be asked? (e.g., 3)
- `days_before_auto_repeat`: How many days until auto-repeat if not submitted? (e.g., 1)
- `created_at`: When cycle was created
- `updated_at`: Last modification timestamp

**Business Logic:**
- Service date: Jan 20
- Submission deadline: Jan 17 (3 days before)
- Auto-repeat deadline: Jan 25 (1 day before)

**Example Row:**
```json
{
  "id": 1,
  "business_id": 1,
  "name": "Weekly Cleaning",
  "frequency": "weekly",
  "days_before_service_deadline": 3,
  "days_before_auto_repeat": 1,
  "created_at": "2026-01-15T11:05:00Z",
  "updated_at": "2026-01-15T11:05:00Z"
}
```

---

#### **4. CustomerCycleAssignments**

Links customers to service cycles with fixed service hours.

```sql
CREATE TABLE customer_cycle_assignments (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  service_cycle_id INTEGER NOT NULL,
  total_hours INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_cycle_id) REFERENCES service_cycles(id) ON DELETE CASCADE,
  UNIQUE(customer_id, service_cycle_id)
);
```

**Fields:**
- `id`: Auto-incrementing unique identifier
- `customer_id`: Links to customer
- `service_cycle_id`: Links to service cycle
- `total_hours`: Fixed service hours for this customer (e.g., 3)
- `created_at`: When assignment was created
- `updated_at`: Last modification timestamp

**Constraints:**
- `UNIQUE(customer_id, service_cycle_id)`: A customer can only be assigned to a cycle once

**Business Logic:**
- Business owner decides: "Alice gets 3 hours per weekly cleaning"
- Customer CANNOT change this (prevents scope creep)
- When selecting tasks, customer can't exceed 180 minutes (3 × 60)

**Example Row:**
```json
{
  "id": 1,
  "customer_id": 1,
  "service_cycle_id": 1,
  "total_hours": 3,
  "created_at": "2026-01-15T11:20:00Z",
  "updated_at": "2026-01-15T11:20:00Z"
}
```

---

#### **5. Tasks**

Service tasks defined by business (e.g., "Vacuum living room").

```sql
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  time_allotment_minutes INTEGER NOT NULL,
  is_optional BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
```

**Fields:**
- `id`: Auto-incrementing unique identifier
- `business_id`: Links to business that created this task
- `name`: Task name (e.g., "Vacuum living room")
- `time_allotment_minutes`: How long does this task take? (e.g., 20)
- `is_optional`: Whether customer can skip it (MVP: always true)
- `created_at`: When task was created
- `updated_at`: Last modification timestamp

**Example Row:**
```json
{
  "id": 1,
  "business_id": 1,
  "name": "Vacuum living room",
  "time_allotment_minutes": 20,
  "is_optional": true,
  "created_at": "2026-01-15T11:25:00Z",
  "updated_at": "2026-01-15T11:25:00Z"
}
```

---

#### **6. TaskAssignments**

Links tasks to service cycles (which tasks are available for which cycle).

```sql
CREATE TABLE task_assignments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL,
  service_cycle_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (service_cycle_id) REFERENCES service_cycles(id) ON DELETE CASCADE,
  UNIQUE(task_id, service_cycle_id)
);
```

**Fields:**
- `id`: Auto-incrementing unique identifier
- `task_id`: Links to task
- `service_cycle_id`: Links to service cycle
- `created_at`: When assignment was created

**Business Logic:**
- "Weekly Cleaning" includes: Vacuum (1), Mop (2), Dust (3)
- "Monthly Deep Clean" includes: Vacuum (1), Mop (2), Dust (3), Windows (4), Carpet (5)
- Same task can appear in multiple cycles

**Constraints:**
- `UNIQUE(task_id, service_cycle_id)`: A task can only be assigned to a cycle once

**Example Row:**
```json
{
  "id": 1,
  "task_id": 1,
  "service_cycle_id": 1,
  "created_at": "2026-01-15T11:30:00Z"
}
```

---

#### **7. SelectionCycles**

Represents a specific service occurrence (e.g., "Weekly cleaning for Alice on Jan 20").

```sql
CREATE TABLE selection_cycles (
  id SERIAL PRIMARY KEY,
  service_cycle_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  service_date DATE NOT NULL,
  submission_deadline DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_cycle_id) REFERENCES service_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

**Fields:**
- `id`: Auto-incrementing unique identifier
- `service_cycle_id`: Which service cycle template is this instance of?
- `customer_id`: Which customer?
- `service_date`: When is service scheduled? (e.g., 2026-01-20)
- `submission_deadline`: By when must customer submit? (e.g., 2026-01-17)
- `status`: "open" (waiting), "submitted" (locked), "completed" (done)
- `created_at`: When this cycle instance was created
- `updated_at`: Last modification timestamp

**Business Logic:**
- System automatically generates these based on service_cycles
- One per customer per service date
- Tracks what stage each customer is in

**Example Row:**
```json
{
  "id": 1,
  "service_cycle_id": 1,
  "customer_id": 1,
  "service_date": "2026-01-20",
  "submission_deadline": "2026-01-17",
  "status": "open",
  "created_at": "2026-01-15T12:00:00Z",
  "updated_at": "2026-01-15T12:00:00Z"
}
```

---

#### **8. Selections**

Customer's actual task selections for a specific service date.

```sql
CREATE TABLE selections (
  id SERIAL PRIMARY KEY,
  selection_cycle_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  selected_tasks JSONB NOT NULL,
  selected_total_hours INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (selection_cycle_id) REFERENCES selection_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

**Fields:**
- `id`: Auto-incrementing unique identifier
- `selection_cycle_id`: Which service cycle instance does this belong to?
- `customer_id`: Which customer made this selection?
- `selected_tasks`: JSON array of task IDs (e.g., [1, 3, 5])
- `selected_total_hours`: Which hour option did they pick? (e.g., 3)
- `status`: "draft" (working), "submitted" (locked), "change_requested" (business initiated change order)
- `submitted_at`: When did they submit? (NULL if still drafting)
- `created_at`: When this selection was created
- `updated_at`: Last modification timestamp

**Constraints:**
- Sum of selected tasks' time allotments cannot exceed selected_total_hours × 60 minutes
- Once status="submitted", customer can't edit (except via change order from business)

**Example Row:**
```json
{
  "id": 1,
  "selection_cycle_id": 1,
  "customer_id": 1,
  "selected_tasks": [1, 3, 5],
  "selected_total_hours": 3,
  "status": "submitted",
  "submitted_at": "2026-01-17T09:15:00Z",
  "created_at": "2026-01-15T12:05:00Z",
  "updated_at": "2026-01-17T09:15:00Z"
}
```

---

#### **9. ServiceCompletions**

Records when business marks a service as complete.

```sql
CREATE TABLE service_completions (
  id SERIAL PRIMARY KEY,
  selection_cycle_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  completed_at TIMESTAMP NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (selection_cycle_id) REFERENCES selection_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

**Fields:**
- `id`: Auto-incrementing unique identifier
- `selection_cycle_id`: Which service was completed?
- `customer_id`: Which customer?
- `completed_at`: When was it marked complete?
- `notes`: Optional notes from service provider (e.g., "Extra work done")
- `created_at`: When this completion record was created

**Triggers:**
- When created, sends SMS to customer: "Your service is complete! Next service is [date]..."

**Example Row:**
```json
{
  "id": 1,
  "selection_cycle_id": 1,
  "customer_id": 1,
  "completed_at": "2026-01-20T14:30:00Z",
  "notes": "Extra window cleaning completed",
  "created_at": "2026-01-20T14:35:00Z"
}
```

---

### Database Relationships Diagram

```
Businesses (1)
├─ has many → Customers (many)
│              └─ can have many → SelectionCycles
│                 └─ can have many → Selections
├─ has many → ServiceCycles (many)
│              ├─ linked to → Tasks via TaskAssignments
│              └─ linked to → Customers via CustomerCycleAssignments
├─ has many → Tasks (many)
│
ServiceCompletions (records service completion)
├─ linked to → SelectionCycles
└─ linked to → Customers
```

---

## API Specification

### Overview

The API follows RESTful conventions:
- **POST** = Create new resource
- **GET** = Retrieve resource(s)
- **PUT** = Update resource
- **DELETE** = Delete resource

**Base URL (Development):** `http://localhost:3000`  
**Base URL (Production):** `https://api.taskapp.com` (future)

**Response Format:** JSON  
**Authentication:** JWT token in `Authorization` header

---

### Authentication Flow

#### **POST /api/auth/businesses/signup**

Business owner creates account.

**Request:**
```json
{
  "name": "CleanCo Cleaning",
  "phoneNumber": "+1234567890"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "business": {
    "id": 1,
    "name": "CleanCo Cleaning",
    "phoneNumber": "+1234567890",
    "createdAt": "2026-01-15T10:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

**Error Scenarios:**
- **400 Bad Request** - Missing required fields
  ```json
  {
    "success": false,
    "error": "Name and phone number are required"
  }
  ```

- **409 Conflict** - Phone number already exists
  ```json
  {
    "success": false,
    "error": "Phone number already registered"
  }
  ```

---

#### **POST /api/auth/businesses/login**

Business owner logs in with phone number.

**Request:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "business": {
    "id": 1,
    "name": "CleanCo Cleaning",
    "phoneNumber": "+1234567890"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

**Error Scenarios:**
- **400 Bad Request** - Missing phone number
  ```json
  {
    "success": false,
    "error": "Phone number is required"
  }
  ```

- **404 Not Found** - Business not found
  ```json
  {
    "success": false,
    "error": "Business not found"
  }
  ```

---

#### **POST /api/auth/customers/signup**

Customer creates account.

**Request:**
```json
{
  "phoneNumber": "+1111111111",
  "businessId": 1
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "customer": {
    "id": 1,
    "businessId": 1,
    "phoneNumber": "+1111111111",
    "createdAt": "2026-01-15T11:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

**Error Scenarios:**
- **400 Bad Request** - Missing fields
- **404 Not Found** - Business ID doesn't exist

---

#### **POST /api/auth/customers/login**

Customer logs in with phone number.

**Request:**
```json
{
  "phoneNumber": "+1111111111"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "customer": {
    "id": 1,
    "phoneNumber": "+1111111111",
    "businessId": 1
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

**Error Scenarios:**
- **400 Bad Request** - Missing phone number
- **404 Not Found** - Customer not found

---

### Business Owner Endpoints

#### **POST /api/businesses/:businessId/tasks**

Create a new task.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Vacuum living room",
  "timeAllotmentMinutes": 20
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "task": {
    "id": 1,
    "businessId": 1,
    "name": "Vacuum living room",
    "timeAllotmentMinutes": 20,
    "isOptional": true,
    "createdAt": "2026-01-15T11:35:00Z"
  }
}
```

**Error Scenarios:**
- **400 Bad Request** - Missing name or timeAllotmentMinutes
- **401 Unauthorized** - Invalid or missing token
- **403 Forbidden** - Token belongs to different business

---

#### **GET /api/businesses/:businessId/tasks**

Get all tasks for a business.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "tasks": [
    {
      "id": 1,
      "name": "Vacuum living room",
      "timeAllotmentMinutes": 20,
      "isOptional": true
    },
    {
      "id": 2,
      "name": "Mop kitchen",
      "timeAllotmentMinutes": 30,
      "isOptional": true
    },
    {
      "id": 3,
      "name": "Dust surfaces",
      "timeAllotmentMinutes": 25,
      "isOptional": true
    }
  ],
  "total": 3
}
```

**Error Scenarios:**
- **401 Unauthorized** - Invalid or missing token
- **404 Not Found** - Business not found

---

#### **PUT /api/businesses/:businessId/tasks/:taskId**

Update a task.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Vacuum living room + hallway",
  "timeAllotmentMinutes": 25
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "task": {
    "id": 1,
    "name": "Vacuum living room + hallway",
    "timeAllotmentMinutes": 25,
    "updatedAt": "2026-01-15T11:40:00Z"
  }
}
```

**Error Scenarios:**
- **400 Bad Request** - Invalid data
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Task not found

---

#### **DELETE /api/businesses/:businessId/tasks/:taskId**

Delete a task.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

**Error Scenarios:**
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Task not found
- **409 Conflict** - Task is assigned to active service cycles (must unassign first)

---

#### **POST /api/businesses/:businessId/service-cycles**

Create a service cycle.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Weekly Cleaning",
  "frequency": "weekly",
  "daysBeforeServiceDeadline": 3,
  "daysBeforeAutoRepeat": 1,
  "taskIds": [1, 2, 3]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "serviceCycle": {
    "id": 1,
    "businessId": 1,
    "name": "Weekly Cleaning",
    "frequency": "weekly",
    "daysBeforeServiceDeadline": 3,
    "daysBeforeAutoRepeat": 1,
    "assignedTasks": [
      { "id": 1, "name": "Vacuum living room", "timeAllotmentMinutes": 20 },
      { "id": 2, "name": "Mop kitchen", "timeAllotmentMinutes": 30 },
      { "id": 3, "name": "Dust surfaces", "timeAllotmentMinutes": 25 }
    ],
    "createdAt": "2026-01-15T11:45:00Z"
  }
}
```

**Error Scenarios:**
- **400 Bad Request** - Missing required fields or invalid frequency
- **401 Unauthorized** - Invalid token
- **404 Not Found** - One or more task IDs don't exist

---

#### **GET /api/businesses/:businessId/service-cycles**

Get all service cycles for a business.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "serviceCycles": [
    {
      "id": 1,
      "name": "Weekly Cleaning",
      "frequency": "weekly",
      "assignedTasks": [1, 2, 3],
      "daysBeforeServiceDeadline": 3,
      "daysBeforeAutoRepeat": 1,
      "createdAt": "2026-01-15T11:45:00Z"
    },
    {
      "id": 2,
      "name": "Monthly Deep Clean",
      "frequency": "monthly",
      "assignedTasks": [1, 2, 3, 4, 5],
      "daysBeforeServiceDeadline": 7,
      "daysBeforeAutoRepeat": 1,
      "createdAt": "2026-01-15T12:00:00Z"
    }
  ],
  "total": 2
}
```

**Error Scenarios:**
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Business not found

---

#### **PUT /api/businesses/:businessId/service-cycles/:cycleId**

Update a service cycle.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Weekly Cleaning (Updated)",
  "taskIds": [1, 2, 4]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "serviceCycle": {
    "id": 1,
    "name": "Weekly Cleaning (Updated)",
    "assignedTasks": [1, 2, 4],
    "updatedAt": "2026-01-15T12:05:00Z"
  }
}
```

**Error Scenarios:**
- **400 Bad Request** - Invalid data
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Service cycle not found

---

#### **POST /api/businesses/:businessId/customers**

Add a new customer.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Alice Smith",
  "phoneNumber": "+1111111111"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "customer": {
    "id": 1,
    "businessId": 1,
    "name": "Alice Smith",
    "phoneNumber": "+1111111111",
    "createdAt": "2026-01-15T11:50:00Z"
  }
}
```

**Error Scenarios:**
- **400 Bad Request** - Missing name or phone number
- **401 Unauthorized** - Invalid token
- **409 Conflict** - Customer with this phone already exists for this business

---

#### **GET /api/businesses/:businessId/customers**

Get all customers for a business.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "customers": [
    {
      "id": 1,
      "name": "Alice Smith",
      "phoneNumber": "+1111111111",
      "assignedCycles": [
        {
          "id": 1,
          "name": "Weekly Cleaning",
          "frequency": "weekly",
          "totalHours": 3
        }
      ]
    },
    {
      "id": 2,
      "name": "Bob Johnson",
      "phoneNumber": "+2222222222",
      "assignedCycles": [
        {
          "id": 1,
          "name": "Weekly Cleaning",
          "frequency": "weekly",
          "totalHours": 4
        },
        {
          "id": 2,
          "name": "Monthly Deep Clean",
          "frequency": "monthly",
          "totalHours": 5
        }
      ]
    }
  ],
  "total": 2
}
```

**Error Scenarios:**
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Business not found

---

#### **GET /api/businesses/:businessId/customers/:customerId**

Get details for one customer.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "customer": {
    "id": 1,
    "name": "Alice Smith",
    "phoneNumber": "+1111111111",
    "assignedCycles": [
      {
        "id": 1,
        "name": "Weekly Cleaning",
        "frequency": "weekly",
        "totalHours": 3
      }
    ],
    "upcomingServices": [
      {
        "id": 1,
        "serviceCycleName": "Weekly Cleaning",
        "serviceDate": "2026-01-20",
        "submissionDeadline": "2026-01-17",
        "status": "open"
      },
      {
        "id": 2,
        "serviceCycleName": "Weekly Cleaning",
        "serviceDate": "2026-01-27",
        "submissionDeadline": "2026-01-24",
        "status": "open"
      }
    ],
    "lastSelection": {
      "selectedTasks": [1, 2, 3],
      "selectedTotalHours": 3,
      "submittedAt": "2026-01-10T09:15:00Z"
    }
  }
}
```

**Error Scenarios:**
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Customer not found

---

#### **POST /api/businesses/:businessId/customers/:customerId/assign-cycle**

Assign a customer to a service cycle with fixed hours.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "serviceCycleId": 1,
  "totalHours": 3
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "assignment": {
    "id": 1,
    "customerId": 1,
    "serviceCycleId": 1,
    "totalHours": 3,
    "createdAt": "2026-01-15T11:55:00Z"
  },
  "message": "Customer assigned to service cycle. Invitation SMS sent."
}
```

**Side Effects:**
- Generates upcoming SelectionCycle rows for next N service dates
- Sends SMS to customer: "Welcome to [Business Name]! Tap here to set up your account..."

**Error Scenarios:**
- **400 Bad Request** - Missing required fields
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Customer or service cycle not found
- **409 Conflict** - Customer already assigned to this cycle

---

#### **GET /api/businesses/:businessId/customers/:customerId/selections/upcoming**

Get customer's current selection (what they need to submit next).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "selection": {
    "selectionCycleId": 1,
    "customerId": 1,
    "serviceCycleName": "Weekly Cleaning",
    "serviceDate": "2026-01-20",
    "submissionDeadline": "2026-01-17",
    "status": "open",
    "availableTasks": [
      {
        "id": 1,
        "name": "Vacuum living room",
        "timeAllotmentMinutes": 20
      },
      {
        "id": 2,
        "name": "Mop kitchen",
        "timeAllotmentMinutes": 30
      },
      {
        "id": 3,
        "name": "Dust surfaces",
        "timeAllotmentMinutes": 25
      }
    ],
    "totalHours": 3,
    "currentSelection": null
  }
}
```

**Error Scenarios:**
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Customer not found or no upcoming service

---

#### **GET /api/businesses/:businessId/selections**

Get wholistic view of all customer selections (forecasting view).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "summary": {
    "totalCustomers": 50,
    "upcomingServices": [
      {
        "serviceDate": "2026-01-20",
        "serviceCycleName": "Weekly Cleaning",
        "customerSelectionsStatus": {
          "submitted": 35,
          "pending": 15
        },
        "totalHoursForecast": 120,
        "averageHoursPerCustomer": 3.4,
        "tasks": [
          {
            "taskId": 1,
            "taskName": "Vacuum living room",
            "selectedByCustomers": 28,
            "totalTimeRequired": 560
          },
          {
            "taskId": 2,
            "taskName": "Mop kitchen",
            "selectedByCustomers": 32,
            "totalTimeRequired": 960
          },
          {
            "taskId": 3,
            "taskName": "Dust surfaces",
            "selectedByCustomers": 25,
            "totalTimeRequired": 625
          }
        ]
      },
      {
        "serviceDate": "2026-01-27",
        "serviceCycleName": "Weekly Cleaning",
        "customerSelectionsStatus": {
          "submitted": 0,
          "pending": 50
        },
        "totalHoursForecast": null,
        "averageHoursPerCustomer": null,
        "tasks": []
      }
    ]
  }
}
```

**Business Logic:**
- Shows forecast for next 30 days
- Calculates total hours needed
- Shows which tasks are most/least selected
- Helps with labor planning and material purchases

**Error Scenarios:**
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Business not found

---

#### **POST /api/businesses/:businessId/customers/:customerId/mark-service-complete**

Mark a service as complete and notify customer.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "selectionCycleId": 1,
  "notes": "Extra window cleaning completed as requested"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Service marked complete. Customer notified via SMS.",
  "serviceCompletion": {
    "id": 1,
    "customerId": 1,
    "selectionCycleId": 1,
    "completedAt": "2026-01-20T14:30:00Z",
    "notes": "Extra window cleaning completed as requested"
  }
}
```

**Side Effects:**
- Creates ServiceCompletions record
- Sends SMS to customer: "Your Weekly Cleaning service is complete! Your next service is Jan 27. Confirm or change your selections by Jan 24."
- Updates SelectionCycle status to "completed"

**Error Scenarios:**
- **400 Bad Request** - Missing selectionCycleId
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Service not found

---

### Customer Endpoints

#### **GET /api/customers/:customerId/selection-cycle/current**

Get current selection screen (task list + hour options).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "selectionCycle": {
    "id": 1,
    "serviceCycleName": "Weekly Cleaning",
    "serviceDate": "2026-01-20",
    "submissionDeadline": "2026-01-17",
    "status": "open",
    "totalHours": 3,
    "totalMinutesAvailable": 180,
    "availableTasks": [
      {
        "id": 1,
        "name": "Vacuum living room",
        "timeAllotmentMinutes": 20
      },
      {
        "id": 2,
        "name": "Mop kitchen",
        "timeAllotmentMinutes": 30
      },
      {
        "id": 3,
        "name": "Dust surfaces",
        "timeAllotmentMinutes": 25
      }
    ],
    "previousSelection": {
      "selectedTasks": [1, 2],
      "selectedTotalHours": 3,
      "submittedAt": "2026-01-10T09:15:00Z"
    }
  }
}
```

**Error Scenarios:**
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Customer not found or no upcoming selection

---

#### **POST /api/customers/:customerId/selection-cycle/:selectionCycleId/submit**

Submit customer's task selections.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "selectedTotalHours": 3,
  "selectedTasks": [1, 2, 3]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "selection": {
    "id": 1,
    "selectionCycleId": 1,
    "customerId": 1,
    "selectedTasks": [1, 2, 3],
    "selectedTotalHours": 3,
    "status": "submitted",
    "submittedAt": "2026-01-17T09:15:00Z",
    "message": "Selection locked. Your service is scheduled for 2026-01-20."
  }
}
```

**Validation:**
- Sum of selected tasks' time allotments cannot exceed 180 minutes (3 hours × 60)
- All task IDs must exist in available tasks

**Error Scenarios:**
- **400 Bad Request** - Missing required fields or time exceeds limit
  ```json
  {
    "success": false,
    "error": "Total time selected (220 mins) exceeds limit (180 mins)",
    "availableMinutes": 180,
    "selectedMinutes": 220
  }
  ```

- **401 Unauthorized** - Invalid token
- **404 Not Found** - Selection cycle not found
- **409 Conflict** - Selection already submitted
  ```json
  {
    "success": false,
    "error": "Selections already submitted for this service date"
  }
  ```

---

#### **GET /api/customers/:customerId/selection-history**

Get past selections.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "history": [
    {
      "selectionCycleId": 3,
      "serviceDate": "2026-01-20",
      "status": "completed",
      "selectedTasks": [1, 2, 3],
      "selectedTotalHours": 3,
      "submittedAt": "2026-01-17T09:15:00Z"
    },
    {
      "selectionCycleId": 2,
      "serviceDate": "2026-01-13",
      "status": "completed",
      "selectedTasks": [1, 2],
      "selectedTotalHours": 3,
      "submittedAt": "2026-01-10T10:00:00Z"
    },
    {
      "selectionCycleId": 1,
      "serviceDate": "2026-01-06",
      "status": "completed",
      "selectedTasks": [1, 3],
      "selectedTotalHours": 3,
      "submittedAt": "2026-01-03T14:30:00Z"
    }
  ],
  "total": 3
}
```

**Error Scenarios:**
- **401 Unauthorized** - Invalid token
- **404 Not Found** - Customer not found

---

## Authentication & Authorization

### JWT Implementation

**Token Structure:**
```
header.payload.signature
```

**Payload Example:**
```json
{
  "sub": "1",
  "type": "business",
  "businessId": 1,
  "iat": 1673779200,
  "exp": 1673865600
}
```

**Token Expiration:** 24 hours

### Authorization Header

All authenticated requests must include:
```
Authorization: Bearer <token>
```

### Token Refresh Flow (Phase 2)

MVP uses 24-hour tokens. Phase 2 will implement:
- Refresh tokens (7 days)
- Token rotation
- Revocation

### Error Responses

**401 Unauthorized** - Missing or invalid token:
```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "INVALID_TOKEN"
}
```

**403 Forbidden** - Token valid but user lacks permission:
```json
{
  "success": false,
  "error": "Forbidden",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

---

## User Flows

### Customer Flow 1: Initial Setup & First Selection

#### **Step 1: Customer Receives SMS**
```
SMS: "Welcome to CleanCo Cleaning! 
Tap here to set up your account: [link to app]"
```

**Backend Action:**
- Business owner calls POST /api/businesses/:businessId/customers/:customerId/assign-cycle
- System generates first SelectionCycle
- Twilio sends SMS

---

#### **Step 2: Customer Opens App & Signs Up**

**Screen: Phone Verification**
```
Enter your phone: +1 [111] [111] [1111]
[ Get Started ]
```

**Backend:**
- Customer calls POST /api/auth/customers/signup
- Backend returns JWT token

---

#### **Step 3: Customer Sees Service Info**

**Screen: Current Service Info**
```
Weekly Cleaning
Service: Jan 20, 2026

Your Service: 3 hours (fixed)

Select Tasks:
(up to 180 minutes)
[ Continue ]
```

**Backend:**
- Customer calls GET /api/customers/:customerId/selection-cycle/current
- Returns tasks + previous selection for reference

---

#### **Step 4: Customer Selects Tasks**

**Screen: Task Selection**
```
Weekly Cleaning
3 hours selected

Available Services:
☑ Vacuum living room (20 mins)
☑ Mop kitchen (30 mins)
☐ Dust surfaces (25 mins)

Time used: 50/180 min

[ Submit Selection ]
```

**Validation (Client-side):**
- Sum of selected tasks ≤ 180 minutes
- Prevent selection if would exceed time

---

#### **Step 5: Customer Confirms & Submits**

**Screen: Confirmation**
```
Confirm Your Choices

Service Date: January 20, 2026
Total Hours: 3
Tasks:
• Vacuum living room
• Mop kitchen

[ Confirm ]  [ Change ]
```

**Backend:**
- Customer calls POST /api/customers/:customerId/selection-cycle/:selectionCycleId/submit
- System creates Selections record with status="submitted"
- Selections locked until next cycle

---

#### **Step 6: Success Confirmation**

**Screen: Success**
```
✓ Selection Complete!

Your service for Jan 20 is confirmed.
You can change your selections until
Jan 19 at 11:59 PM

[ Back to Home ]
```

---

### Customer Flow 2: Service Completion Notification

#### **Step 1: Service Completed**

**Backend (Business Owner Action):**
- Service provider calls POST /api/businesses/:businessId/customers/:customerId/mark-service-complete
- System creates ServiceCompletions record
- Triggers SMS via Twilio

---

#### **Step 2: Customer Receives SMS**

```
SMS: "Your Weekly Cleaning service is complete! 
Your next service is Jan 27. 
Confirm or change your selections by Jan 24.
[Tap to open app]"
```

---

#### **Step 3: Customer Confirms or Changes**

**Screen: Next Selection (same as Flow 1, Step 3)**
```
Weekly Cleaning
Service: Jan 27, 2026

Your Service: 3 hours (fixed)

Your last selection:
3 hours, Vacuum + Mop

[ Confirm Again ]
[ Change ]
```

**If Confirm Again:**
- Calls POST /api/customers/:customerId/selection-cycle/:selectionCycleId/submit
- Pre-fills with previous selection
- Auto-repeats in one click

**If Change:**
- Shows task selection screen
- Customer picks different tasks

---

### Business Owner Flow 1: Initial Setup

#### **Step 1: Creates Account**

**Screen: Sign Up**
```
Welcome!
Set up your account

Business Name:
[CleanCo Cleaning____]

Phone Number:
+1 [555] [123] [4567]

[ Create Account ]
```

**Backend:**
- Calls POST /api/auth/businesses/signup

---

#### **Step 2: Defines Tasks**

**Screen: Create Tasks**
```
Define Tasks
(What you offer)

Task Name:
[Vacuum living room__]

Time Needed:
[20] minutes

[ Add Task ]

Your Tasks:
• Vacuum living room (20 mins)
• Mop kitchen (30 mins)
```

**Backend:**
- Each task calls POST /api/businesses/:businessId/tasks

---

#### **Step 3: Defines Service Cycles**

**Screen: Create Service Cycle**
```
Create Service Option

Cycle Name:
[Weekly Cleaning______]

Frequency:
◉ Weekly
☐ Monthly
☐ Yearly

Select Tasks:
☑ Vacuum living room
☑ Mop kitchen
☑ Dust surfaces
☐ Deep clean windows

[ Create Cycle ]
```

**Backend:**
- Calls POST /api/businesses/:businessId/service-cycles

---

#### **Step 4: Adds First Customer**

**Screen: Add Customer**
```
Add a Customer

Customer Name:
[Alice Smith__________]

Phone Number:
+1 [111] [111] [1111]

[ Add Customer ]
```

**Backend:**
- Calls POST /api/businesses/:businessId/customers

---

#### **Step 5: Assigns Customer to Cycle**

**Screen: Set Up Customer Service**
```
Alice Smith
Set up service

Service Type:
◉ Weekly Cleaning
☐ Monthly Deep Clean

Hours per Service:
[3] hours
(Based on your discussion
with customer)

[ Save & Send SMS ]
```

**Backend:**
- Calls POST /api/businesses/:businessId/customers/:customerId/assign-cycle
- System generates SelectionCycles for next 90 days
- Sends SMS to customer

---

### Business Owner Flow 2: Check Forecast

#### **Step 1: View Dashboard**

**Screen: Forecast Dashboard**
```
Dashboard
Week of Jan 20

Services Scheduled:
35 of 50 customers
submitted selections

Total Hours: 115 hours of work
(avg 3.3 hrs/customer)

Most Requested Tasks:
1. Vacuum (28 votes)
2. Mop (25 votes)
3. Dust (20 votes)

[ See Pending (15) ]
[ Detailed View ]
```

**Backend:**
- Calls GET /api/businesses/:businessId/selections
- Returns aggregated data for forecasting

---

#### **Step 2: View Customer Selections**

**Screen: Customer Detail**
```
Alice Smith

Current Service:
Jan 20 (3 days away)
Status: PENDING

Last Selection:
3 hours
• Vacuum living room
• Mop kitchen
• Dust surfaces

[ View Details ]
[ Send Reminder SMS ]
[ Initiate Change Order ]
```

**Backend:**
- Calls GET /api/businesses/:businessId/customers/:customerId

---

### Business Owner Flow 3: Mark Service Complete

#### **Step 1: Complete Service**

**Screen: Service Record**
```
Alice Smith
Service Jan 20

Status: In Progress

Scheduled Tasks:
• Vacuum living room
• Mop kitchen
• Dust surfaces

Notes:
[Customer requested____]
[window cleaning______]

[ Mark Complete ]
```

**Backend:**
- Calls POST /api/businesses/:businessId/customers/:customerId/mark-service-complete
- Sends SMS to customer
- Triggers next cycle

---

### Automated Flow: Daily Cron Jobs

#### **3 Days Before Service (11:59 PM)**

**Action:**
- Query all SelectionCycles where service_date = TODAY + 3 days
- Send SMS to each customer: "Time to confirm your selections for [service date]"
- Update SelectionCycle status to "alert_sent"

**Code Location:** `backend/src/jobs/selection-reminders.js`

---

#### **1 Day Before Service (11:59 PM)**

**Action:**
- Query all SelectionCycles where service_date = TODAY + 1 AND status != "submitted"
- Create Selections row with previousSelection data
- Status = "submitted" (auto-repeated)
- Update SelectionCycle status = "auto_repeated"
- Send SMS: "Your selections have been auto-confirmed for [service date]"

**Code Location:** `backend/src/jobs/auto-repeat.js`

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Data retrieval successful |
| 201 | Created | New resource created |
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | Invalid or missing token |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 500 | Server Error | Unexpected error |

### Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**Example:**

```json
{
  "success": false,
  "error": "Total time selected (220 mins) exceeds limit (180 mins)",
  "code": "TIME_EXCEEDED",
  "details": {
    "limit": 180,
    "selected": 220,
    "excess": 40
  }
}
```

### Common Error Scenarios

#### **Task Time Validation (400 Bad Request)**

**When:** Customer selects tasks exceeding their total hours

```json
{
  "success": false,
  "error": "Selected tasks exceed available time",
  "code": "TIME_EXCEEDED",
  "details": {
    "availableMinutes": 180,
    "selectedMinutes": 220,
    "excessMinutes": 40,
    "selectedTasks": [1, 2, 3, 4]
  }
}
```

---

#### **Authentication (401 Unauthorized)**

**When:** Token is missing, invalid, or expired

```json
{
  "success": false,
  "error": "Unauthorized - invalid token",
  "code": "INVALID_TOKEN"
}
```

---

#### **Already Submitted (409 Conflict)**

**When:** Customer tries to submit selections twice

```json
{
  "success": false,
  "error": "Selections already submitted for this service",
  "code": "ALREADY_SUBMITTED",
  "details": {
    "submittedAt": "2026-01-17T09:15:00Z"
  }
}
```

---

#### **Resource Not Found (404 Not Found)**

**When:** Customer, business, or service doesn't exist

```json
{
  "success": false,
  "error": "Customer not found",
  "code": "CUSTOMER_NOT_FOUND",
  "details": {
    "customerId": 999
  }
}
```

---

#### **Duplicate Phone Number (409 Conflict)**

**When:** Attempting to register with an existing phone

```json
{
  "success": false,
  "error": "Phone number already registered",
  "code": "DUPLICATE_PHONE",
  "details": {
    "phone": "+1234567890"
  }
}
```

---

### Server Error Handling (500)

**When:** Unexpected error occurs

```json
{
  "success": false,
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "details": {}
}
```

**Action:** Log full error to monitoring service (Phase 2: Sentry)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer (iOS)                       │
│                    React Native App                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Customer UI    │    Business Owner UI              │   │
│  │  - Selection    │    - Task Management              │   │
│  │  - History      │    - Cycle Definition             │   │
│  │  - Status       │    - Customer Management          │   │
│  │                 │    - Forecasting Dashboard         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ (HTTP/HTTPS)
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (Node.js/Express)               │
│                    Port 3000 (Dev) / 443 (Prod)             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Authentication Routes   │  Business Routes        │   │
│  │  - /auth/businesses/...  │  - /businesses/:id/...  │   │
│  │  - /auth/customers/...   │  - /customers/:id/...   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware Stack                                   │   │
│  │  - JWT Authentication   - CORS                      │   │
│  │  - Error Handling       - Request Logging           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Service Layer                                      │   │
│  │  - Business Logic       - Validation               │   │
│  │  - Database Queries     - Error Processing         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ (TCP)
┌─────────────────────────────────────────────────────────────┐
│                 Database Layer (PostgreSQL)                 │
│                   Port 5432 (Local/Cloud)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  9 Core Tables + 2 Knex Migration Tables             │   │
│  │  - Businesses           - SelectionCycles           │   │
│  │  - Customers            - Selections                │   │
│  │  - ServiceCycles        - ServiceCompletions        │   │
│  │  - CustomerCycleAssignments                         │   │
│  │  - Tasks                                            │   │
│  │  - TaskAssignments                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ (HTTP)
┌─────────────────────────────────────────────────────────────┐
│              External Services (Phase 1 & Beyond)            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Twilio (SMS Notifications)                         │   │
│  │  - Customer alerts (3 days before)                  │   │
│  │  - Service completion notifications                │   │
│  │  - Auto-repeat confirmations                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

### Component Structure

**Backend Folder Structure:**
```
backend/
├── migrations/                      # Knex migrations
│   └── 001_initial_schema.js       # 9 tables schema
├── src/
│   ├── routes/                     # Express route handlers
│   │   ├── auth.js                # Authentication routes
│   │   ├── businesses.js          # Business owner routes
│   │   ├── customers.js           # Customer routes
│   │   └── selections.js          # Selection routes
│   ├── services/                  # Business logic
│   │   ├── businessService.js
│   │   ├── customerService.js
│   │   ├── selectionService.js
│   │   └── notificationService.js # Twilio integration
│   ├── middleware/                # Express middleware
│   │   ├── auth.js                # JWT verification
│   │   ├── errorHandler.js        # Error handling
│   │   └── validation.js          # Input validation
│   ├── jobs/                      # Cron jobs
│   │   ├── selection-reminders.js # 3 days before alert
│   │   └── auto-repeat.js         # 1 day before auto-repeat
│   ├── utils/                     # Helper functions
│   │   ├── jwt.js                # Token generation
│   │   └── validators.js         # Validation helpers
│   └── db.js                      # Knex initialization
├── server.js                      # Express app entry point
├── knexfile.js                   # Knex configuration
├── package.json
└── .gitignore
```

---

### Data Flow Example: Customer Submits Selection

```
1. Customer taps "Submit Selection" on iOS app
                              ↓
2. App calls: POST /api/customers/:customerId/selection-cycle/:selectionCycleId/submit
   Body: { selectedTotalHours: 3, selectedTasks: [1, 2, 3] }
                              ↓
3. Express receives request
   - Route: /api/customers/:customerId/selection-cycle/:selectionCycleId/submit
   - Middleware: Auth (validates JWT token)
   - Middleware: Validation (checks required fields)
                              ↓
4. Controller (selections.js) executes
   - Calls selectionService.submitSelection()
                              ↓
5. Service layer (selectionService.js)
   - Queries customer record (verify exists)
   - Queries SelectionCycle (verify exists)
   - Validates time: sum(tasks.time_allotment_minutes) <= 180
   - Creates Selections record: status = "submitted"
   - Calls Knex to insert into database
                              ↓
6. Database (PostgreSQL) stores:
   INSERT INTO selections 
   (selection_cycle_id, customer_id, selected_tasks, selected_total_hours, status, submitted_at)
   VALUES (1, 1, '[1, 2, 3]'::jsonb, 3, 'submitted', NOW())
                              ↓
7. Service layer returns success
   - Returns 201 Created
   - Response: { success: true, selection: {...} }
                              ↓
8. App receives response
   - Shows confirmation screen
   - Stores data locally (optional)
                              ↓
9. User sees: "✓ Selection Complete!"
```

---

### Scalability Considerations

**Current (MVP Phase):**
- Single Heroku dyno handles requests
- PostgreSQL hobby tier (max 10,000 rows)
- In-memory session storage
- No caching

**Growth Phase (100+ businesses):**
- Multiple Heroku dynos with load balancing
- PostgreSQL Standard tier
- Redis caching for frequently accessed data
- API rate limiting
- Request logging (LogRocket/Sentry)

**Scale Phase (1000+ businesses):**
- AWS ECS/EKS for container orchestration
- RDS PostgreSQL with read replicas
- ElastiCache (Redis) for caching
- CloudFront CDN for static assets
- SQS for async job processing
- SageMaker for analytics (Phase 3)

---

## Development Setup

### Prerequisites

- Mac with Apple Silicon or Intel
- Xcode (for development)
- Terminal familiarity
- PostgreSQL 18
- Node.js v20+
- npm

### Installation Steps

**1. PostgreSQL Setup**
```bash
brew install postgresql@18
createuser -s postgres
createdb task_app_db
```

**2. Node.js & npm**
```bash
brew install node
node --version   # v20+
npm --version    # 10+
```

**3. Backend Setup**
```bash
cd ~/Desktop/YourProjectName/backend
npm install express knex pg cors dotenv nodemon
```

**4. Database Migration**
```bash
npx knex migrate:latest
```

**5. Start Server**
```bash
npm run dev
```

**Expected:** Server running on http://localhost:3000

### Development Commands

```bash
# Start dev server (with auto-reload)
npm run dev

# Run migrations
npm run migrate:latest

# Rollback migrations
npm run migrate:rollback

# Check migration status
npm run migrate:status

# Start production server
npm start
```

---

## Deployment & Scaling

### Phase 1: MVP (Heroku)

**Cost:** ~$100-150/month

**Setup:**
1. Create Heroku account
2. Connect GitHub repo
3. Set environment variables
4. Deploy via GitHub Actions or Heroku CLI

**Environment Variables (Production):**
```
DATABASE_URL=postgres://user:pass@host:port/task_app_db
JWT_SECRET=<strong-secret-key>
TWILIO_ACCOUNT_SID=<your-account-sid>
TWILIO_AUTH_TOKEN=<your-auth-token>
TWILIO_PHONE_NUMBER=<your-twilio-number>
NODE_ENV=production
PORT=5000
```

---

### Phase 2: Growth (AWS)

**Cost:** $300-800/month depending on usage

**Services:**
- **Compute:** ECS Fargate (containers)
- **Database:** RDS PostgreSQL (managed)
- **Caching:** ElastiCache Redis
- **CDN:** CloudFront
- **Monitoring:** CloudWatch + Sentry

---

### Phase 3: Scale (Multi-Region)

**Cost:** $2000+/month

**Services:**
- Multiple AWS regions
- Global CDN
- Database read replicas
- Advanced caching strategies
- Auto-scaling groups

---

## Future Phases

### Phase 2: Analytics & Insights

**Features:**
- Desktop/web portal for business owners
- Historical analytics (task popularity, customer patterns)
- Revenue tracking integration
- Customer satisfaction surveys
- Export capabilities (CSV, PDF)

**Tech:** React.js, Chart.js, PostgreSQL analytics views

---

### Phase 3: Advanced Workflow

**Features:**
- Change order workflow (joint business-customer approval)
- Team management (team members with different roles)
- Service photo/documentation
- Scheduling/calendar integration
- Payment processing
- Rating/review system

**Tech:** Stripe API, Google Calendar API, Firebase Cloud Messaging

---

### Phase 4: AI & Optimization

**Features:**
- Predictive task selection (AI learns customer patterns)
- Dynamic pricing based on demand
- Route optimization for service providers
- Churn prediction and retention
- Recommendation engine

**Tech:** TensorFlow, scikit-learn, PostgreSQL ML

---

### Phase 5: Marketplace

**Features:**
- Service provider marketplace
- Multi-business integration (white-label)
- Franchise enablement
- Marketplace analytics

**Tech:** Multi-tenancy architecture, billing system

---

## Appendix A: Example Database Queries

### Get All Tasks for a Business

```javascript
const knex = require('./db');

async function getBusinessTasks(businessId) {
  return await knex('tasks')
    .where('business_id', businessId)
    .select('*');
}
```

---

### Get Customer's Upcoming Service

```javascript
async function getUpcomingService(customerId) {
  return await knex('selection_cycles')
    .where('customer_id', customerId)
    .where('status', 'open')
    .where('service_date', '>=', knex.raw('CURRENT_DATE'))
    .orderBy('service_date', 'asc')
    .first();
}
```

---

### Get Forecast Data

```javascript
async function getForecast(businessId, days = 30) {
  return await knex('selection_cycles')
    .join('service_cycles', 'selection_cycles.service_cycle_id', '=', 'service_cycles.id')
    .join('selections', 'selection_cycles.id', '=', 'selections.selection_cycle_id')
    .where('service_cycles.business_id', businessId)
    .where('selection_cycles.service_date', '>=', knex.raw('CURRENT_DATE'))
    .where('selection_cycles.service_date', '<=', knex.raw(`CURRENT_DATE + INTERVAL '${days} days'`))
    .where('selections.status', 'submitted')
    .select(
      'selection_cycles.service_date',
      'service_cycles.name as cycle_name',
      knex.raw('COUNT(DISTINCT selections.customer_id) as customers_submitted'),
      knex.raw('SUM(selections.selected_total_hours) as total_hours_forecast')
    )
    .groupBy('selection_cycles.service_date', 'service_cycles.name')
    .orderBy('selection_cycles.service_date', 'asc');
}
```

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Service Cycle** | A template for repeating services (e.g., "Weekly Cleaning") |
| **Selection Cycle** | A specific instance of a service cycle (e.g., "Weekly Cleaning for Alice on Jan 20") |
| **Selection** | A customer's actual task choices for a specific service date |
| **Task** | A specific service offering (e.g., "Vacuum living room") with a time allotment |
| **Time Allotment** | How many minutes a task takes (e.g., 20 mins) |
| **Total Hours** | Fixed service hours assigned to a customer (e.g., 3 hours) |
| **Submission Deadline** | Last day/time customer can submit selections for an upcoming service |
| **Auto-Repeat** | System automatically repeats previous selection if customer doesn't submit |
| **Forecasting** | Business owner view of upcoming labor/time needs |
| **Change Order** | Formal request from business to adjust customer's service scope |
| **JWT Token** | Secure token used to authenticate API requests |
| **JSONB** | PostgreSQL data type for storing JSON arrays/objects |
| **Knex.js** | Node.js query builder and migration tool |
| **SMS** | Text message notification (via Twilio) |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-09 | Initial comprehensive specification |

---

**End of Specification**

This document is the source of truth for the Task App MVP. All code implementations should follow this specification. For questions or clarifications, refer to this document first.
