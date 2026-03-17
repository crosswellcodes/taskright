# TaskRight — Product Overview

## Mission
TaskRight is a two-sided service marketplace that connects small business owners (service providers) with customers who need recurring home services. It streamlines task management, staff scheduling, and customer communication.

---

## User Personas

### Business Owners (Service Providers)
- **Goal**: Manage customer services, assign staff to jobs, track completions
- **Pain Point**: Manually coordinating who's doing what, when, and for which customers
- **Usage**: iOS mobile app (primary), future admin dashboard
- **Key Actions**: Create/manage service cycles, assign tasks, group staff, view customer feedback

### Customers
- **Goal**: Request specific services, get transparency on who's coming, provide feedback
- **Pain Point**: Not knowing which tasks are included, uncertainty about who will be working
- **Usage**: iOS mobile app (primary), future web landing page
- **Key Actions**: View upcoming services, select/submit task requests, leave post-service feedback

---

## Current Phase: MVP Complete

### Mobile App (React Native iOS)
✅ **Complete Features**:
- Customer & business owner signup/login (JWT auth)
- Business: Create service cycles, define tasks, assign staff/groups, view customer selections & feedback
- Customer: View upcoming services, select tasks, submit selections, leave feedback, view history
- Real-time task selection with submission workflow
- Staff transparency — customers see who's coming (first name + last initial for privacy)

### Backend (Node.js/Express, PostgreSQL 18)
✅ **Complete Features**:
- All 14 business routes (auth, tasks, service cycles, assignments, feedback)
- All 3 customer routes (auth, selections, upcoming services)
- Cron jobs for daily SMS reminders & auto-repeat selections (requires Twilio)
- JWT-based auth with role separation (customer vs. business)
- Full 9-table database schema

### Website
❌ **Not Started** — Phase 2 initiative
- Goal: Product marketing, lead capture, trust-building
- Potential features: Landing page, signup flows, service showcase, admin dashboard (future)

---

## Key User Flows

### Business Owner Workflow
1. **Signup** → Phone + business info
2. **Create Service Cycle** → Define date, hours, included tasks
3. **Assign Staff** → Individual team members or groups
4. **Wait for Selections** → Customer picks tasks
5. **Review Feedback** → Post-service customer reviews

### Customer Workflow
1. **Signup** → Phone + name
2. **View My Service** → See next scheduled service, who's coming
3. **Select Tasks** → Choose from available options, confirm submission
4. **Get Confirmation** → "Selection Submitted!" screen
5. **Post-Service** → Leave feedback after completion
6. **View History** → Past selections & feedback

---

## Design System & Brand

### Colors
- **Primary Blue**: `#2563eb` — main actions, headers, cards
- **Success Green**: `#10b981` — confirmations, submitted states
- **Text Dark**: `#1a1a1a` — body text, high contrast
- **Text Light**: `#888` / `#6b7280` — secondary text, subtle info
- **Background**: `#f5f5f5` (light grey) — main app background
- **Surface**: `#fff` (white) — cards, modals, sections

### Typography
- **Headings**: 20-28px, weight 700
- **Subheadings**: 15-16px, weight 600
- **Body**: 14-15px, weight 400-500
- **Small text**: 12-13px, weight 400-500

### Key UI Patterns
- **Blue cards** — highlight key information (next service)
- **Pills/badges** — team member names, status indicators
- **Modals** — task selection, service details, feedback
- **Confirmation screens** — success states with checkmarks

---

## Business Metrics to Track

1. **Adoption**
   - Monthly active businesses
   - Monthly active customers
   - Conversion rate (signup → first submission)

2. **Engagement**
   - % of customers who submit task selections
   - Avg. tasks selected per submission
   - % of businesses with active team groups

3. **Retention**
   - Monthly churn (canceled subscriptions)
   - Repeat service rate
   - Feedback completion rate

4. **Satisfaction**
   - Avg. feedback score post-service
   - NPS (Net Promoter Score)
   - Staff assignment utilization

---

## API Integration Points (for website)

The website will integrate with the same backend API:
- **Base URL**: `http://localhost:3000/api` (dev) or deployed URL
- **Auth**: JWT tokens (same as mobile)
- **Primary endpoints for web**:
  - `POST /auth/signup` — customer or business signup
  - `POST /auth/login` — login flow
  - `GET /businesses/:id` — public business info (if applicable)
  - `GET /customers/:id/selections` — past selections (admin dashboard)

See `shared/API_REFERENCE.md` for full endpoint documentation.
