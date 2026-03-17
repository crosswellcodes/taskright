# TaskRight Feature Mapping — Mobile vs. Website

This document maps TaskRight's features across platforms and indicates where each feature should appear for optimal product-market fit testing.

---

## Feature Matrix

### Authentication & Onboarding

| Feature | Mobile App | Website | Priority | Notes |
|---------|-----------|---------|----------|-------|
| **Business Signup** | ✅ Complete | 🔄 Recommended | P0 | Website landing page CTA → link to app store OR web flow |
| **Business Login** | ✅ Complete | 🔄 Recommended | P0 | Web login for potential admin dashboard |
| **Customer Signup** | ✅ Complete | ✅ Recommended | P0 | Main web CTA — drive traffic to app signup |
| **Customer Login** | ✅ Complete | ⚠️ Optional | P1 | May not need on web; customers primarily use app |
| **Phone Verification** | ✅ Complete | 🔄 Consider | P1 | Use same JWT auth backend for consistency |
| **Account Recovery** | ❌ Not yet | 🔄 Consider | P2 | Password reset via SMS/phone |

---

### Customer Features (My Service)

| Feature | Mobile App | Website | Priority | Notes |
|---------|-----------|---------|----------|-------|
| **View Next Service** | ✅ Blue card with date, hours, staff | ✅ Showcase | P1 | Show on marketing page (demo view) |
| **See Who's Coming** | ✅ Staff pills (first name + last initial) | ✅ Showcase | P1 | Transparency is a key selling point |
| **Select Tasks** | ✅ Full workflow (picker → confirmation → success) | ❌ Mobile-only | — | Deep interaction requires app |
| **View Upcoming Services** | ✅ Modal with all scheduled services | ✅ Reference | P1 | Show on "What to Expect" page |
| **Submit Selections** | ✅ Complete flow with confirmation | ❌ Mobile-only | — | Requires app |
| **View Selection History** | ✅ Past submissions + feedback | ✅ Admin feature | P2 | Show in business owner dashboard if built |
| **Leave Feedback** | ✅ Rating + comment post-service | ✅ Admin feature | P2 | Show aggregate feedback on business dashboard |

---

### Business Features (Business Dashboard)

| Feature | Mobile App | Website | Priority | Notes |
|---------|-----------|---------|----------|-------|
| **Create Service Cycle** | ✅ Wizard + date/task selection | 🔄 Consider | P1 | Could move to web for easier data entry |
| **Define Tasks** | ✅ Create, edit, delete tasks | 🔄 Consider | P1 | Web form more comfortable for task mgmt |
| **Manage Team Members** | ✅ Add, edit, delete staff | 🔄 Consider | P1 | Web dashboard ideal for team roster |
| **Create Team Groups** | ✅ Group staff for assignments | 🔄 Consider | P1 | Easier on web with drag-drop UX |
| **Assign Customers to Cycles** | ✅ Select customers + cycle | 🔄 Consider | P1 | Web would be more scalable |
| **Assign Staff to Cycle** | ✅ Pick individual or group | 🔄 Consider | P1 | Visual assignment better on web |
| **View Customer Selections** | ✅ See submitted tasks per customer | ✅ Showcase | P1 | Key business insight to highlight |
| **View Feedback** | ✅ Customer ratings + comments | ✅ Showcase | P1 | Social proof — show on marketing |
| **Mark Service Complete** | ✅ Confirm completion in app | 🔄 Consider | P1 | Could move to web for easier bulk operations |
| **View Analytics** | ❌ Not yet | 🔄 Future | P3 | Aggregate data on web dashboard |

---

## Platform Decision Criteria

### ✅ Mobile-Only Features
These interactions are optimized for mobile and should NOT move to web:
- **Task selection workflow** — requires real-time feedback, mobile-first UX
- **On-site operations** — staff marking tasks complete, taking photos
- **Push notifications** — SMS reminders already implemented

### 🔄 Cross-Platform (Start Mobile, Expand to Web)
These features exist in mobile and could expand to web for power users:
- **CRUD operations** (tasks, team members, service cycles) — easier data entry on web
- **Assignments & scheduling** — visual tools on web > mobile forms
- **Bulk operations** — marking multiple services complete

### ✅ Web-Only (Marketing & Admin)
These features should live on web to complement mobile:
- **Marketing landing page** — product demo, feature showcase
- **Public business profiles** — customers discover new services
- **Business owner dashboard** — analytics, team management, bulk operations

### ⚠️ Optional (Later Phases)
These can be added once core MVP is validated:
- **Account recovery** (password reset)
- **Web customer portal** (selection history, past feedback)
- **Advanced analytics** (usage trends, retention metrics)

---

## Website Phase Plan

### Phase 1: Landing Page + Marketing
**Goal**: Test product-market fit, drive signups

**Features**:
- Hero section: "Schedule home services with confidence"
- Value props: transparency, ease, reliability
- **Live demo section**:
  - Show sample service cycle (date, hours, tasks)
  - Display team member names (privacy: first + last initial)
  - Customer reviews/feedback (social proof)
- Signup CTA: "Book your first service" → links to mobile app store

**No Backend Integration**: Static marketing site (can use Next.js SSG)

---

### Phase 2: Signup Flows
**Goal**: Convert visitors into registered users

**Features**:
- Business signup form (name, phone)
- Customer signup form (phone, pick service area)
- Phone verification (SMS OTP)
- Redirect to mobile app after signup
- Web session management (optional: keep logged in)

**Backend Integration**: Auth endpoints from API_REFERENCE.md

---

### Phase 3: Admin Dashboard (Future)
**Goal**: Reduce friction for business owners entering data

**Features**:
- Task management (CRUD with web forms)
- Team member roster (add, edit, bulk import)
- Service cycle creation (calendar UX)
- Assignment dashboard (drag-drop staff ↔ services)
- Selection view (see what customers picked)
- Feedback aggregation (ratings, trends)

**Backend Integration**: Full API_REFERENCE.md

---

## Content Strategy

### Copy & Messaging
- **For customers**: "Know who's coming. Pick what matters."
- **For business owners**: "Organize your team. Manage your services. Delight your customers."
- **Social proof**: Showcase real feedback snippets + ratings

### Imagery & Video
- **Hero**: Clean home, happy customer, confident service provider
- **Process walkthrough**: Signup → browse services → select tasks → done
- **Testimonials**: Customer & business quotes (if available)

### SEO Keywords
- "home cleaning service scheduling"
- "transparent service provider"
- "task selection app"
- "staff scheduling app"
- "customer service platform"

---

## Success Metrics (for Website)

### Phase 1 (Landing Page)
- Page views
- Signup CTR (click-through rate)
- Bounce rate
- Time on page

### Phase 2 (Signup Flows)
- Signup completion rate
- Verification completion rate
- Drop-off points in signup flow
- Mobile app install rate (post-signup)

### Phase 3 (Admin Dashboard)
- Login rate
- Feature usage (task creation, assignments, etc.)
- Business owner satisfaction (NPS)
- Retention (returning users)

---

## Technical Considerations

### Shared Backend
- Website uses **same API** as mobile app (see API_REFERENCE.md)
- Auth: JWT tokens (same as mobile)
- No separate backend needed

### Frontend Framework Choice
- **Next.js** (recommended): SSR for marketing, API routes for auth
- **React + Vite**: Lighter, SPA-based approach
- **Static site**: Phase 1 can use Hugo, Eleventy, or Next.js SSG

### Design Consistency
- Mirror mobile design system from DESIGN_SYSTEM.md
- Use same colors, typography, component patterns
- Responsive breakpoints: mobile-first → tablet → desktop

### Analytics
- Segment: Track signup source, feature adoption
- Mixpanel or Amplitude: User behavior funnels
- Sentry: Error tracking and monitoring

---

## Go-Live Checklist

- [ ] Landing page deployed (Phase 1)
- [ ] Mobile app available on App Store (iOS)
- [ ] Authentication verified (signup → token → mobile app)
- [ ] SMS delivery working (Twilio)
- [ ] Backend monitoring & error handling
- [ ] Analytics configured
- [ ] Legal (terms, privacy policy)
- [ ] Customer support channel ready (email, chat)
