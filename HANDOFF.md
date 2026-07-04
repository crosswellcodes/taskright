# TaskRight — Handoff Document
**Last updated: July 3, 2026 (Session 9 — job costing review findings fixed)**

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
- **Test suite**: 70/70 passing (`npm test`, uses `task_app_test` DB)

### Database Schema (PostgreSQL 18, Knex)
Migration files: `backend/migrations/001_initial_schema.js` through `016_a2p_registration.js` (all run on both `task_app_db` and `task_app_test`).
- `013_message_media.js` — `media_urls` JSONB on messages
- `014_business_join_code.js` — `join_code` on businesses (Session 5)
- `015_sms_keywords.js` — `pending_sms_action` on customers; `customer_note`, `selection_token`, `selection_token_expires_at` on selection_cycles (Session 5)

Key tables:
- `businesses` — id, name, phone_number, scheduling_format ('date_based' | 'day_of_week'), twilio_subaccount_sid, twilio_phone_number, twilio_messaging_service_sid, twilio_provisioning_status ('pending'|'active'|'failed'|'dev_mode'), join_code (varchar 12, unique — for customer invite links `/join/[code]`), entity_type ('sole_prop'|'llc_corp'), contact_first_name, contact_last_name, contact_email, business_street, business_city, business_state, business_zip, a2p_brand_sid, a2p_campaign_sid, a2p_registration_status ('pending'|'approved'|'failed')
- `customers` — id, business_id, name, phone_number, address, notes, pending_sms_action (nullable varchar — 'note_pending' when waiting for N follow-up)
- `service_cycles` — id, business_id, name, frequency, total_hours
- `customer_cycle_assignments` — id, customer_id, service_cycle_id, total_hours, start_date, day_of_week (nullable)
- `selection_cycles` — id, service_cycle_id, customer_id, service_date, submission_deadline, status ('open'|'completed'), customer_note (text nullable — set via SMS 'N' keyword, visible to team member in job detail), selection_token (varchar 36 unique nullable — 7-day expiry, for SMS 'T' keyword link), selection_token_expires_at (timestamptz nullable)
- `selections` — id, selection_cycle_id, customer_id, selected_tasks (JSONB), status ('draft'|'submitted')
- `tasks` — id, business_id, name, description, time_allotment_minutes
- `task_assignments` — links tasks to service cycles
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
- [ ] **Day-of-week backend migration** — `002_scheduling_format.js` in `backend/migrations/`. Schema columns exist in service layer but the migration file needs to be created and run. See SPEC/plan for exact SQL.
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
  - New columns: `team_members.hourly_rate`, `customers.lat/lng/geocoded_at`, `customer_cycle_assignments.price_per_visit`, `selection_cycles.price`.
  - Mapbox geocoding: fire-and-forget in `businessService.addCustomer()` and `updateCustomerDetails()`. Env var: `MAPBOX_ACCESS_TOKEN` added to `backend/.env`. Same public token as mobile `config.js`.
  - Geofence endpoint: `POST /api/team-members/:id/jobs/:selectionCycleId/geofence` in `teamMembers.js`. Validates `eventType`/`method`, writes to `geofence_events`, auto-creates `job_costs` labor line on departure (upserts if second departure fires — Business Rule 6).
  - `getJobDetail()` now returns `customerLat`/`customerLng` in the job detail response.
  - Mobile geo-fence: `JobDetailScreen` uses `@react-native-community/geolocation` foreground watchPosition (100m radius, 15s interval). Arrival/departure POSTed automatically via Haversine check. Manual Clock In / Clock Out buttons shown when `lat`/`lng` is null or location permission denied.
  - **Not yet built:** job costing views on ServiceCallDetailScreen/CustomerDetailScreen, team member rate endpoint, price endpoint, customer profitability aggregate endpoint, cost categories GET endpoint.
- **Review Requests** — `shared/specs/REVIEW_REQUESTS.md`. New table: `review_tokens`. New columns: `feedbacks.source`, `customers.review_requests_opted_out`. Migration 019. Triggered by geo-fence departure; sends SMS immediately with `/review/[token]` link.

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
