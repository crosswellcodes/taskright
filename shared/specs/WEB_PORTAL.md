# TaskRight Business Web Portal — Design Spec

**Status:** 🟡 M0 + M1 BUILT (Oct 12, 2026); M2 + M3 BUILT (Oct 13, 2026); M4 BUILT (Oct 14, 2026), awaiting review before M5. M5–M7 not started.
**Author:** Session of Oct 12, 2026.
**Read with:** `HANDOFF.md` (current state), `shared/API_REFERENCE.md` (endpoints), `shared/DESIGN_SYSTEM.md` (tokens/components), `shared/specs/EARLY_ACCESS_PAYMENT`/Stripe notes (billing — folded in here as Module 7).

## 0. Purpose & vision

The authenticated **business-owner web portal** — the face of TaskRight for our paying customers (the businesses). It surfaces capability the backend already has in a web-native way, curated into a small, intentional toolset. **All seven modules ship at go-live.** Build order is **customer-value-first**; the **transaction/billing layer is the final milestone** (you must have the product before you charge for it).

Module order (fixed — drives the build):
1. **Home / Today** · 2. **Schedule** · 3. **Customers** · 4. **Messages** · 5. **Team** · 6. **Money** · 7. **Account & Billing**

## 1. Goals & principles
- **Surface built capability, don't reinvent it.** ~90% of reads/writes already exist as `/api/businesses/*` endpoints (inventory in §4). The portal is largely a web client over them, plus a handful of new aggregate endpoints.
- **Web-native where the phone can't compete** — a desktop SMS inbox, a customer/team **map** (we store geocoded lat/lng), a profitability dashboard, a live clock board.
- **Intentional toolset** — seven modules, no clutter. Second-tier ideas are explicitly deferred (§6).
- **Reuse the mobile contracts** — same JWT business auth, same endpoints the RN app calls; no divergent backend.
- **Billing is a module, not the point** — hosted Stripe, card data never touches our servers.

## 2. Architecture
- **Where:** the existing Next.js marketing site (`TaskRight-Website/`, port 3001). New authenticated area under `/dashboard/*`.
- **Auth (DECIDED: httpOnly cookie):** phone + OTP → JWT (backend `POST /api/auth/businesses/login` **already exists**). The JWT lives in an **httpOnly, Secure, `SameSite=Lax` cookie** (JS can't read it → immune to XSS token theft — the right posture for a portal that handles payment). Implication: the API expects a `Bearer` header (the RN app) and site(3001)/API(3000) are cross-origin → the **Next.js server acts as a BFF**: it holds the cookie and forwards the bearer to `/api/businesses/*` server-side, keeping the token out of browser JS and sidestepping cross-origin cookie issues. `SameSite=Lax` covers CSRF for same-site use. 24h JWT → 401 triggers silent re-login. (RN app is unchanged — header-bearer as today.)
- **Data:** calls the existing backend (`localhost:3000` in dev). No new DB for modules 1–6 except small aggregate support; Module 7 adds billing columns.
- **Design:** `DESIGN_SYSTEM.md` tokens; responsive (owners will use laptop + phone browser); the marketing site's existing component vocabulary.
- **Billing:** Stripe (Customer + hosted Checkout one-time + Customer Portal) + a signature-verified webhook. (Reuses the event-driven/webhook discipline from the SignalHouse work; no provider seam — Stripe isn't getting swapped.)
- **Website verification rule (memory):** the user runs `next dev` on 3001 — do **not** `preview_start`; verify with `npm run build`.

## 3. Module 0 (foundation, pre-req to all): Web auth + dashboard shell
Not a feature tile — the scaffolding everything sits in.
- Login page (phone → OTP → JWT), session persistence, protected-route wrapper, logout, 401 handling.
- App shell: left nav (the 7 modules), top bar (business name, account menu), responsive layout.
- A shared API client (JWT attach, error normalization) mirroring the RN `api/client.js`.
- **Backend:** login exists; **new:** `GET /api/businesses/:id` (self business profile — currently no self-GET; needed for the shell header + Account module).

## 4. The seven modules
Each: **Purpose · Widgets (⭐ = web-native standout) · Backs onto (existing) · New backend · Go-live vs fast-follow.**

### 1. Home / Today
- **Purpose:** the daily "what needs me" landing screen.
- **Widgets:** ⭐ **Action Center** (service calls awaiting customer confirmation, past-deadline, unassigned upcoming, unread messages, failed SMS) · **Today's schedule** · ⭐ **On-the-clock board** · **This-week strip** · **Revenue/margin snapshot (MTD)** · **Recent reviews**.
- **Backs onto:** `GET /:id/selections`, `GET /:id/assignments`, `GET /:id/customers/:cid/profitability`, team-member `active-clock`, messages.
- **New backend:** a **Home summary / action-center aggregate** endpoint (today + counts + attention items in one call) — composing these client-side from N endpoints would be chatty. Revenue snapshot = a business-wide rollup (see Money).
- **Go-live:** Action Center + Today + week strip + a lean revenue number. **Fast-follow:** richer snapshot once Money's aggregates land.
- *Sequencing note:* Home is built first (landing page) but some widgets enrich as later modules deliver their aggregates — ship lean, enrich.

### 2. Schedule
- **Purpose:** see and manage service calls.
- **Widgets:** **Forecast calendar** (month; calls by day) · **Service-call detail** (lifecycle proposed→confirmed→completed, tasks, assignment, reschedule) · ⭐ **Pipeline view** (lifecycle as kanban — fast-follow) · **Day snapshot**.
- **Backs onto:** `GET /:id/selections` (all calls), `GET /:id/selection-cycles/:scid` (lifecycle detail — already returns `lifecycleState`, resolved `tasks[]`, expected/confirmed hours/price), `PATCH .../reschedule`, `PUT /:id/assignments/:scid`.
- **New backend:** possibly a calendar-ranged feed (by month) if `/selections` isn't date-filterable; otherwise none.
- **Go-live:** calendar + call detail + reschedule + assign. **Fast-follow:** pipeline kanban, drag-to-reschedule.

### 3. Customers
- **Purpose:** the CRM spine.
- **Widgets:** **Customer list** (search) · **Customer detail** (services, upcoming calls, profitability card, messages shortcut, review opt-out) · ⭐ **Map view** (geocoded pins; today's jobs highlighted) · **Add/edit customer + services + tasks**.
- **Backs onto:** `GET/POST /:id/customers`, `GET/PATCH/DELETE /:id/customers/:cid` (detail returns assignedCycles, pricePerVisit, reviewRequestsOptedOut, lat/lng), service + service-task CRUD, `GET .../profitability`.
- **New backend:** ensure `GET /:id/customers` (list) includes `lat/lng` for the map (detail has it; list may not) — small addition or a dedicated `customers/map` feed.
- **Go-live:** list + detail + CRUD + map. **Fast-follow:** route/territory optimization on the map.

### 4. Messages
- **Purpose:** a desktop comms console — the clearest web-over-phone win.
- **Widgets:** ⭐ **Unified SMS inbox** (all customer threads, unread badges, search) · **Thread view** (bubbles + MMS media) · **Compose/reply**.
- **Backs onto:** `GET /:id/customers/:cid/messages`, `POST /:id/customers/:cid/messages` (both exist, per-customer).
- **New backend:** **cross-customer inbox endpoint** — "recent threads across all customers with last-message + unread" (current API is per-customer only). This is the main net-new piece for the module. (Unread state may need a `read_at`/lastSeen concept — small schema add, or derive from a per-business "last viewed" marker.)
- **Go-live:** inbox + thread + send (incl. media render). **Fast-follow:** templates/canned replies, keyword-automation visibility.

### 5. Team
- **Purpose:** manage the crew and see who's working.
- **Widgets:** **Members** (CRUD, hourly rate, invite codes) · **Groups** · **Assignments** · ⭐ **On-the-clock board + map** (live clock-ins w/ location) · **Utilization** (hours + labor cost per member — fast-follow) · **Job history per member** (fast-follow; a pending backlog item).
- **Backs onto:** team-members CRUD, groups CRUD, `GET/PUT/DELETE /:id/assignments`, team-member `active-clock` + `geofence_events`.
- **New backend:** a **business-facing "all active clocks" board** (today's `active-clock` is per-team-member under `requireTeamMember`); utilization + job-history aggregates are net-new.
- **Go-live:** members + groups + assignments + a basic live clock board. **Fast-follow:** utilization analytics, per-member history, location map.

### 6. Money
- **Purpose:** the differentiator — true job-cost & margin visibility.
- **Widgets:** ⭐ **Profitability dashboard** (revenue / cost / margin — overall, by customer, by service) · **Job costs per call** (labor/materials/overhead, auto vs edited) · **Expected-vs-actual margin** · **Cost-category breakdown (GAAP)** · **Trends over time** (fast-follow).
- **Backs onto:** `GET /:id/cost-categories`, `GET /:id/jobs/:scid/costs`, job-cost CRUD, `PATCH .../price`, `GET /:id/customers/:cid/profitability` (per-customer, completed cycles).
- **New backend:** a **business-wide profitability/margin rollup** (current profitability is per-customer only) + optional **time-series** for trends.
- **Go-live:** overall + per-customer profitability, per-call costs, margins. **Fast-follow:** trend charts, exportable reports.

### 7. Account & Billing  (FINAL milestone — the transaction layer)
- **Purpose:** account management + monetization via a **lifetime deal (LTD)**.
- **Model (DECIDED):** early access is a **one-time LTD — pay once, service forever.** These first users are **grandfathered**: when TaskRight later pivots to subscription-only, LTD holders keep forever-service (new/premium features added then are a *separate* conversation, not retroactively billed). **Payment does NOT gate portal access** (see decision §9.2) — the LTD is a commitment/entitlement, not a doorlock.
- **Widgets:** **Billing** (buy the LTD; see receipt/entitlement status) · **Provisioning status** (SMS number/brand/campaign + A2P, plainly surfaced) · **Business profile** (name, contact, address, entity type, scheduling format) · **Customer invite link / join code**.
- **Billing design (Stripe, one-time LTD):**
  - Stripe **Customer** per business (`stripe_customer_id`); **hosted Checkout** (`mode:'payment'`, LTD Price, `client_reference_id=businessId`). Stripe emails the receipt.
  - **Webhook** `/api/webhooks/stripe` — signature-verified (`stripe.webhooks.constructEvent`); on `checkout.session.completed` → stamp the **lifetime entitlement**; never fulfill on the client redirect; idempotent (dedupe on event id).
  - **DB:** `businesses`: `stripe_customer_id`, `plan` (`null` | `early_access_ltd` | future sub tiers), `ltd_purchased_at`, `stripe_session_id`. `plan='early_access_ltd'` = grandfathered-forever; the future subscription pivot checks this and **skips billing for LTD holders**. (No `current_period_end` — one-time, no recurring.)
  - **Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`; dev-mode fallback (no key → console-log; tests use Stripe **test mode + test cards** — full free end-to-end validation, unlike SignalHouse).
  - **Customer Portal:** **deferred** — a one-time LTD has nothing recurring to self-manage and Stripe emails receipts. It becomes relevant at the **subscription pivot** (manage card/invoices/cancel); the Customer object we create now is the on-ramp.
- **Backs onto:** `PATCH /:id/kyc` (exists), business row (provisioning fields).
- **New backend:** the Stripe layer (checkout endpoint + webhook) + `GET /:id` profile (shared with M0).
- **Go-live:** buy LTD + see entitlement/receipt + provisioning/account/profile. **Fast-follow (the pivot):** subscription tiers + Customer Portal, with LTD holders exempt.

## 5. New backend work (summary — honest gap list)
Most endpoints exist. Net-new for the portal:
1. `GET /api/businesses/:id` — self business profile (M0, Account).
2. **Home summary / action-center aggregate** (M1).
3. **Business-wide profitability/margin rollup** (+ trends) (M6; Home snapshot reuses it).
4. **Cross-customer unified inbox feed** + unread/last-viewed marker (M4).
5. **Business-facing active-clock board** aggregate (M5).
6. `GET /:id/customers` to include `lat/lng` (or a `customers/map` feed) (M3).
7. **Stripe billing**: checkout endpoint + signature-verified webhook + `businesses` billing columns + env (M7).
8. (fast-follow) utilization + job-history-per-member aggregates (M5).

Everything else is frontend over existing contracts.

## 6. Explicitly deferred (fast-follow, not go-live)
Pipeline kanban, map route optimization, team utilization analytics, job-history-per-member, Money trend charts/exports, messaging templates, recurring subscription billing, full standalone Reputation module (a small reviews widget lives on Home for go-live).

## 7. Build milestones
Customer-value first; transaction last. Each milestone: implement → `npm run build` green (website) + backend tests green for any new endpoints → review → next.

- **M0 — Foundation:** ✅ **BUILT (Oct 12, 2026).** Web login (phone → OTP → httpOnly cookie via a Next.js BFF) + protected `/dashboard/*` + shell (left nav, 7 modules, responsive; top bar with business name + logout) + a generic `/api/businesses/*` proxy route + a shared `apiClient.ts` (mirrors RN `client.js`) + `GET /api/businesses/:id` backend endpoint. Six non-Home modules are inviting "coming soon" stubs per §9.2 (not dead links). Backend: `POST /businesses/login` extended with optional `otpCode` verification (backward-compatible — mobile unaffected). **222/222 backend tests** (+5: login-with-OTP, self-profile). Website `npm run build` clean. Files: `backend/src/routes/auth.js` (login), `backend/src/routes/businesses.js` (`GET /:businessId`), `TaskRight-Website/src/{proxy.ts, lib/session.ts, lib/apiClient.ts, lib/navigation.ts, app/api/auth/*, app/api/businesses/[...path]/route.ts, app/dashboard/login/page.tsx, app/dashboard/(shell)/*, components/dashboard/*}`. Not yet built: silent 401→re-login (cookie is cleared by the proxy/login-route on a bad token, but the shell layout just redirects — no retry), Account/Billing real data (still a stub, per "M0 is auth + shell + profile endpoint only").
- **M1 — Home / Today:** ✅ **BUILT (Oct 12, 2026).** `GET /api/businesses/:id/home-summary` composes Action Center (awaiting confirmation / past-deadline / unassigned-upcoming, all derived from existing tables — no new schema), today, a 7-day week strip, lean MTD revenue (sum of `price` over cycles completed this month — not a full margin rollup, that's M6), recent reviews (last 5 `feedbacks`), and an on-the-clock board (business-wide, adapted from the per-team-member `active-clock` query). Home page is a Server Component fetching the aggregate directly. **Not built:** "unread messages" / "failed SMS" Action Center items — no read-marker or delivery-status column exists yet; deferred to M4 (Messages) where that schema work belongs. **225/225 backend tests** (+3). Website `npm run build` clean; verified live against the dev DB.
- **M2 — Schedule:** ✅ **BUILT (Oct 13, 2026).**
  - **Forecast window decision:** `GET /:id/selections` was hardcoded to today → +30, future only, so it couldn't drive a navigable month calendar (no past months, no early-month days, nothing past day 30). It now takes an **additive optional `?from=&to=`** (both together, inclusive, 62-day cap to bound its per-day query loop; omitted → the original window, so mobile is unchanged).
  - **Per-entry `lifecycleState`** (same SCL4 rule as call detail) so past completed Calls don't render as "pending".
  - **Assignment hardening:** `PUT /:id/assignments/:scid` previously checked neither the Call's nor the assignee's ownership (the upsert is keyed on `selection_cycle_id` alone), which was a cross-tenant write. It now 404s on a foreign Call or assignee, reusing `assertAssigneeOwnedByBusiness`.
  - **Frontend:** `/dashboard/schedule` (Server Component) has a 6-week month grid (requests exactly its 42-day range, with prev/today/next and lifecycle dots), a **day snapshot** panel via `?day=` (calls + assignee from the existing `GET /assignments?serviceDate=`, plus a calls/hours/unassigned summary), and an inviting empty state. `/dashboard/schedule/calls/[id]` (Server Component) shows a lifecycle stepper, scope (proposed tasks muted, `scopeIsAssumed` note), expected/confirmed hours, expected price, and completion. Its client `CallActions` handles assign/unassign (member or group) and reschedule (hidden once completed; the copy says the customer is texted), then `router.refresh()`.
  - **New shared files:** `lib/serverApi.ts` (Server Component backend reads) and `lib/schedule.ts` (types + UTC date helpers).
  - **232/232 backend tests** (+7 in `forecast.test.js`). Website `npm run build` clean. The ranged forecast was verified read-only against the live dev DB.
  - **Fast-follow (not built):** pipeline kanban, drag-to-reschedule.
- **M3 — Customers:** ✅ **BUILT (Oct 13, 2026).**
  - **Map decision (user, Oct 13):** an **interactive Mapbox GL map** (`mapbox-gl`, pinned exactly to `3.31.0` because lockfiles are gitignored repo-wide). The token comes from `NEXT_PUBLIC_MAPBOX_TOKEN` (the same public `pk.` token as the app) and is never committed, since the repo is public. The map is loaded client-only via `next/dynamic` (mapbox-gl touches `window` on import). Pins are blue, and customers with a Call today are orange (today's Calls come from the M2 ranged forecast with `from=to=today`, so no new endpoint). Popups link to the customer. Without a token, or with no geocoded customers, it shows an inviting placeholder.
  - **Builder decision (user, Oct 13):** the **full web service builder**. Create from scratch or a template (copy-on-instantiate, so template task ids are dropped). A date-based first date, or a day-of-week pick using the app's next-occurrence rule. Optional person/group assignee, using the S16 validate-first fan-out. Definition-only edit with tasks diff-upserted by id (existing ids preserved). Delete surfaces `409 HAS_HISTORY`. Create copy warns that the customer gets the welcome SMS.
  - **Backend (additive):** `GET /:id/customers` gains `address`, numeric `lat`/`lng` and `geocodeStatus` (the map feed, §5 item 6). The `GET /:id/customers/:cid` route now returns `geocodeStatus`, `geocodeRelevance` and `lat`/`lng`. That's a **latent-bug fix**: `getCustomerDetails` always computed them, but the route mapping dropped them, so the mobile "couldn't map this address" note never rendered.
  - **Frontend:** `/dashboard/customers` (list with search over name/phone/address, a "Today" badge, a List/Map toggle via `?view=map`, and an inline Add-customer form that normalizes the phone the same way as the app's `normalizePhone`). `/dashboard/customers/[id]`: services, upcoming calls (linking to the M2 call page), a profitability card, a contact card (edit email/address/notes, review-request opt-out switch, geocode note), a single-pin map, a Message shortcut (to `/dashboard/messages`, an M4 stub for now), and a two-step delete whose warning spells out the cascade. `/dashboard/customers/[id]/services/new` and `/[serviceId]` hold the builder.
  - **New files:** `lib/customers.ts` and `components/dashboard/customers/{CustomersView,CustomerMap,CustomerMapLazy,ContactCard,DeleteButton,ServiceForm}.tsx`.
  - **Not built:** editing a customer's **name/phone** (the PATCH endpoint only accepts email/address/notes/opt-out, which is app parity). Route/territory optimization stays fast-follow.
  - **235/235 backend tests** (+3, `customerMap.test.js`). Website `npm run build` clean. The list and detail fields were verified read-only against the live dev DB.
- **M4 — Messages:** ✅ **BUILT (Oct 14, 2026).**
  - **Unread decision (user, Oct 14):** per-message **`messages.read_at`** (**migration 028**, both DBs). Unread = inbound with `read_at` NULL. Existing inbound history was backfilled as read. There's a partial index on unread inbound. Reads are marked by an explicit `POST .../messages/read`, never as a GET side effect.
  - **Backend:** `GET /:id/messages/inbox` (one thread per customer via `DISTINCT ON`, with latest message, `hasMedia` and `unreadCount`, newest first, plus `totalUnread`). `POST /:id/customers/:cid/messages/read` (ownership-checked, idempotent). Home-summary `actionCenter.unreadMessages` (the M1-deferred item; "failed SMS" stays deferred because there's no delivery-status column).
  - **Latent-bug fix:** `POST .../messages` (manual SMS) read `req.business`, which **no middleware sets**, so every send crashed with a generic 500 (the earlier "fake number" diagnosis was wrong for current code). It now loads the business, and provider failures return **`502 SMS_SEND_FAILED`** with the provider's reason, logging nothing. The mobile thread screen benefits too (it alerts `err.message`). **Same bug still in `PATCH /:id/kyc`** (M7/Account scope; not touched).
  - **Frontend:** `/dashboard/messages` is a two-pane console (it stacks on mobile; the thread view has a back link).
    - `InboxList`: threads, bold + count badge when unread, search over name/phone/body, and a "New message" picker for any customer.
    - `ThreadPanel`: bubbles, MMS images, "load earlier" cursor paging, mark-read on view, 20s `router.refresh()` polling while the tab is visible, and Enter to send / Shift+Enter for a new line.
    - MMS media loads through a new **session-checked same-origin proxy** `app/api/media/messages/[file]/route.ts` (strict filename regex; the backend's `/uploads` stays unauthenticated, a pre-existing exposure noted for hardening).
    - Home's Action Center gains an "Unread messages" group linking to each thread. Customer detail's Message button (M3) now lands on a live thread.
  - **Deferred:** inbound texts from unknown numbers (`customer_id` NULL) aren't in the inbox. Mobile doesn't call mark-read yet. Templates/canned replies are fast-follow.
  - **245/245 backend tests** (+10, `messagesInbox.test.js`; the message routes had no prior coverage). Website `npm run build` clean. Inbox verified read-only against the live dev DB.
- **M5 — Team:** members + groups + assignments + live clock board.
- **M6 — Money:** profitability rollup + per-call costs + margins.
- **M7 — Account & Billing (FINAL):** profile + provisioning status + Stripe (Customer/Checkout/Portal/webhook) + billing columns.

Then **go-live** = all seven live + the go-live criteria below.

## 8. Go-live criteria
- All 7 modules functional against the live backend; website `npm run build` clean.
- Auth: login/logout/401-refresh solid; `/dashboard/*` protected.
- Billing: a real Stripe **test-mode** payment completes end-to-end (Checkout → webhook → `access_payment_status=paid`), idempotent, signature-verified; then live keys swapped in.
- Responsive at laptop + phone-browser widths; design-system compliant.
- No card data touches our servers (hosted Stripe only).

## 9. Decisions (RESOLVED Oct 12, 2026)
1. **Session storage → httpOnly cookie.** httpOnly + Secure + SameSite=Lax, held by the Next.js BFF (see §2). XSS-safe; right posture for a payment-handling portal.
2. **Access is NOT payment-gated — "walk the house" model.** Any authenticated business can enter and explore the full portal and envision using it ("walls and all"); actions that aren't live pre-launch simply aren't functional yet, but the structure/capability is visible. The LTD purchase is an entitlement, not a doorlock. **UX consequence:** empty/pre-launch states must be *inviting and illustrative* (show what each tool will do), not dead ends — the portal sells the product by being explorable.
3. **Early access = Lifetime Deal (LTD).** One-time payment → **service forever**; these first users are **grandfathered** through the later subscription-only pivot. New/premium features built afterward are a separate conversation, not retroactively billed. Modeled via `businesses.plan='early_access_ltd'` (§Module 7). *(Open: the LTD price point + refund policy — product input, copy/config only, doesn't affect architecture.)*
4. **Reputation at go-live → Home widget only.** Full standalone Reputation module is fast-follow.
5. **New aggregates → general `/api/businesses/*` endpoints** (not portal-private). Expectation is the *portal* leverages them far more than the app, but keeping them general doesn't corner us and de-risks the call — mobile can reuse them if useful.

## 10. Sync targets
On build: `HANDOFF.md` (portal pending-work → built; new endpoints; billing DB columns), `API_REFERENCE.md` (new aggregate + billing + `GET /:id` routes), `FEATURE_MAPPING.md` (web portal surface), this file. Registered in `DOC_REGISTRY.md`.

*End of design spec. Awaiting review before any code.*
