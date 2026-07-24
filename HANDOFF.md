# TaskRight — Handoff Document
**Last updated: July 20, 2026 (Geocoding Reliability BUILT (July 20): fixed the team-member "No address on file — using manual tracking" quirk (address present but never geocoded). Migration 025 (`customers.geocode_attempts/attempted_at/relevance`) + `geocodeCustomer` with a relevance gate that refuses to store confident-wrong pins + reset-on-address-change + an hourly bounded retry job + an owner-visible `geocodeStatus` "couldn't map this address" note. Copy fix + one-off backfill of 8 legacy customers. 165/165 backend tests. See "Geocoding Reliability" below. Prior — Session 18: Day-of-Week Day Snapshot parity BUILT (July 17): day-of-week owners now get a "Review {Weekday} — see what's scheduled" button in service create that opens the same `ServiceDaySnapshot` review date-based owners get. Mobile-only, no backend change (reuses `getForecast` + the presentational snapshot screen). Flavor 2 (weekday aggregate) deferred. See "Day-of-Week Day Snapshot Parity" below. Prior same session — Service Call Lifecycle BUILT + Proposed Job Costing / Expected Margin extension BUILT (July 15): the proposed state now shows expected labor cost + margin — `getJobCosts` gains `proposedLabor` (hours × Σ assignee rates; group = whole-crew sum), `expectedTotalCost`, `expectedMargin*`, an `expectedLaborIncomplete` floor flag, and an `estimatedHours` fallback fix. `ServiceCallDetailScreen` shows Proposed Labor + Expected Margin pre-completion, actuals after. No migration, no new endpoint. 151/151 backend tests. Prior same session: Service Call Lifecycle BUILT: a created service's Calls are legible immediately — the per-Call detail screen shows the proposed/expected scope (default `service_tasks` menu + `total_hours` + `price_per_visit` + assignment) in flight, then switches to confirmed (customer's submitted selection) and actual (completion + labor/margin). Backend enriches `getServiceCallDetail` with a derived `lifecycleState` + resolved `tasks[]` (fixes the latent ids-render-as-"Task N" bug) + `expectedHours`/`confirmedHours`/`expectedPrice`/`scopeIsAssumed`; `CustomerDetailScreen` upcoming rows gain a lifecycle badge. No migration, no new endpoints. 144/144 backend tests (+8). See "Service Call Lifecycle" below. Prior: Session 17 — Team Labor Costing BUILT: closed the D3 gap so group-assigned Calls now record per-member labor → profitability populates on the cost side. Option A — a group assignment resolves to every team member individually; broadened the four member-facing resolvers via one shared `assertMemberAssignedToCall` gate (`team_member_id` OR `team_memberships`), reusing the per-member labor machinery unchanged. No migration. 136/136 backend tests (+15). See "Team Labor Costing" below. Prior: Session 16 — Create-Flow Team Assignment BUILT: optional person/group assignment inside the service create flow + service-level fan-out endpoint `PUT .../services/:id/assignment`; shared controlled `AssigneePicker`; validate-first-then-create; no migration.)**

> Start every new session by reading this file + `shared/API_REFERENCE.md`. Do NOT read SPEC.md unless you need deep schema details — it is 75KB and slow to load.

---

## Project Structure

```
TaskRight_Project/
├── HANDOFF.md                        ← This file (read first)
├── SPEC.md                           ← Full spec (use offset/limit, it's 75KB)
├── backend/                          ← Node.js/Express API (localhost:3000)
├── TaskRight/                        ← React Native iOS app
├── TaskRight-Website/                ← Next.js marketing site (localhost:3001)
└── shared/
    ├── API_REFERENCE.md              ← All endpoints
    ├── DESIGN_SYSTEM.md              ← Colors, typography, component patterns
    ├── PRODUCT_OVERVIEW.md           ← Mission, personas
    └── FEATURE_MAPPING.md            ← Mobile vs website feature split
```

---

## Dev Environment — Three Terminals Required

> **⚠️ Current state (July 20, 2026):** the **backend is stopped** — the live instance was shut down after verifying the geocode retry job, so its hourly sweep is not running. Postgres (`task_app_db`) is still up. Restart Terminal 3 (`cd backend && npm run dev`) to bring it back; on boot it logs `✓ Geocode Retry Job scheduled (runs hourly)` and resumes sweeping on the hour.

```bash
# Terminal 1 — Metro bundler (must start FIRST)
cd TaskRight && npm start

# Terminal 2 — iOS Simulator (after Metro is running)
cd TaskRight && npm run ios

# Terminal 3 — Backend + DB
brew services start postgresql@18
cd backend && npm run dev          # localhost:3000

# Website (separate, user runs manually)
cd TaskRight-Website && npm run dev  # localhost:3001
```

**Critical:** Never start the simulator before Metro. "No script URL provided" error = Metro isn't running.

---

## What's Fully Built

### Backend (`backend/`)
- **Auth**: Business signup/login, customer signup/login, team member login (invite code)
- **Business routes** (`routes/businesses.js`): Tasks CRUD, service cycles CRUD, customers CRUD, cycle assignment, forecast, service completion, upcoming selections, customer feedback, team members CRUD, service assignments, team groups CRUD, selection cycle detail, reschedule selection cycle
- **Customer routes** (`routes/customers.js`): Current selection cycle, submit selections, selection history, upcoming services, feedback submit
- **Team member routes** (`routes/teamMembers.js`): Auth, job list, job detail, mark job complete
- **Services**: `businessService.js`, `customerService.js` — all business logic
- **Notifications**: `notificationService.js` — per-business SMS routing via Twilio Messaging Services (6 message types: welcome, completion, reminder, auto-repeat, reschedule, feedback alert). All call sites wired in `businessService.js`, `businesses.js`, `customers.js`, and both cron jobs. Dev-mode fallback logs to console when a business isn't provisioned yet.
- **Twilio provisioning**: `twilioProvisioningService.js` — fire-and-forget on signup. Creates subaccount → Messaging Service → purchases local number → adds to pool → persists to DB. Status tracked in `businesses.twilio_provisioning_status`.
- **Inbound webhook**: `routes/webhooks.js` — `POST /api/webhooks/inbound-sms`. Receives Twilio POST, routes by `To` phone → business, `From` phone → customer, stores in `messages` table. Returns `<Response/>` immediately, processes async.
- **Cron jobs**: `jobs/selection-reminders.js`, `jobs/auto-repeat.js` — fully wired with per-business SMS routing. Dormant until Twilio credentials are active.
- **Test suite**: 94/94 passing (`npm test`, uses `task_app_test` DB)

### Database Schema (PostgreSQL 18, Knex)
Migration files: `backend/migrations/001_initial_schema.js` through `022_service_model_cleanup.js` (all run on both `task_app_db` and `task_app_test`).
- `013_message_media.js` — `media_urls` JSONB on messages
- `014_business_join_code.js` — `join_code` on businesses (Session 5)
- `015_sms_keywords.js` — `pending_sms_action` on customers; `customer_note`, `selection_token`, `selection_token_expires_at` on selection_cycles (Session 5)
- `017–019` — job costing (cost_categories, job_costs, geofence_events, price columns, integrity)
- `020_review_tokens.js` — review_tokens + feedbacks.source/rating + customers.review_requests_opted_out
- `021_per_customer_services.js` + `022_service_model_cleanup.js` — **Service Model C1**: rename service_cycles→service_templates, customer_cycle_assignments→customer_services (absorbs definition), task_assignments→template_task_assignments, new service_task_assignments, selection_cycles.service_cycle_id→customer_service_id
- `023_per_service_task_ownership.js` — **Service Model Phase 2**: retire the global `tasks` table + both junctions; new `service_tasks` (owned per customer_services) + `template_tasks` (owned per service_templates); backfilled from the junctions; `selections.selected_tasks` remapped global-id→service_tasks.id. `down()` best-effort/lossy.
- `024_decimal_service_hours.js` — widen `customer_services.total_hours` + `selections.selected_total_hours` from `integer`→`numeric(6,2)` so fractional hours (1.5h/visit, 0.75h selections) stop 500ing. Service layer coerces these back to `Number` on read (pg returns `numeric` as a string). integer→numeric is lossless.
- `025_geocode_tracking.js` — geocoding reliability: `customers.geocode_attempts` (int, default 0), `geocode_attempted_at` (timestamptz), `geocode_relevance` (numeric(3,2)). Also nulls the two known low-confidence test rows' coords so the new relevance gate re-evaluates them. See "Geocoding Reliability" below.

Key tables:
- `businesses` — id, name, phone_number, scheduling_format ('date_based' | 'day_of_week'), twilio_subaccount_sid, twilio_phone_number, twilio_messaging_service_sid, twilio_provisioning_status ('pending'|'active'|'failed'|'dev_mode'), join_code (varchar 12, unique — for customer invite links `/join/[code]`), entity_type ('sole_prop'|'llc_corp'), contact_first_name, contact_last_name, contact_email, business_street, business_city, business_state, business_zip, a2p_brand_sid, a2p_campaign_sid, a2p_registration_status ('pending'|'approved'|'failed')
- `customers` — id, business_id, name, phone_number, address, notes, pending_sms_action (nullable varchar — 'note_pending' when waiting for N follow-up)
- `service_templates` *(was `service_cycles`, renamed in 021)* — id, business_id, name, frequency, days_before_service_deadline, days_before_auto_repeat. Business-global reusable **template library** (Service Model C1); a template only seeds a customer Service, decoupled after.
- `customer_services` *(was `customer_cycle_assignments`, renamed in 021)* — id, customer_id, **template_id (nullable, provenance only, FK SET NULL)**, **name, frequency, days_before_service_deadline, days_before_auto_repeat** (absorbed definition), total_hours, price_per_visit, start_date, day_of_week (nullable). The **per-customer Service** — one row per service a customer receives; a customer may have several (old unique(customer,cycle) dropped).
- `selection_cycles` — id, **customer_service_id** *(was `service_cycle_id`; 021 backfilled, 022 made NOT NULL + dropped the legacy col)*, customer_id, service_date, submission_deadline, status ('open'|'completed'), price, customer_note, selection_token, selection_token_expires_at
- `selections` — id, selection_cycle_id, customer_id, selected_tasks (JSONB array of **`service_tasks.id`** since 023), status ('draft'|'submitted')
- `service_tasks` *(new in 023)* — id, **customer_service_id (FK CASCADE)**, name, time_allotment_minutes, is_optional. A task **owned** by exactly one customer_services row; editing affects only that customer. `selections.selected_tasks` references this id → `updateCustomerService` **diff-upserts** (never wholesale delete+reinsert). *Replaced `tasks` + `service_task_assignments`.*
- `template_tasks` *(new in 023)* — id, **template_id (FK CASCADE)**, name, time_allotment_minutes, is_optional. A task owned by one service_templates row; copied into `service_tasks` on "start from template". *Replaced `tasks` + `template_task_assignments`.*
- *(retired in 023: the global `tasks` table + `service_task_assignments` + `template_task_assignments`. No global task endpoints or Tasks tab.)*
- `service_completions` — id, selection_cycle_id, customer_id, completed_at, notes
- `messages` — id, business_id, customer_id (nullable), direction ('inbound'|'outbound'), body, twilio_message_sid, to_phone, from_phone, media_urls (JSONB nullable), created_at. Indexed on (business_id, customer_id, created_at). `media_urls` is an array of local paths like `["/uploads/messages/SMxxx_0.jpeg"]` — served statically by Express.
- `team_members` — id, business_id, name, phone_number, invite_code (server-generated)
- `service_assignments` — id, selection_cycle_id, team_member_id (nullable), team_id (nullable) — mutually exclusive
- `teams` — id, business_id, name
- `team_group_members` — team_id, team_member_id junction

### Mobile App (`TaskRight/`)

**Navigation structure:**
```
RootNavigator
├── AuthNavigator         (unauthenticated)
│   └── PhoneEntryScreen  (signup/login, detects business vs customer vs team member)
├── BusinessNavigator     (type === 'business')
│   ├── HomeScreen        (forecast calendar + today's assignments)
│   ├── CustomersStack
│   │   ├── CustomersScreen
│   │   ├── CustomerDetailScreen     (upcoming services, tappable rows)
│   │   ├── ServiceCallDetailScreen  (service call detail + reschedule)
│   │   ├── MessageThreadScreen      (SMS thread view + compose bar)
│   │   ├── AssignCycleScreen        (date-based or day-of-week)
│   │   └── ServiceDaySnapshotScreen (date confirmation before assign)
│   ├── TasksScreen
│   ├── ServiceCyclesScreen
│   ├── ForecastScreen
│   └── TeamStack
│       ├── TeamMembersScreen
│       ├── AddTeamMemberScreen      (shows invite code modal on create)
│       ├── TeamGroupsScreen
│       └── TeamGroupDetailScreen
├── CustomerNavigator     (type === 'customer')
│   ├── CurrentSelectionScreen  (My Service — inline calendar, upcoming modal)
│   ├── TaskPickerScreen
│   ├── HistoryScreen
│   └── FeedbackScreen
└── TeamMemberNavigator   (type === 'teamMember')
    ├── MyJobsScreen       (assigned jobs list)
    └── JobDetailScreen    (address, notes, tasks, mark complete)
```

**Key source files:**
```
TaskRight/src/
├── api/
│   ├── client.js          ← base HTTP client (get/post/put/patch/del)
│   ├── authApi.js         ← signup/login calls
│   ├── businessApi.js     ← all business owner API calls
│   ├── customerApi.js     ← all customer API calls
│   └── teamMemberApi.js   ← team member job API calls
├── context/
│   └── AuthContext.js     ← user state, login/logout, JWT storage
├── navigation/
│   ├── RootNavigator.js
│   ├── BusinessNavigator.js
│   ├── CustomerNavigator.js
│   └── TeamMemberNavigator.js
├── screens/
│   ├── auth/PhoneEntryScreen.js
│   ├── business/          ← all business screens
│   ├── customer/          ← all customer screens
│   └── teamMember/        ← MyJobsScreen, JobDetailScreen
└── utils/
    └── phoneUtils.js      ← normalizePhone, formatPhone, displayPhone
```

### Marketing Website (`TaskRight-Website/`)
Next.js App Router on port 3001.

**Landing page sections (in order):**
Navbar → Hero → Problem → Features → HowItWorks → AppShowcase → FounderStory → FAQ → EarlyAccessForm → Footer

**Current live state (as of May 27, 2026 — Session 8):**
- Hero: Removed "Now accepting early access requests" pill. CTA label sitewide changed from "Get Early Access" → **"Get TaskRight"**.
- CTA button color sitewide changed to **orange** (`bg-orange-600 hover:bg-orange-700`) across Navbar, Hero, and EarlyAccessForm — contrast against blue brand color.
- Hero headline: "Your customers, your team, and your jobs — all in sync, all the time."
- **PersonaCards section** added between Hero and AppShowcase — 3-column layout: Customer / Team Member / Business Owner. Each card has a tagline and bullet list of persona-specific benefits. No emojis (emojis also removed from Problem and Features components).
- **AppShowcase — Embedded Hotspot Architecture (Session 8):**
  - `HotspotDot` shared component (pulsing blue dot, turns green on active, `stopPropagation()` so dots inside buttons don't trigger parent navigation)
  - `RenderParams` type passes `activeHotspot` + `onHotspotTap` into mock components
  - `embedsHotspots: boolean` flag on Screen definition skips parent overlay rendering
  - **All business screens now embedded:** Dashboard, Customer (+ Messages preview card added), Service Cycle, My Team
  - **All team member screens now embedded:** Job Detail
  - **Customer screens embedded:** My Service, History
  - Customer screens NOT yet embedded: Next Service, Select Tasks (Confirmed), Feedback — these still use overlay hotspots
- **AppShowcase — CustomerTaskPicker redesigned** as tap-to-rank prioritization list (Option C):
  - Tap tasks in priority order → numbered badges (#1, #2 …) appear
  - Tap again to deselect + auto-shift ranks
  - Submit button dim/inactive until all 4 tasks ranked; shows "X of 4 ranked" progress
  - Time budget bar and per-task minute counts fully removed
- **AppShowcase — CustomerNextService:** timing metrics removed from "Your Selections" card (mins per task + "65/180 min used" line)
- **Port fix:** Website `package.json` dev script hardcoded to `next dev -p 3001` — prevents port conflict with Express backend on 3000
- HowItWorks step 2: mentions team members get their own app view
- FounderStory: confident product voice, removed "in active development" framing
- FAQ: 6 questions — What Does TaskRight Do, How many customers/team members, How do I use TaskRight, What about data security, Can I use TaskRight for my business type, When is TaskRight launching
- EarlyAccessForm: "Get Free Access to TaskRight through Early Access Signup", early access language throughout

**Session 5 additions:**
- `/signup` — business signup success screen now shows customer invite link (`taskrightpro.com/join/[joinCode]`)
- `/join/[code]` — customer self-signup flow: resolves join code → shows "You're joining [Business]" → name + phone → OTP → account created
- `/s/[token]` — no-auth task selection page for SMS keyword T flow: task checklist with checkboxes, confirm with zero or more tasks, 7-day token expiry

**SEO infrastructure built:**
- `src/app/robots.ts` — allows `/`, `/blog/`, disallows `/api/`
- `src/app/sitemap.ts` — dynamic sitemap (homepage + blog)
- `src/app/layout.tsx` — full metadata, OG tags, Twitter cards, Organization + LocalBusiness + FAQPage JSON-LD schemas
- `src/app/page.tsx` — page-level metadata with canonical

**Website dev rule:** User runs `next dev` themselves. Do NOT call `preview_start`. After edits, verify with `npm run build` only.

---

## Key Architectural Decisions (Do Not Change Without Discussion)

### Twilio ISV Architecture
One Twilio **subaccount** + one **Messaging Service** + one **dedicated local phone number** per business. This is the only architecture compatible with A2P 10DLC (US carrier requirement for business SMS).

- **Sending**: parent account credentials via `parentClient()` — no per-business auth tokens stored in DB.
- **Routing**: all outbound SMS goes via `messagingServiceSid`, never a direct `from` number.
- **Inbound**: Messaging Service points to `POST /api/webhooks/inbound-sms`. Twilio delivers to whichever number in the pool is the source.
- **Provisioning**: fire-and-forget on business signup (`twilioProvisioningService.js`). Instant signup response; provisioning completes in background. Status in `businesses.twilio_provisioning_status`.
- **Dev mode**: `sendSMS()` falls back to `console.log` when `twilio_messaging_service_sid` is null — nothing breaks without live credentials.
- **Required env vars**: `TWILIO_ACCOUNT_SID` (parent, starts with `AC`), `TWILIO_AUTH_TOKEN`, `API_BASE_URL` (used to construct webhook URL during provisioning). `TWILIO_PHONE_NUMBER` is **not used** — each business has their own number.
- **Critical architecture note (Session 3)**: Twilio's `messaging.twilio.com` API does NOT respect the `accountSid` routing option that `api.twilio.com` supports. Messaging Services and phone numbers must both live on the **parent account**. Subaccounts are created for organizational/billing purposes and future A2P registration, but all SMS send/receive infrastructure is on the parent. `notificationService.js` and `businesses.js` manual send both use `parentClient()`. `twilioProvisioningService.js` uses `parentClient()` for steps 2–5 (only step 1, subaccount creation, uses `parentClient().api.v2010.accounts.create`).

### Phone Normalization
`utils/phoneUtils.js` — `normalizePhone()` auto-prepends `+1` for 10-digit numbers, `+` for 11-digit starting with `1`. This fixed customer login requiring manual "1" prefix. All phone input goes through this before API calls.

### Scheduling Format
Businesses have `scheduling_format`: `'date_based'` (calendar date picker) or `'day_of_week'` (select Thu, etc.). Set at signup. Controls what AssignCycleScreen renders. Day-of-week cycles advance by fixed-day multiples (7/14/28/364 days) so the weekday never drifts.

### Service Assignments
`service_assignments` has `team_member_id` OR `team_id` — never both. Queried with left joins to both `team_members` and `teams`. ServiceCallDetailScreen dynamically labels section "Team Member" or "Team" based on which is populated.

### Team Member Invite Codes
Generated server-side on create, stored in `team_members.invite_code`. Shown to business owner in a modal immediately after creation. Business owner can tap "Text this code to [Name]" which opens iOS Messages via `Linking.openURL('sms:+1xxx?body=...')`. Not wired to Twilio yet.

### Job Completion
Team member sees task checkboxes (local state only — for visual progress). Tap "Mark Service Complete" → Alert confirmation → single API call `PATCH /api/team-members/:id/jobs/:selectionCycleId/complete` → server writes `service_completions` row with `CURRENT_TIMESTAMP` + optional notes, updates `selection_cycles.status = 'completed'`.

### Reference Numbers
`selectionCycleId` is the shared reference number between business and customer views. Displayed as "Ref #34" on:
- Business: `ServiceCallDetailScreen` header
- Customer: `CurrentSelectionScreen` blue card, tasks modal, upcoming modal rows, inline calendar detail card
- Customer: `HistoryScreen` each card below the date

### Customer Join Codes
`businesses.join_code` — 6-char uppercase alphanumeric generated at business creation. Used for customer self-signup at `/join/[code]`. Chosen over URL slugs: stable, collision-free, works as both a link and verbally. Business owner sees their invite link on the signup success screen. Mobile customer signup still uses `businessId` directly — unchanged.

### SMS Keyword System (Session 5)
Customers text single-letter keywords to their business's dedicated Twilio number. Processed in `routes/webhooks.js` `handleKeyword()` after inbound message is stored. Only fires for known customers (matched by phone + business). Anything unrecognized passes through to the business owner's message thread — no auto-reply, intentional personal customer service touchpoint.

| Keyword | Action |
|---|---|
| C | Confirm current tasks — auto-submits selection (or repeats last if none), sends acknowledgment |
| T | Generates 7-day selection token, sends `taskrightpro.com/s/[token]` link — no-auth task page |
| D | Sends "forwarded to [Business]" reply — message stays in thread for business owner |
| N | Stateful: sets `customers.pending_sms_action = 'note_pending'`, prompts for note text, next reply saves to `selection_cycles.customer_note` |

`WEBSITE_URL` env var controls domain in T link (default `https://taskrightpro.com`; set to `http://localhost:3001` for local testing).

Team member sees `customerNote` in `getJobDetail()` response — visible in JobDetailScreen on service day.

Reminder and auto-repeat cron SMS copy updated to include keyword prompt. Both now accept and use `businessName` param.

### Reschedule (Change Order)
`PATCH /api/businesses/:businessId/selection-cycles/:selectionCycleId/reschedule` moves a single service call's date. Does NOT affect other scheduled dates in the series. Only open (not completed) calls can be rescheduled. Shows calendar modal in `ServiceCallDetailScreen` with optimistic UI update.

### Date Normalization
PostgreSQL date columns return as full ISO strings (e.g., `2026-04-24T00:00:00.000Z`). Always split on `'T'` and take `[0]` before creating a `Date` object to avoid "Invalid Date". Pattern used in MyJobsScreen and JobDetailScreen:
```js
const dateOnly = String(dateStr).split('T')[0];
const d = new Date(dateOnly + 'T12:00:00');
```

### Non-Serializable Nav Params
React Navigation requires all params to be plain serializable data. Functions cannot be passed as params. **Day-of-week path:** inline calendar in AssignCycleScreen directly calls `setStartDate(day.dateString)` — no navigation. **Date-based path:** still uses navigate to ServiceDaySnapshot → navigate back to AssignCycle with `confirmedDate` in params + useEffect watches `route.params?.confirmedDate`.

---

## Pending Work

### Mobile App
- [x] **Day-of-week backend migration** — Complete (stale note cleared July 5, 2026). `002_scheduling_format.js` exists (committed in `33df15d`), is recorded in `knex_migrations` (batch 10), and its columns (`businesses.scheduling_format`, `customer_cycle_assignments.day_of_week`) are present on both `task_app_db` and `task_app_test`. Fully wired backend (`validators.js`, `auth.js`, `businesses.js`, `businessService.js`) + mobile (`PhoneEntryScreen.js`, `AssignCycleScreen.js`, `authApi.js`). The "needs to be created and run" note predated the Session 9 repo-hygiene reconciliation.
- [x] **Activate Twilio** — Complete. See live credential note above.
- [x] **A2P 10DLC self-service registration** (Session 6 complete) — Full self-service signup flow built. Entity type at step 0 (sole_prop|llc_corp) with requirements preview and transparency copy. KYC form at step 3 post-OTP. Migration `016_a2p_registration.js` adds all new columns. `registerA2P(businessId, ein)` in `twilioProvisioningService.js` chains Trust Hub API: Customer Profile → end-user attachment → Brand Registration → Messaging Campaign → link to Messaging Service. EIN is closure-only, never written to DB or logs. Fire-and-forget from `PATCH /api/businesses/:id/kyc`. JWT from signup held in React state for the KYC call, then discarded. 76/76 tests passing.
- [x] **A2P Trust Hub prerequisites + code fix** (Session 7 complete) — All three items addressed:
  1. **Platform-level setup (manual, in progress):** New Twilio account created with domain-matched email. EIN registered with state (pending). Primary Customer Profile submitted at `console.twilio.com → Trust Hub → My Profiles` — pending Twilio review (1–3 business days). Once approved, programmatic brand registration via API will be unblocked.
  2. **Code fix — `a2PProfileBundleSid`** — Fixed in `twilioProvisioningService.js`. `brandRegistrations.create()` now correctly receives: `customerProfileBundleSid` (Secondary Customer Profile, entity identity) and `a2PProfileBundleSid` (a separate `trustProducts` A2P Messaging Profile bundle — new Step 1b in the chain). Previous code passed the Customer Profile SID for both, which Twilio would reject.
  3. **Policy SIDs verified** — Confirmed via `GET /v1/Policies` against live Twilio API. All four relevant SIDs now hardcoded with accurate labels, split by entity type (LLC/Corp vs Sole Prop):
     - LLC/Corp Customer Profile policy: `RNdfbf3fae0e1107f8aded0e7cead80bf5`
     - Sole Prop Customer Profile policy: `RN806dd6cd175f314e1f96a9727ee271f4`
     - LLC/Corp A2P Messaging Profile policy: `RNb0d4771c2c98518d916a3d4cd70a8f8b`
     - Sole Prop A2P Messaging Profile policy: `RN63da8244384cf0401c39f5f91e674db5`
- [ ] **A2P live test** — Once Twilio Primary Customer Profile review clears (days away), do a full end-to-end test: sign up a new business through `/signup`, submit KYC, confirm `registerA2P()` runs without error, check Trust Hub console for created bundles and brand registration status.
- [x] **Mobile messages UI** (Session 3 complete) — `CustomerDetailScreen` → `MessageThreadScreen`. Chat bubble UI (outbound=right/blue, inbound=left/gray), compose bar, cursor pagination ("Load earlier messages" button). Calls `GET/POST /api/businesses/:businessId/customers/:customerId/messages`.
- [x] **Activate Twilio** (Session 3 complete) — Live credentials in `.env`. Provisioning, outbound SMS send, and inbound SMS receive all verified working end-to-end.
- [x] **MMS support** (Session 4 complete) — Inbound MMS fully wired and live-tested. Migration `013_message_media.js` added `media_urls` JSONB to `messages`. Webhook handler captures `NumMedia`/`MediaUrl*`, downloads each file with Twilio Basic auth to `backend/uploads/messages/`, stores local paths as JSON string (pg requires `JSON.stringify` for JSONB inserts; reads back as parsed array). Twilio redirects with HTTP 307 to CDN — redirect handler covers 301/302/307/308, drops auth on redirect (CDN doesn't need it). GET messages returns `mediaUrls`. `MessageThreadScreen` renders images inline in the thread (220×165px, `resizeMode: 'cover'`). Empty-body MMS (photo with no caption) handled correctly. `backend/uploads/messages/` auto-created at server startup.
- [ ] **Team member auto-SMS invite code** — currently shows iOS Messages pre-filled; wire to Twilio when credentials available.

### Website
- [ ] **Signup flow → splash page (Session 9 priority)** — The current `/signup` completes a full 5-step A2P business signup that leads into a non-existent app. Needs to be reworked so that completing the form lands users on a splash/waitlist confirmation screen rather than implying immediate app access. Goal: capture intent, set expectations, don't dead-end.
- [ ] **AppShowcase — remaining overlay hotspot screens** — Next Service, Confirmed, and Feedback customer screens still use floating overlay dots. Embed for consistency with all other screens.
- [ ] **Features.tsx** — Add 5th feature card for team member job dispatch (planned but not yet done)
- [ ] **Problem section** — Two weaker cards identified: "Manual Text Messages" title too abstract, "Premium Tools Don't Fit Your Budget" is logical not visceral. Revisit copy.
- [ ] **Phase 1 SEO — GA4 integration** — Add `NEXT_PUBLIC_GA_ID` to `.env.local`, add GA4 `<Script>` tags to `layout.tsx`, add `gtag` form submission event to `EarlyAccessForm.tsx`.
- [ ] **Phase 1 SEO — Google Search Console** — Add `NEXT_PUBLIC_GSC_VERIFICATION` meta tag to `layout.tsx`, verify domain once live.
- [ ] **Phase 1 SEO — og-image.jpg** — Create 1200×630px social share image in `public/`.
- [ ] **Phase 1 SEO — next.config.ts** — Add security headers, cache-control for static assets, image optimization config.
- [x] **Phase 2 Website — Business signup** (Session 4 complete) — `/signup` page live. 3-step flow: business name + phone + scheduling format → OTP verify (Twilio Verify) → account created → success/download screen. Navbar + Hero CTAs updated from `#early-access` to `/signup`. Uses Twilio Verify (`TWILIO_VERIFY_SERVICE_SID` required in `.env`). `otpCode` is optional on the signup endpoint — mobile flow unaffected.
- [x] **Phase 2 Website — Customer signup** (Session 5 complete) — Join code model chosen (not URL slug). `join_code` generated on business creation. `/join/[code]` page live with OTP verification. Business signup success screen shows customer invite link.
- [ ] **Phase 2 Website — Business login on web** — Phone + OTP → JWT → redirect to dashboard. Phase 3 dependency.
- [ ] **Phase 3 Website** — Admin dashboard (tasks, team members, assignments, feedback).
- [ ] **Blog infrastructure** — Routes, templates, content. Phase 2.
- [ ] **Wire EarlyAccessForm to backend** — Currently client-side only. Phase 2.

### Planned Features (Partially Implemented)
- **Job Costing — infrastructure complete + review findings fixed (Session 9)**
  - **All 10 code review findings fixed (July 3, 2026)** — see `shared/specs/SESSION9_REVIEW_FINDINGS.md` for per-item detail. 76/76 tests passing. Highlights:
    - Labor hours now **accumulate as sum-of-on-site-intervals** (recomputed from full geofence event history on each departure) — no longer overwritten by a GPS-jitter re-entry. One labor row per member+job (Rule 6) preserved.
    - Mobile: departure now posted on screen unmount if still on-site (no orphaned arrivals); manual clock-in/out refactored to a single handler with proper `finally` (no stuck spinner); GPS-failure sends `null` coords, not fake `0,0`.
    - Backend: `recordGeofenceEvent()` now verifies `service_assignments`; geofence route rejects NaN coords with 400 and accepts null coords for manual events; `geocodeAddress()` checks HTTP status; dead geocode call removed from `addCustomer()`.
    - **Migration 018 changed** — `geofence_events.lat/lng` are now **nullable** (manual events with no GPS fix). Migration was uncommitted, so it was edited in place and re-run on both DBs rather than adding a 019.
  - Migrations 017 + 018 run on both `task_app_db` and `task_app_test`.
  - New tables: `cost_categories` (seeded with GAAP codes 4000/5000/5100/5200), `job_costs`, `geofence_events`.
  - New columns: `team_members.hourly_rate`, `customers.lat/lng/geocoded_at` (+ `geocode_attempts/attempted_at/relevance` from migration 025), `customer_cycle_assignments.price_per_visit`, `selection_cycles.price`.
  - Mapbox geocoding: fire-and-forget from `businessService.updateCustomerDetails()` on address change (hardened July 20 — see "Geocoding Reliability" below). Env var: `MAPBOX_ACCESS_TOKEN` added to `backend/.env`. Same public token as mobile `config.js`.
  - Geofence endpoint: `POST /api/team-members/:id/jobs/:selectionCycleId/geofence` in `teamMembers.js`. Validates `eventType`/`method`, writes to `geofence_events`, auto-creates `job_costs` labor line on departure (upserts if second departure fires — Business Rule 6).
  - `getJobDetail()` now returns `customerLat`/`customerLng` in the job detail response.
  - Mobile geo-fence: `JobDetailScreen` uses `@react-native-community/geolocation` foreground watchPosition (100m radius, 15s interval). Arrival/departure POSTed automatically via Haversine check. Manual Clock In / Clock Out buttons shown when `lat`/`lng` is null or location permission denied.
  - **Data-model gaps CLEARED + API layer built (Session 10, July 4, 2026)** — `shared/specs/JOB_COSTING_DATA_GAPS.md` is fully resolved. 94/94 tests passing (`backend/src/__tests__/jobCosting.test.js`).
    - **Decisions:** D1 → `job_costs.source` (`auto|manual`); D2 → creation-time price copy + open-cycle backfill; D3 → ~~individual-only labor for v1~~ **Option A shipped Session 17 (July 14)** — team-assigned jobs now record per-member labor; see "Team Labor Costing" below.
    - **Migration `019_job_costing_integrity`** (run on both `task_app_db` and `task_app_test`): `job_costs.source`; open-cycle `price` backfill from `price_per_visit`; partial unique index `job_costs (selection_cycle_id, team_member_id, cost_category_id) WHERE team_member_id IS NOT NULL` (Rule 6); indexes `geofence_events (selection_cycle_id, team_member_id, occurred_at)` + `job_costs (selection_cycle_id)`; `cost_categories` scope-unique indexes; FK ON DELETE — `job_costs.selection_cycle_id` CASCADE, `job_costs.team_member_id` SET NULL (preserve $ history), `geofence_events.*` CASCADE.
    - **Service/API layer built** (routes in `businesses.js`, logic in `businessService.js`):
      - `GET /businesses/:id/cost-categories`
      - `PATCH /businesses/:id/jobs/:selectionCycleId/price`
      - `PATCH /businesses/:id/customers/:customerId/assignments/:assignmentId` (sets `price_per_visit`)
      - `POST` / `PATCH` / `DELETE /businesses/:id/jobs/:selectionCycleId/costs[/:costId]` (manual lines; stamp `source='manual'`; labor-shape validation; Rule-6 409)
      - `GET /businesses/:id/jobs/:selectionCycleId/costs` (price, labor lines w/ source, materials, overhead, totalCost, margin$/%, estimatedHours)
      - `GET /businesses/:id/customers/:customerId/profitability` (completed cycles only)
      - `PUT /businesses/:id/team-members/:memberId` extended to accept `hourlyRate` (existing endpoint, not a new PATCH).
      - `recordGeofenceEvent()` recompute now **skips `source='manual'`** rows (D1 guard); `generateUpcomingSelectionCycles()` copies `price_per_visit → price` at creation (D2).
      - Test helper `truncateAllTables()` now re-seeds the GAAP `cost_categories` system rows (TRUNCATE…CASCADE was wiping them).
  - **UI — Component 1 of 2 DONE (Session 11, July 5, 2026): ServiceCallDetailScreen per-job "Job Costing" section.** Built incrementally + verified in the iOS simulator on a seeded job.
    - `TaskRight/src/api/businessApi.js` — added client calls: `getCostCategories`, `getJobCosts`, `setJobPrice`, `addJobCost`, `updateJobCost`, `deleteJobCost`.
    - `ServiceCallDetailScreen.js` — new section renders Price (tap-to-edit, blank clears → null), Labor table (Member | Est | Actual | Rate | Cost) with per-line **Auto-tracked / Edited** `source` badges + subtotal, null-rate warning banner (Rule 2), ~~team-assigned empty-state (D3)~~ (removed Session 17 — team jobs now list per-member labor), Materials + Overhead single fields (tap-to-edit), Total Cost, and Margin ($/%; "Price not set" per Rule 3, red when negative).
    - Materials/Overhead editors use **POST-if-null / PATCH-if-present**, so repeated edits replace rather than accumulate; blank+Save deletes the line.
    - **Backend touched (additive, agreed):** `getJobCosts` now also returns `materialsCostId` / `overheadCostId` (nullable, single-line ids) — GET previously only exposed summed amounts, so the single-field editor had no id to PATCH. `+2` tests; **95/95 backend tests passing**.
    - Two-blocker env fix along the way (documented so it doesn't bite next session): `@react-native-community/geolocation` pod was never installed (`cd TaskRight/ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install` — the UTF-8 locale works around a CocoaPods 1.16.2 / Ruby 4.0 encoding crash), and Xcode 26.6 needs the **iOS 26.5 simulator runtime** installed (Xcode ▸ Settings ▸ Components).
  - **UI — Component 2 of 2 DONE (Session 12, July 5, 2026): CustomerDetailScreen "Profitability" summary card. ✅ Job-costing UI feature COMPLETE.** Built incrementally + verified in the iOS simulator against two seeded completed cycles (one profitable, one at a loss).
    - `TaskRight/src/api/businessApi.js` — added client calls: `getCustomerProfitability`, `setAssignmentPrice`.
    - `CustomerDetailScreen.js` — new **Profitability** card (2×2 grid: Revenue | Cost | Margin $ | Margin %, green/red on sign) + "N completed jobs" and a tap-to-expand per-job breakdown (each row: date, Ref #, `price − cost`, margin colored green/red, "No price" when null). Empty state ("No completed jobs yet…") when `completedJobCount === 0` — not a zeroed loss card. Aggregates **COMPLETED cycles only** (Rule).
    - Recurring price: **Assigned Cycles rows are now tap-to-edit** — opens the same amount modal to set `price_per_visit` via `PATCH .../assignments/:assignmentId` (blank clears to null). This is the D2 source that auto-copies into new jobs' `price` at cycle creation. Row shows `$X.XX / visit` or a "Set recurring price" prompt.
    - **Backend touched (additive, agreed):** `getCustomerDetails` now also returns `assignmentId` (`cca.id`) + `pricePerVisit` on each `assignedCycles` entry — the detail payload previously exposed only the service-cycle id, so the UI had no assignment id to PATCH nor a current price to display (same shape gap as Component 1's `materialsCostId`). `+1` test; **96/96 backend tests passing**.
- **Review Requests** — `shared/specs/REVIEW_REQUESTS.md`. 3-component build (data+backend → `/review` web page → CustomerDetailScreen opt-out toggle), mirroring the job-costing cadence.
  - **Component 1 of 3 DONE (Session 13, July 5, 2026): data model + backend layer. 108/108 backend tests passing.**
    - **Migration `020_review_tokens.js`** (run on both `task_app_db` + `task_app_test`): new `review_tokens` table (`selection_cycle_id` **UNIQUE** = one-per-job / Rule 3; `customer_id`/`business_id`/`token` uuid-unique; `expires_at`, `sent_at`, `opened_at`, `submitted_at`; all FKs `ON DELETE CASCADE`). `feedbacks.source` (`'in_app'` default | `'sms_request'`) **and `feedbacks.rating` (smallint, nullable)** — *contract gap surfaced + approved this session: the spec's POST body and `/review` page require a 1–5 star rating but `feedbacks` had no column for it, only `feedback_text`; added `rating` nullable so existing in-app rows are unaffected.* `customers.review_requests_opted_out` (boolean, default false).
    - **No-auth endpoints** (`src/routes/review.js`, mounted at `/api/review`, no JWT): `GET /api/review/:token` (sets `opened_at` first load; `{ valid:false }` for missing **or** expired — Rule 4) and `POST /api/review/:token` (`{ rating 1–5, comment? }` → writes `feedbacks` `source='sms_request'` + `rating`, sets `submitted_at`; idempotent Rule 5; 410 expired, 404 missing, 400 bad rating). If in-app feedback already exists for the job, it's updated in place (dodges the `feedbacks` unique(customer_id, selection_cycle_id) collision).
    - **Geofence departure trigger**: `recordGeofenceEvent` departure branch now calls `maybeCreateReviewRequest(selectionCycleId)` — honors opt-out (Rule 2), reuses the existing token on re-exit (Rule 3), inserts the token + fires the review SMS fire-and-forget via `notificationService` (Item 7, dev mode logs to console), and returns `reviewRequestSent` on the result. Guarded so a failure never blocks event recording.
    - **Opt-out toggle**: `PATCH /api/businesses/:id/customers/:customerId` + `updateCustomerDetails` now accept `{ reviewRequestsOptedOut }` (Rule 7); echoed back on the response.
    - Tests: `src/__tests__/reviewRequests.test.js` (12 tests). `truncateAllTables()` extended with `review_tokens`/`geofence_events`/`job_costs`. Live path exercised on Jane (cust 19, biz 22, job 70): departure → token → GET→POST→idempotent-POST → one `feedbacks` row `source='sms_request'` rating 5.
  - **Component 2 of 3 DONE (Session 13, July 5, 2026): the `/review/[token]` Next.js page.** `TaskRight-Website/src/app/review/[token]/page.tsx`, mirrors `/s/[token]` (client component, `NEXT_PUBLIC_API_URL` → `/api/review/:token`). Star selector (1–5, hover-fill + label Poor→Excellent) + optional comment (maxLength 1000) + submit (disabled until a star is picked). `npm run build` passes (route listed as ƒ dynamic). Verified via build only — the website dev server (port 3001) is run by the user, not `preview_start` (memory rule); at build time 3001 was occupied by an unrelated API server, so no live screenshot.
    - **Load states collapse to what GET can distinguish** (the backend returns `{valid:false}` for expired **and** missing — anti-probing decision from Component 1): `ready` (valid + not submitted → form), `submitted` (valid + `alreadySubmitted` → "already shared feedback"), `invalid` (combined "link isn't valid or has expired"). The **expired-specific** message still surfaces on submit — a `410` from POST switches to the `expired` state. Plus `success` after a good POST.
  - **Component 3 of 3 DONE (Session 13, July 5, 2026): CustomerDetailScreen opt-out toggle. ✅ Review Requests feature COMPLETE.** New **"Review Requests"** section on `CustomerDetailScreen.js` (a RN `Switch`, "Pause review requests" + hint) that optimistically flips and PATCHes `/businesses/:id/customers/:customerId { reviewRequestsOptedOut }` (rolls back + alerts on failure). Client reuses the existing `updateCustomerDetails` (arbitrary `data` body) — no new client method.
    - **Backend touched (additive, same pattern as Components 1/2 of job costing):** `GET /businesses/:id/customers/:customerId` now returns `reviewRequestsOptedOut` (the whitelisted detail payload previously omitted it). `+1` test; **109/109 backend tests passing**.
    - Verified via backend tests; the RN sim loop is the user's (memory rule — no `preview_start` for React Native). Suggested manual sim check: toggle on → fire a geofence departure for that customer → confirm no review token/SMS; toggle off → departure creates the token.

### Service Model Overhaul (Per-Customer Services) — COMPONENTS 1–4 DONE → FEATURE COMPLETE (July 5–6, 2026)
- **Spec:** `shared/specs/SERVICE_MODEL.md`. Reworks build-then-assign into per-customer Services created on the customer profile, seeded from an optional template library and decoupled after creation.
- **C1 (data + backend) SHIPPED:** migrations **021** (rename+backfill; shared cycles fanned out) + **022** (enforce NOT NULL + drop legacy col) on both DBs. `service_cycles`→`service_templates`, `customer_cycle_assignments`→`customer_services` (absorbed definition), `task_assignments`→`template_task_assignments`, new `service_task_assignments`, `selection_cycles.service_cycle_id`→`customer_service_id`. Per-customer Service CRUD (`POST|GET|PATCH|DELETE .../customers/:cid/services`). **119/119 backend tests.** Job costing + reviews intact (anchor on `selection_cycle_id`).
- **C2 (customer-profile UI) SHIPPED:** `AssignCycleScreen.js` repurposed into the **Service builder** (create + edit via `serviceId` param; name/frequency/tasks/hours/deadline/price + schedule on create; "start from template"; Delete with `HAS_HISTORY` guard). `CustomerDetailScreen.js` "Assigned Cycles"→**"Services"** (rows tap into the builder; "+ Add Service"); the standalone recurring-price modal folded into the builder's price field (same D2 path). New client calls in `businessApi.js`. Babel-parse clean; **RN sim check is the user's** (memory rule).
- **C3 (Templates browser) SHIPPED:** `ServiceCyclesScreen.js` relabeled into the **Templates** browser (intro copy, "+ New Template", "New/Edit Template", delete note); bottom-tab **Cycles→Templates** (route name kept). `AssignCycleScreen.js` edit mode gains **"Save as Template"** (definition-only snapshot via existing `createServiceCycle`). "Start from template" already in C2. No backend change.
- **C4 (vocabulary cleanup) SHIPPED:** template-CRUD function symbols → `*ServiceTemplate*`; routes `/service-cycles`→`/service-templates` (+ response keys `serviceTemplate(s)`, code `TEMPLATE_NOT_FOUND`); mobile client + callers renamed. **Legacy `POST .../assign-cycle` removed** (seed a Service from a template via `POST .../services {templateId}`). Tests repointed; obsolete `ALREADY_ASSIGNED` case dropped. Forecast's `serviceCycles` field + job-detail `serviceCycleName` left as-is (separate domains). **118/118 tests.**
- **Sim verification (suggested, user-run):** Services → "+ Add Service" (from-scratch + "start from template"; day-of-week for biz 22) → appears + generates calls; edit a Service (name/tasks/price) → Save; "Save as Template" → check it shows in the Templates tab; delete a Service (no completed calls succeeds; completed call → blocked); Templates tab create/edit/delete.

### Service Model — Phase 2: Per-Service Task Ownership — ✅ BUILT (July 8, 2026)
- **Spec:** `shared/specs/SERVICE_TASK_OWNERSHIP.md` (Steps A–E). Closed the last shared-definition seam: **tasks.** The global `tasks` table + Tasks tab are gone; tasks are **owned** per-service (`service_tasks`) and per-template (`template_tasks`).
- **Migration `023_per_service_task_ownership`** (both DBs): create owned tables → backfill from the two junctions (dev: 52 `service_tasks`, 47 `template_tasks`) → remap `selections.selected_tasks` global-id→`service_tasks.id` (via temp `source_task_id`) → drop junctions + `tasks`. `down()` best-effort/lossy. **024 reserved.**
- **Backend:** removed global task CRUD + the 4 `/tasks` routes; service/template payloads take/return **`tasks:[{id?,name,timeAllotmentMinutes}]`**. **Landmine handled:** `updateCustomerService` **diff-upserts** service_tasks by id (update/insert/delete) so live selections never orphan. **104/104 backend tests** (dropped the obsolete `tasks.test.js` suite; reworked service/selection/template/jobCosting/customers/forecast/reviewRequests helpers to inline task objects).
- **Mobile:** `AssignCycleScreen.js` + `ServiceCyclesScreen.js` gained an inline per-resource task editor (add/edit modal + ✕ remove; stable local `_key`, id preserved on edit for diff-upsert). **Tasks tab removed** from `BusinessNavigator.js`; `TasksScreen.js` deleted; task clients pruned from `businessApi.js`. Customer-facing flow unchanged (shape-compatible). Babel-clean; **RN sim check is the user's**.
- **Sim verification (suggested, user-run):** Add/Edit Service → add, edit, and remove tasks inline → Save → reopen to confirm; "Start from template" copies tasks; edit a task on one customer's Service and confirm another customer's identical service is untouched; Templates tab → New/Edit Template with inline tasks; customer selection flow still lists tasks and submits.

#### Follow-up (July 8, 2026) — one-time frequency + price relabel (Service builder)
- **`one_time` frequency (ad-hoc single sale):** added to `VALID_FREQUENCIES` (businessService) + both template-route `validFrequencies` arrays. `generateUpcomingSelectionCycles` generates **1** Service Call for `one_time` (vs 4 for recurring). No migration — `frequency` is `varchar(50)`, no DB constraint. No auto-repeat regeneration exists, so one-time simply never recurs. **105/105 backend tests** (added a one_time = 1-call assertion).
- **Mobile:** `AssignCycleScreen` frequency is now a **picklist** (modal dropdown) with options One-time / Weekly / Biweekly / Monthly / Yearly (replaces the chip row, saves space). Price field relabeled **"Price for Visit (optional)"** (works for one-time or recurring). Date label reads "Service Date" (not "First Service Date") when one_time. Shared `src/utils/frequency.js` `frequencyLabel()` renders `one_time`→"One-time" on the customer profile services list, Templates cards, and the template picker (no raw value leaks). Templates editor frequency chips include One-time so save-as-template round-trips.

#### Follow-up (July 8, 2026) — team-member hourly rate UI
- **Add/Edit hourly rate for team members** now fully wired to job-costing. Backend `team_members.hourly_rate` (numeric) + labor calc already existed; the gaps were: create (`POST team-members`) didn't accept it, the list (`GET team-members`) didn't return it (so Edit couldn't prefill), and there was **no UI field**. Fixed: POST accepts optional `hourlyRate` (non-negative, nullable); GET list returns `hourlyRate`; PUT/POST/GET all coerce `numeric`→`Number`; added non-negative validation on POST + PUT.
- **Mobile:** hourly-rate field ("$ / hr", optional) added to `AddTeamMemberScreen` + `EditTeamMemberScreen` (Edit prefills from `member.hourlyRate`); `TeamScreen` list row shows `$X/hr` in green under the hours badge. Client fns are pass-through. 110/110 backend tests (+4 for create/list/negative/clear).
- **How it rolls into profitability:** the labor line is auto-computed on a **geofence departure** (`amount = hoursActual × hourly_rate`, snapshotted with the rate at that moment). So a newly-set rate applies to labor computed after it's set; historical per-job labor is adjustable on the Service Call detail screen. (Optional future work: a "recompute labor at current rate" action for past open jobs.)

### Create-Flow Team Assignment — ✅ BUILT (July 11, 2026)
- **Spec:** `shared/specs/CREATE_FLOW_ASSIGNMENT.md` (now marked BUILT). Adds a **service-centric** assignment path *inside the create flow* while leaving the **dashboard dispatch view (`ForecastDayScreen`) behaviorally unchanged**. Two entry points, one model: both write `service_assignments` (upsert per `selection_cycle_id`, team_member XOR team). **No migration.**
- **Backend (`businessService.js` + `businesses.js`):**
  - `assertAssigneeOwnedByBusiness(businessId, assignee)` — XOR (exactly one of teamMemberId/teamId → 400) + ownership (team member via `team_members.business_id`, group via `teams.business_id` → 404). Closes the pre-existing ownership gap on the assignment path.
  - `fanOutServiceAssignment` — upserts the assignee across the service's **open** Calls only (never touches completed); idempotent. `assignServiceTeam(businessId, serviceId, assignee)` validates service+assignee ownership then fans out, returns `{ assignedCount }`.
  - `createCustomerServiceForBusiness` takes an optional `assignee` and is **validate-first-then-create**: the assignee's ownership/XOR is checked **before** any row is written, so a bad assignee fails the whole create (400/404, zero rows — no half-create). Then create → fan out. (Chosen over a DB `trx`: same guarantee, no plumbing.)
  - New route `PUT /businesses/:bid/customers/:cid/services/:serviceId/assignment` → `assignServiceTeam` (reuse; bulk reassign-all-open-visits).
- **Mobile:** new shared **controlled** `src/components/AssigneePicker.js` (`value`/`onChange`, `{type:'member'|'group',id,name}|null`; two-step iOS ActionSheet). `ForecastDayScreen` refactored to consume it in **immediate-write** mode (behavior parity — personalized sheet titles preserved via `title`/`subject`). `AssignCycleScreen` gained an optional **create-only** "Assign" section after the schedule block (**deferred** mode: holds a pending `assignee`, applied atomically in the create payload), with frequency-aware copy (`one_time`→"this visit", recurring→"all 4 upcoming visits"), a group labor-note (**since updated by Session 17** — now "Each team member's hours are tracked individually and auto-calculate labor cost at their own rate"), and hidden when the business has no team. Edit mode unchanged. Client `createCustomerService` passes the body through unchanged.
- **Tests:** `backend/src/__tests__/createFlowAssignment.test.js` (+11) — member/team/one_time/neither/XOR/validate-first-zero-rows/completed-untouched/cross-tenant 404s/last-write-wins. **121/121 backend tests.** RN sim check is the user's (no `preview_start`).

### Team Labor Costing — ✅ BUILT (July 14, 2026)
- **Spec:** `shared/specs/TEAM_LABOR_COSTING.md` (marked BUILT). Closes the **D3 gap**: group-assigned Service Calls used to record **no** labor (the four member-facing resolvers filtered on `sa.team_member_id` only, so a team Call was invisible to every member → no geofence → no `job_costs` labor line → profitability blank on the cost side). **No migration.**
- **The structural insight:** labor is already keyed on `team_member_id`, not on assignment type. `recordGeofenceEvent` creates one per-member labor row at that member's own rate (Rule-6 upsert), and `getJobCosts` already returns a per-member `laborLines[]`. The only thing missing was **visibility** — so broadening the resolvers to "individual OR member of the assigned team" makes the whole downstream chain work unchanged (Option A / TL1).
- **Backend (`businessService.js`):** added shared `isMemberAssignedToCall` / `assertMemberAssignedToCall` (predicate: `sa.team_member_id = member OR sa.team_id IN (member's team_memberships)`). Broadened `getJobsForTeamMember` (+ returns `isTeamAssigned`/`teamName`), `getJobDetail`, `completeJobForTeamMember`, `recordGeofenceEvent` (all four now gate through the shared helper). Per-member rate snapshot (TL2); null rate → $0.00 with hours (Rule 2). First-to-complete-wins is already the semantics — a later member's complete returns `409 ALREADY_COMPLETED` (TL3).
- **No DISTINCT needed (TL4):** `service_assignments.selection_cycle_id` is UNIQUE → the sa join yields ≤1 row per cycle; the "assigned both individually and via team" case is structurally impossible, and the OR-predicate can't multiply a match. Dedup is structural.
- **Mobile:** `MyJobsScreen` shows a "Team · {name}" badge on group jobs (same payload shape otherwise). `JobDetailScreen` renders the first-wins 409 as "A teammate already marked this service complete" (refreshes into completed) and keeps **Clock Out** available when a member is still clocked in on a completed job (so manual-path hours still record). Owner side: removed the `ServiceCallDetailScreen` D3 "no auto labor" empty-state (labor table now lists each group member) and updated the `AssignCycleScreen` group note. Babel-checked; **RN sim check is the user's** (no `preview_start`).
- **Tests:** `backend/src/__tests__/teamLaborCosting.test.js` (+15) — visibility (member sees / non-member doesn't), gates (404 for non-member), single + multi-member auto labor, margin, null-rate, first-wins completion + post-complete labor, dedup, individual-only regression. **136/136 backend tests.**
- **Deferred (noted, not built):** Twilio-supplemented SMS clock-in for app-less team members (so labor can be captured without the app) — a separate follow-on that builds on `routes/webhooks.js` keyword handling.

### Service Call Lifecycle — ✅ BUILT (July 14, 2026)
- **Spec:** `shared/specs/SERVICE_CALL_LIFECYCLE.md` (marked BUILT). A created service's Calls are legible immediately — the per-Call detail screen shows the **proposed/expected** scope in flight, then switches to **confirmed** (customer's submitted selection) and **actual** (completion + labor/margin). **No migration, no new endpoints** — pure read/derive + presentation over the existing model.
- **The anchor:** the proposed scope already exists on the service definition (`customer_services.total_hours`/`price_per_visit` + the default `service_tasks` menu). The Call detail endpoint just wasn't surfacing it, and the screen rendered `selected_tasks` **ids** as "Task N" (latent bug, now fixed by resolving ids→names in the payload).
- **Backend (`businessService.js`):** `getServiceCallDetail` now fetches the default menu + service definition + D2 price and returns a derived `lifecycleState` (`completed` > `confirmed` [submitted selection] > `proposed`; a `draft` is **not** a confirmation) plus a resolved `tasks[]` (`{id,name,minutes,source:'proposed'|'confirmed'}`), `expectedHours` (`total_hours`), `confirmedHours` (Σ selected minutes ÷ 60; null unconfirmed), `expectedPrice` (`selection_cycles.price`), and `scopeIsAssumed` (SCL7 — completed with no submitted selection falls back to the menu, never empty). Numeric fields `Number()`-coerced. **Backward-compatible:** kept `selectedTasks`/`selectionStatus`. `getCustomerDetails.upcomingServices[]` gains a `lifecycleState` (`proposed`/`confirmed`) via a batched `selections` lookup for the list badge.
- **Mobile:** `ServiceCallDetailScreen` — lifecycle header chip (amber Proposed / blue Confirmed / green Completed), muted proposed task rows + a scope caption, an Expected↔Confirmed Hours row, and a "Price (Expected)" qualifier while not completed. `CustomerDetailScreen` upcoming rows show the matching lifecycle badge. Babel-checked; **RN sim check is the user's** (no `preview_start`).
- **Build decisions (resolved during build, noted in the spec):** kept the Job Costing section **always-visible** rather than gating it behind `completed` — the "Price (Expected)" qualifier needs it pre-completion and gating would remove early price/materials entry (contradicts §5.2's own Price bullet). Live route path is `.../selection-cycles/:id` (spec calls it `service-calls` in prose — not renamed; mobile client already uses `selection-cycles`).
- **Tests:** `backend/src/__tests__/serviceCallLifecycle.test.js` (+7) — proposed (full menu, null confirmedHours), draft-stays-proposed, confirmed (resolved names + confirmedHours), "Task N" regression, completed-confirmed (`scopeIsAssumed=false`), completed-SCL7-fallback (`scopeIsAssumed=true`, non-empty), ownership 404. +1 in `customers.test.js` (upcoming badge proposed→confirmed). **144/144 backend tests** (+8).
- **Proposed Job Costing / Expected Margin extension — ✅ BUILT (July 15, 2026, spec §9):** the proposed state now also shows the **expected labor cost + margin** so the owner sees profitability before the job runs. `getJobCosts` gains `proposedLabor` (= `proposedLaborHours × Σ assignee rates`; `proposedLaborHours = confirmedHours ?? expectedHours`), `proposedLaborBreakdown`, `expectedLaborIncomplete`, `expectedTotalCost`, `expectedMarginDollars/Percent`. **PJC1:** group labor = `hours × Σ(member rates)` (whole crew on-site for the full duration). **PJC4:** an unrated member counts as $0 and flags `expectedLaborIncomplete` — the owner still sees a floor, never blank. Also **fixed** `estimatedHours` returning 0 pre-selection → falls back to `expectedHours`. Mobile `ServiceCallDetailScreen` renders a **Proposed Labor** group + **Expected Total Cost / Expected Margin** while not completed; actual per-member labor table + actual Total/Margin at completion. **No migration, no new endpoint.** Tests: `proposedJobCosting.test.js` (+7). **151/151 backend tests.**

### Day-of-Week Day Snapshot Parity — ✅ BUILT (July 17, 2026)
- **Spec:** `shared/specs/DOW_DAY_SNAPSHOT.md`. Parity fix: day-of-week owners can now review "what's already scheduled on this day" during service create — the same view date-based owners get. **Mobile-only; no backend change, no migration, no new endpoint.**
- **The gap:** in `AssignCycleScreen` create mode, the date-based branch taps a date → `ServiceDaySnapshot` (day overview + active cycles) → Confirm; the day-of-week branch only had an inline volume-dot calendar that set the start date with no detail review.
- **Change:** added a "Review {Weekday} — see what's scheduled ›" button below the "Starting: …" label (shown once a weekday + start date are chosen). It reuses the exact date-based navigation — `forecast.find(f => f.serviceDate === startDate)` → `navigation.navigate('ServiceDaySnapshot', { date: startDate, forecastItem })`. `ServiceDaySnapshotScreen` reused **unchanged** (presentational; handles the empty state). Chose a button over hijacking the inline calendar's tap-to-set so quick start-date selection isn't disrupted (DOW1–DOW3). Babel-checked; **RN sim check is the user's**.
- **Post-build fix (same day):** the new button surfaced a **pre-existing** bug (also in the date-based flow) — `ServiceDaySnapshot`'s "Confirm This Date" used `navigation.navigate('AssignCycle', { confirmedDate })`, which on **React Navigation v7** pushed a *fresh blank* AssignCycle (v7 only reuses an existing screen when params also match; the live one had `{customerId,…}`). Fixed with `navigation.popTo('AssignCycle', { confirmedDate: date }, { merge: true })` — pops back to the origin screen by name, merge keeps its params. Repairs both day-of-week and date-based confirm paths. **⚠️ v7 gotcha to remember: `navigate(name, params)` won't go back to an existing screen if params differ — use `popTo` for "return to a prior screen."**
- **Deferred — flavor 2:** weekday aggregate ("typical Tuesday" — filter `forecast` by weekday + roll up hours/cycles over the ~4 occurrences in the 30-day window). Also no backend change. Revisit if owners ask for a recurring-load overview.

### Customer Create Flow → Detail Screen — ✅ BUILT (July 19, 2026)
- **Mobile-only; no backend change, no migration, no new endpoint.** After **Add Customer** (name + phone), the flow advances into the existing `CustomerPreferencesScreen` (email / service address / Preferences & Notes) instead of `goBack()` to the list.
- **Change:** `AddCustomerScreen.handleAdd` now `navigation.replace('CustomerPreferences', { customerId, customerName, fromCreate: true })` using the id returned by `addCustomer`. `CustomerPreferencesScreen` reads `fromCreate`: when set, **Save Details** and **Cancel** both `navigation.replace('CustomerDetail', { customerId, customerName })` (a `leave()` helper) — landing on the new customer's detail screen, ready to **Add Service**, with the header back arrow returning to the list (stack is `[List, CustomerDetail]`). Editing an existing customer's details (opened from `CustomerDetail`) is unchanged — `fromCreate` absent → still `goBack()`. Babel-checked; **RN sim check is the user's**.

### Per-Day Booked-Hours on Calendars (App Scheduler — Option B) — ✅ BUILT (July 19, 2026)
- **Product decision:** hourly/appointment-time scheduling belongs on the **website portal**; the **app** gets a simple per-day **hours-count** view (Option B). Option A (appointment start-times: migration + time picker + backend) was scoped then **halted** in favor of B. Don't add `start_time` columns for the app.
- **Mobile-only; no backend change, no migration, no new endpoint** — reuses the `totalHours` per day already returned by `getBusinessForecast`.
- **New shared component:** `TaskRight/src/components/HoursCalendarDay.js` — a react-native-calendars `dayComponent` that renders the date number **plus the hours booked that day** beneath it. Props: `hoursByDate` map, optional `colorByDate` map (explicit per-date circle fill), `onDayPress`.
- **Wired into** `AssignCycleScreen` (the create-flow date-picker modal + the day-of-week inline calendar — daily load visible while allotting a service) and `DashboardScreen` calendar view. On the Dashboard each service day's circle is filled by submission-status colour via `colorByDate` (blue pending / amber mixed / green all-submitted), matching the legend — done explicitly rather than relying on `marking.selected` propagating through the custom cell. Babel-checked; **RN sim check is the user's** (colours confirmed by user).

### Geocoding Reliability — ✅ BUILT (July 20, 2026)
- **Spec:** `shared/specs/GEOCODING_RELIABILITY.md`. Migration 025 + backend + mobile owner-UI note. **165/165 backend tests** (+14, `geocoding.test.js`).
- **The problem:** team-member auto-geofence clock-in gates on `customers.lat/lng`, populated only by a **fire-and-forget** geocode with **zero failure memory** — one transient Mapbox/network blip left coords blank *permanently* (no retry). Surfaced via Renee Wells' job showing "No address on file — using manual tracking" despite a valid address; 8 of 9 addressed customers were un-geocoded. Also: Mapbox rarely returns "no match" — it returns a **confident-wrong** fuzzy match (two test rows → "South Wales, NY").
- **Three layers:**
  1. **Reliable on-write** — `geocodeAddress`→**`geocodeCustomer`** (awaitable; records the attempt *before* the network call so a hang counts toward the cap, G2) + **relevance gate** (`GEOCODE_MIN_RELEVANCE = 0.8`): below it, record the relevance but **do not store coords** (G1 — a wrong pin is worse than manual). `updateCustomerDetails` **resets** coords + relevance + attempts whenever the address changes/clears (the self-heal hook).
  2. **Bounded background retry** — `jobs/geocode-retry.js` (hourly), selects via `findCustomersNeedingGeocode()` (address, no coords, `attempts < GEOCODE_MAX_ATTEMPTS = 3`, past `GEOCODE_RETRY_BACKOFF = '6 hours'`). Finite by construction; wired into `server.js`. **Geocode-on-read was rejected** (couples the request path to Mapbox, no throttle).
  3. **Owner-visible flag** — `getCustomerDetails` returns derived `geocodeStatus` (`none|ok|pending|failed`) + `geocodeRelevance`; `CustomerDetailScreen` shows "couldn't map this address for automatic clock-in — check the address" only on terminal `failed`.
- **Also shipped (investigation):** `JobDetailScreen` copy fix — "Address not mapped yet — using manual tracking" when an address exists but coords don't (vs "No address on file"). One-off backfill geocoded the 8 legacy customers (Renee now auto-geofences).
- **Deferred:** list-level geocode indicator in `getCustomersByBusiness`; business/team-member address geocoding; surfacing the low-confidence candidate as a "did you mean?" accept.

### Open Questions / Future Decisions
- Twilio webhook signature validation — subaccount webhooks are signed with the subaccount's auth token, which we don't store. Current approach: no validation (dev acceptable). Production options: store auth token at provisioning time, or use Twilio IP allowlisting.
- Pagination on list endpoints (customers, history) — deferred to Phase 2. Messages endpoint uses cursor pagination already.
- App Store deployment workflow — not started.

---

## Common DB Queries (psql)

```bash
# Connect
/opt/homebrew/opt/postgresql@18/bin/psql task_app_db

# See businesses
SELECT id, name, phone_number, scheduling_format FROM businesses;

# See customers for a business
SELECT id, name, phone_number FROM customers WHERE business_id = 1;

# See selection cycles (upcoming service calls)
SELECT id, customer_id, service_date, status FROM selection_cycles ORDER BY service_date;

# See team members + invite codes
SELECT id, name, phone_number, invite_code FROM team_members WHERE business_id = 1;

# See service assignments
SELECT sa.id, sa.selection_cycle_id, tm.name as member, t.name as team
FROM service_assignments sa
LEFT JOIN team_members tm ON sa.team_member_id = tm.id
LEFT JOIN teams t ON sa.team_id = t.id;

# Check Twilio provisioning status for all businesses
SELECT id, name, twilio_provisioning_status, twilio_phone_number FROM businesses;

# See SMS message history for a customer
SELECT direction, body, created_at FROM messages WHERE business_id = 1 AND customer_id = 5 ORDER BY created_at;

# Reset test data (preserves businesses/customers)
DELETE FROM service_completions;
DELETE FROM selections;
DELETE FROM selection_cycles;
```

---

## Error Patterns

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No script URL provided" | Metro not running | Start `npm start` in Terminal 1 BEFORE simulator |
| "Network request failed" | Backend not running | `brew services start postgresql@18 && cd backend && npm run dev` |
| "Invalid Date" on job tiles | ISO string not split before Date() | `String(dateStr).split('T')[0]` then append `T12:00:00` |
| "property 'X' doesn't exist" | Hermes: undefined identifier in JSX | Missing import — check component imports |
| Customer login fails | Phone stored as E.164, input lacks country code | normalizePhone() in phoneUtils.js handles this now |
| SMS date shows "Mon May 18 2026 00:00:00 GM..." | Knex returns date columns as Date objects, not strings — `String(dateObj).split('T')[0]` breaks | Use `new Date(val).toISOString().split('T')[0]` — fixed in `businessService.js` welcome + completion notifications |
| MMS insert fails: "invalid input syntax for type json" | pg driver doesn't auto-serialize JS arrays for JSONB columns | Use `JSON.stringify(array)` on insert; pg reads JSONB back as parsed JS array automatically |
| MMS download fails: HTTP 307 | Twilio redirects to CDN with 307 (Temporary Redirect), not just 301/302 | Redirect handler in `webhooks.js` covers 301/302/307/308, drops auth header on redirect |
| Web signup: "Phone number must be in E.164 format" | `validateBusinessSignup` runs before `normalizePhone()` — display-formatted input fails | Normalize phone before validation in signup handler — `const phoneNumber = normalizePhone(rawPhone)` |
| Day-of-week assign loops | Navigation to ServiceDaySnapshot resets state | Day-of-week path now directly calls setStartDate() |

---

## Backend Route Pattern (reference)

```js
router.get('/:businessId/some-resource', requireBusiness, async (req, res) => {
  try {
    const result = await businessService.someFunction(req.business.id);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ success: false, error: err.message });
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

Errors thrown from service layer use: `throw Object.assign(new Error('msg'), { code: 'NOT_FOUND', statusCode: 404 })`

---

## Website Component Map

```
TaskRight-Website/src/
├── app/
│   ├── layout.tsx      ← metadata, JSON-LD schemas, global styles
│   ├── page.tsx        ← section order + page metadata
│   ├── robots.ts       ← robots.txt generation
│   └── sitemap.ts      ← sitemap.xml generation
└── components/
    ├── Navbar.tsx
    ├── Hero.tsx
    ├── PersonaCards.tsx  ← NEW (Session 8) — 3-column Customer/Team/Business persona section
    ├── Problem.tsx
    ├── Features.tsx
    ├── HowItWorks.tsx
    ├── AppShowcase.tsx   ← embedded hotspot architecture (Session 8)
    ├── FounderStory.tsx
    ├── FAQ.tsx
    ├── EarlyAccessForm.tsx
    └── Footer.tsx
```

### AppShowcase Embedded Hotspot Architecture (Session 8)
`AppShowcase.tsx` uses an embedded dot model — hotspot dots live inside each mock component rather than as absolute-positioned overlays on the phone frame. Key types and components:
- `HotspotDot` — shared `<button>` component. Pulsing blue when inactive, solid green when active. Always calls `e.stopPropagation()` to prevent click bubbling to parent interactive elements.
- `RenderParams` type — `{ onCalViewChange?, activeHotspot?, onHotspotTap? }` passed into every screen's `render()` lambda.
- `embedsHotspots: boolean` on Screen definition — when true, parent overlay rendering is skipped entirely.
- Dot placement pattern: only `idx === 0` card in any mapped list receives dots (avoids clutter on repeated rows).
- Tab-aware dots: dots inside conditional JSX branches (Members tab, Groups tab) only render in the correct view state.

Screens with embedded dots: BusinessDashboard, BusinessCustomer, BusinessServiceCycle, BusinessTeam, TeamMemberJobDetail, CustomerMyService, CustomerHistory.
Screens still using overlay dots: BusinessServiceDay, TeamMemberMyJobs, CustomerNextService, CustomerConfirmed, CustomerFeedback.

---

**Status as of May 27, 2026 (Session 8):** Mobile MVP feature-complete. Backend 76/76 tests. Website landing page fully updated for a production-ready presentation: PersonaCards section added, CTAs changed to "Get TaskRight" in orange, emojis removed sitewide, AppShowcase embedded hotspot architecture applied to 7 screens, CustomerTaskPicker redesigned as tap-to-rank prioritization UI, timing metrics removed from customer task views, port conflict fixed (website hardcoded to 3001).

**Next session (Session 9) priority:** Rework `/signup` flow so completing the form leads to a splash/waitlist confirmation screen instead of implying immediate app access. The current 5-step A2P flow is built for the real product launch — for now, users need to land somewhere that captures their intent and sets accurate expectations without dead-ending at a non-existent app download.
