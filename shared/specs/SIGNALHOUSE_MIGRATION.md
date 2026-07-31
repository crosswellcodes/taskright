# SignalHouse Migration — Design Spec

**Status:** DESIGN — awaiting approval. No code written yet.
**Author:** Session of July 27, 2026.
**Read first:** `SIGNALHOUSE_API_REFERENCE.md` (the external-API ground truth) + `HANDOFF.md`.
**Companion of record:** this doc owns the *migration design*; the reference doc owns the *captured API*. Register this doc in `DOC_REGISTRY.md` on approval.

## 0. Goal & principles

Re-platform TaskRight's SMS/MMS layer from Twilio to SignalHouse and remove Twilio entirely, using a strangler-fig seam so the switch is incremental, reversible, and the backend test suite (currently **180/180**) stays green at every step.

Non-negotiables carried through every phase:
- **One `SmsProvider` seam.** Every Twilio call-site routes through it. ~95 scattered Twilio touches collapse to two implementations.
- **Zero behavior change per indirection step.** P0 is pure refactor.
- **Dev-mode fallback preserved.** Tests run with no live credentials today (signup → `dev_mode`, `sendSMS` → `console.log`). That must remain true for both providers.
- **Reversible cutover.** Env-selected provider + granular per-capability overrides; rollback = flip a flag and restart.
- **EIN never touched.** Transient-only through `registerA2P`, never logged, never persisted — same discipline as today.

---

## 1. The `SmsProvider` interface

New module tree:

```
backend/src/services/sms/
├── SmsProvider.js       ← the contract (abstract base + JSDoc typedefs); throws "not implemented"
├── TwilioProvider.js    ← wraps ALL existing Twilio code (P0)
├── SignalHouseProvider.js ← built P2–P5
└── index.js             ← factory: getProvider(capability) selects by env flag
```

The provider owns **external-API I/O only**. Database writes to the `messages` table stay in the app layer (`notificationService`, `businesses.js`, `webhooks.js`) so DB knowledge doesn't leak into providers. Persisting **provisioning identifiers** to `businesses` is provider-specific and stays inside the provider methods (they already do this today).

### Method signatures & normalized shapes

All phone numbers cross the seam in **E.164** (`+15551234567`). Each provider adapts to its own wire format at its own boundary (TwilioProvider passes E.164 through; SignalHouseProvider strips `+` and guarantees a leading `1` — the §0 footgun).

```js
/**
 * @typedef {Object} SendResult
 * @property {string|null} id        Provider message id (twilio SID / SH _id). null in dev mode.
 * @property {'sent'|'dev'|'blocked'|'failed'} status  Normalized. 'blocked' = opt-out/DNC (SH enqueuedCount=0).
 * @property {object|null} raw       Provider-native response, for logging/debug only.
 */

/**
 * @typedef {Object} InboundMessage   Normalized inbound webhook payload.
 * @property {string} toPhone         Our business number (E.164).       Twilio: To          | SH: recipientPhoneNumber
 * @property {string} fromPhone       The customer (E.164).              Twilio: From        | SH: senderPhoneNumber
 * @property {string} body            Trimmed text (may be '').          Twilio: Body        | SH: messageBody
 * @property {string|null} messageId  Provider inbound id (dedupe key).  Twilio: MessageSid  | SH: metaData.Message._id
 * @property {string|null} subgroupId SH routing key; null for Twilio.   —                   | SH: subgroupId
 * @property {InboundMedia[]} media   Attached media descriptors (may be []).
 */

/**
 * @typedef {Object} InboundMedia
 * @property {string} url             Remote media URL to fetch.
 * @property {string} contentType     e.g. 'image/jpeg'.
 * @property {boolean} authRequired   Whether fetching needs provider auth (Twilio: true; SH: OPEN §9.4).
 */

class SmsProvider {
  /** @returns {string} 'twilio' | 'signalhouse' — for per-business provider tagging & logs. */
  get name() { throw new Error('not implemented'); }

  /**
   * Send one SMS on behalf of a business. Handles dev-mode fallback internally
   * (returns {id:null,status:'dev',raw:null} and logs when the business is unprovisioned).
   * Does NOT write the messages table — the caller logs.
   * @param {object} business  Full businesses row.
   * @param {string} toPhone   E.164 recipient.
   * @param {string} body      Message text.
   * @returns {Promise<SendResult>}
   */
  async send(business, toPhone, body) { throw new Error('not implemented'); }

  /**
   * Provision SMS infrastructure for a new business (fire-and-forget from signup).
   * Owns its own DB writes to businesses.sms_* + sms_provisioning_status.
   * Idempotent-safe: skips + marks 'dev_mode' when the provider isn't configured.
   * @param {number} businessId
   * @returns {Promise<void>}
   */
  async provisionBusiness(businessId) { throw new Error('not implemented'); }

  /**
   * Register the business for 10DLC (brand + campaign). Fire-and-forget from KYC.
   * EIN is a transient parameter — never logged, never persisted.
   * Owns its own DB writes to businesses.sms_brand_id / sms_campaign_id / a2p_registration_status.
   * @param {number} businessId
   * @param {string|null} ein
   * @returns {Promise<void>}
   */
  async registerA2P(businessId, ein) { throw new Error('not implemented'); }

  /**
   * Normalize a raw inbound webhook request into an InboundMessage.
   * @param {import('express').Request} req
   * @returns {InboundMessage}
   */
  parseInbound(req) { throw new Error('not implemented'); }

  /**
   * Authenticate an inbound webhook request. Return true to accept.
   * Twilio today does no validation → TwilioProvider returns true (behavior-preserving).
   * SignalHouseProvider compares the configured API_KEY secret header to SIGNALHOUSE_WEBHOOK_SECRET.
   * @param {import('express').Request} req
   * @returns {boolean}
   */
  verifyInboundSignature(req) { throw new Error('not implemented'); }

  /**
   * Download one inbound media file to disk, applying provider auth as needed.
   * @param {InboundMedia} media
   * @param {string} destPath
   * @returns {Promise<void>}
   */
  async fetchInboundMedia(media, destPath) { throw new Error('not implemented'); }

  /**
   * Send an OTP to a phone (web signup / join flow).
   * Twilio: Verify verifications.create. SignalHouse: self-built (§6) — generate, store, provider.send.
   * @param {string} phone E.164
   * @returns {Promise<void>}
   */
  async sendOtp(phone) { throw new Error('not implemented'); }

  /**
   * Check an OTP code. Returns whether it is valid & unexpired.
   * @param {string} phone E.164
   * @param {string} code
   * @returns {Promise<boolean>}
   */
  async verifyOtp(phone, code) { throw new Error('not implemented'); }
}
```

### The factory (`index.js`)

```js
// Primary selector + optional per-capability overrides for phased rollout.
// Each override defaults to SMS_PROVIDER. This is what makes cutover granular & reversible.
//   SMS_PROVIDER            = 'twilio' (default) | 'signalhouse'
//   SMS_PROVIDER_SEND       (overrides for outbound send)
//   SMS_PROVIDER_INBOUND    (overrides for webhook parse/verify)
//   SMS_PROVIDER_PROVISION  (overrides for provisionBusiness + registerA2P)
//   SMS_PROVIDER_OTP        (overrides for sendOtp/verifyOtp)
function getProvider(capability = 'default') { /* returns a cached singleton per resolved name */ }
```

Capabilities let us, e.g., run **send** on SignalHouse (P2) while **inbound/provision/OTP** stay on Twilio — then flip each as its phase lands. In P0 everything resolves to `twilio`.

---

## 2. Per-file swap list (the ~8 Twilio files + a few call-site tails)

Legend: **[P0]** pure indirection · **[P1]** column rename · **[P2–P5]** provider behavior.

### `services/sms/*` — NEW **[P0]**
Create `SmsProvider.js`, `TwilioProvider.js`, `index.js`. `TwilioProvider` absorbs the existing Twilio logic (moved, not rewritten): `parentClient()`, `subaccountClient()`, `twilioIsConfigured()`, `extractAreaCode()`, the raw send, provisioning chain, A2P chain, Verify, and inbound parsing/media auth.

### `services/notificationService.js` **[P0 → P2]**
- **P0:** `sendSMS()` splits into (a) `getProvider('send').send(business, toPhone, body)` and (b) the existing `messages`-table insert (unchanged, still keyed on the resolved `SendResult.id`). The 5 typed wrappers (`sendServiceCompletionNotification`, `sendSelectionReminder`, `sendAutoRepeatNotification`, `sendWelcomeNotification`, `sendRescheduleNotification`) are untouched — they already funnel through `sendSMS`. Delete the top-of-file `twilio` require + `parentClient` (moved into TwilioProvider).
- **P1:** message insert writes `sms_message_id` instead of `twilio_message_sid`; reads `business.sms_phone_number`.
- **P2:** no change — the seam already points at whichever provider `SMS_PROVIDER_SEND` selects.

### `services/twilioProvisioningService.js` → becomes internal to `TwilioProvider` **[P0]**
- **P0:** its two exports (`provisionBusiness`, `registerA2P`) move into `TwilioProvider`. Keep the file as a thin re-export shim during P0 to avoid touching importers in the same commit, OR update the two importers directly (preferred — only 2). The DB writes inside stay as-is (still Twilio-shaped columns in P0).
- **P1:** column writes rename to `sms_subgroup_id` / `sms_phone_number` / `sms_provisioning_status` / `sms_brand_id` / `sms_campaign_id`; drop `twilio_messaging_service_sid`.
- **P4:** `SignalHouseProvider.provisionBusiness` (subgroup + number search/purchase + one-time Global webhook) and `.registerA2P` (brand + campaign, event-driven status) built per reference §3/§7. Retire the Twilio implementation at P6.

### `routes/webhooks.js` **[P0 → P3]**
- **P0:** `/inbound-sms` handler calls `provider.verifyInboundSignature(req)` (Twilio → true) then `provider.parseInbound(req)` to get the normalized `InboundMessage`; dedupe/routing/insert logic downstream reads the normalized fields instead of `req.body.To/From/...`. `downloadMedia()` is replaced by `provider.fetchInboundMedia()` (TwilioProvider retains the current Basic-auth + redirect logic verbatim). `handleKeyword()` is provider-agnostic already — untouched except it now calls `sendSMS` through the seam (already does, via notificationService).
- **P1:** dedupe key column `twilio_message_sid` → `sms_message_id`; routing lookup `twilio_phone_number` → `sms_phone_number`.
- **P3:** add SignalHouse route handling. Decision: **keep one path** `/api/webhooks/inbound-sms` and let `parseInbound`/`verifyInboundSignature` be provider-polymorphic (SignalHouse posts the `{timestamp,event,metaData.Message}` envelope; parseInbound maps it). Register the single Global webhook pointing here (done once in `provisionBusiness`/a one-time bootstrap, not per business). SignalHouse routing uses `subgroupId` → `sms_subgroup_id`, falling back to `recipientPhoneNumber` → `sms_phone_number`.

### `routes/auth.js` **[P0 → P5]**
- **P0:** `verifyClient()` + the `verify/send` route + the two `verificationChecks.create` blocks (business signup ~L81, customer signup ~L241) route through `provider.sendOtp` / `provider.verifyOtp`. `provisionBusiness(business.id)` import/call → `getProvider('provision').provisionBusiness(...)`. Delete the top `twilio` require.
- **P5:** OTP resolves to `SignalHouseProvider.sendOtp/verifyOtp` (self-built store, §6). The route code doesn't change again — only the flag flips.

### `routes/businesses.js` **[P0 → P1]**
- **P0:** the manual send (~L1151, a raw `twilio(...).messages.create`) routes through `provider.send(req.business, customer.phone_number, messageBody)`; keep its own `messages` insert (it returns the inserted row to the client). KYC route's `registerA2P(...)` → `getProvider('provision').registerA2P(...)`. Delete the top `twilio` require.
- **P1:** the message-mapping field `twilioMessageSid: m.twilio_message_sid` (GET messages, ~L1106) and the insert's `twilio_message_sid` → `sms_message_id`; `req.business.twilio_phone_number` → `sms_phone_number`. (API response field name `twilioMessageSid` → rename to `smsMessageId`; coordinate with mobile `businessApi.js` MessageThread mapping — RN change, user verifies.)

### `services/businessService.js` **[P0-none / P1-cosmetic]**
All SMS goes through `notificationService.*` already (welcome L556, completion L1091, review-request L2455) — **no P0 change**. P1: none (it passes the full `business` row through; the row's columns rename but the service doesn't name them). Verify no stray `twilio_` column reads — grep confirms none.

### `jobs/selection-reminders.js` & `jobs/auto-repeat.js` **[P1]**
Both hand-build a partial `business` object from selected `twilio_*` columns to feed `sendSMS`. **P0:** no change (columns still exist). **P1:** the `select(...)` column list and the constructed object rename `twilio_subaccount_sid/twilio_messaging_service_sid/twilio_phone_number` → `sms_subgroup_id`/(drop messaging service)/`sms_phone_number`. Since `send()` only needs the row to detect dev-mode + (SH) the sender number, simplify to selecting `sms_subgroup_id, sms_phone_number, sms_provisioning_status`.

### `routes/customers.js` **[P0-none]**
`notificationService.sendSMS` (feedback alert, L211) — no change; flows through the seam.

### Website `TaskRight-Website/` **[P5]**
`/signup` and `/join/[code]` call the backend OTP endpoints (`/api/auth/verify/send` + `otpCode` on signup). Because OTP lives behind `provider.sendOtp/verifyOtp`, the **website needs no change** — the backend swap is transparent. (The reference's "website A2P/KYC signup flow" touch is really the backend KYC route; the web KYC form fields are already collected.) Confirm at P5.

### Test files **[P1]**
`src/__tests__/helpers.js` `createTestBusiness()` goes through the real signup endpoint → provisioning hits `twilioIsConfigured()` = false → `dev_mode`. **No mocks today.** P1: nothing to change in helpers *unless* a test asserts on a `twilio_*` column (grep: none do). Add coverage per §7. Keep the no-live-credentials contract: both providers must no-op to `dev_mode` when unconfigured.

---

## 3. The provider-neutral `sms_*` DB migration (P1)

New migration `026_sms_provider_neutral.js` (idempotent-safe up/down). Pre-launch, **no live business rows to migrate** → clean renames.

| Current column | Action |
|---|---|
| `businesses.twilio_subaccount_sid` | rename → `sms_subgroup_id` |
| `businesses.twilio_phone_number` | rename → `sms_phone_number` |
| `businesses.twilio_messaging_service_sid` | **DROP** (SignalHouse sends by number) |
| `businesses.twilio_provisioning_status` | rename → `sms_provisioning_status` (keep enum values `pending`/`active`/`failed`/`dev_mode`) |
| `businesses.a2p_brand_sid` | rename → `sms_brand_id` |
| `businesses.a2p_campaign_sid` | rename → `sms_campaign_id` |
| `businesses.a2p_registration_status` | **keep** (provider-neutral already) |
| `businesses.vertical` | **ADD** varchar (nullable) — SignalHouse brand requires it (§9.2) |
| `businesses.sms_provider` | **ADD** varchar default `'twilio'` — per-business provider tag (see below) |
| `messages.twilio_message_sid` | rename → `sms_message_id` |

**`businesses.sms_provider` (recommended addition, not in reference §8):** in a dual-provider window a business is pinned to whatever provider provisioned it — a Twilio-provisioned business can't send via SignalHouse and vice-versa. Stamping the provider at provision time lets `send`/inbound routing pick the right client *per business* instead of relying solely on the global flag. Pre-launch (no live businesses) this is low-stakes, but it's the correct strangler pattern and cheap to add now. **Flagged for your call in §8.** If you decline, the global/per-capability flag alone governs and we accept that mixed-provider states aren't supported.

**Seed/test-helper updates (P1):** none required structurally (helpers use the signup endpoint, not raw column inserts). Update any *future* seed that names old columns. Add a test asserting `createTestBusiness` yields `sms_provisioning_status = 'dev_mode'` (locks the dev-mode contract).

**Env (P1):** add `SIGNALHOUSE_API_KEY`, `SIGNALHOUSE_BASE_URL`, `SIGNALHOUSE_GROUP_ID`, `SIGNALHOUSE_WEBHOOK_SECRET`, `SMS_PROVIDER` (+ optional per-capability overrides). Retire `TWILIO_*` and `TWILIO_VERIFY_SERVICE_SID` at **P6**.

---

## 4. Dual-provider / feature-flag strategy & rollback

**Selection:** the `getProvider(capability)` factory reads `SMS_PROVIDER` with per-capability overrides (`_SEND`, `_INBOUND`, `_PROVISION`, `_OTP`). Default `twilio`. This is the reversibility spine: each phase flips exactly one capability to `signalhouse`, and any capability can revert independently by restoring its env value + restart. No code deploy needed to roll back.

**Per-business pinning (if `businesses.sms_provider` is adopted):** `send`/inbound resolve the provider from the business row first, falling back to the capability flag for un-stamped rows. New provisioning stamps the row with whatever `SMS_PROVIDER_PROVISION` selected. This makes a mixed fleet coherent.

**Rollback story:**
- *Pre-P4 (send/inbound/OTP swaps):* stateless — flip the capability flag back to `twilio`, restart. Nothing persisted diverges.
- *Provisioning (P4):* a business provisioned on SignalHouse holds SH `sms_*` ids; reverting the *global* flag doesn't un-provision it. Rollback = flip `SMS_PROVIDER_PROVISION` back to `twilio` for **new** signups; existing SH businesses keep using SH (per-business pin), or are re-provisioned manually. **Because this is pre-launch with no live businesses, "rollback" during P4 is effectively "flip the flag; nothing to unwind."** This is exactly why the reference calls out doing the migration pre-launch.
- *Cutover (P6):* once Twilio is deleted, rollback is a git revert + restoring `TWILIO_*`. Keep the `TwilioProvider` file + env in place through a bake-in window before P6 removes them.

**Kill-switch:** `SMS_PROVIDER=twilio` (no overrides) fully restores the current system at any point up to P6.

---

## 5. Event-driven provisioning & webhook design (P3/P4)

- **One `Global` webhook for the whole Group**, created once (idempotent bootstrap, *not* per business): `POST /webhook` with `endpointType:'Global'`, `url` = our `/api/webhooks/inbound-sms`, `authType:'API_KEY'` + a strong secret stored as `SIGNALHOUSE_WEBHOOK_SECRET`, and our explicit `subscribedEvents` set (reference §6 — empty array delivers nothing). Inbound routing is app-layer by `subgroupId`.
- **Signature verification = configured outbound auth, not HMAC.** SignalHouse presents the API_KEY header on every POST; `SignalHouseProvider.verifyInboundSignature` compares it to `SIGNALHOUSE_WEBHOOK_SECRET` → else 401. Strictly better than Twilio's current no-validation posture.
- **Async brand→campaign status handling:** `provisionBusiness` (subgroup sync + number purchase async-ack) and `registerA2P` (brand `202 PENDING_CREATION`, `brandId:null`) return before ids exist. Real ids/status arrive via webhook events → a new event handler (in the webhook route, dispatched by `event`) advances `sms_provisioning_status` and persists `sms_brand_id`/`sms_campaign_id`, correlating on `referenceId = businessId`. Subscribe to the §6 set: brand create/identity, campaign approve/reject, number purchase/assign/updated, message received/delivered/failed, plus ops alerts (LOW_BALANCE, AUTO_RECHARGE_FAILED, TMOBILE_THROUGHPUT_100).
- **EIN-scrub discipline:** `POST /brand` echoes `ein` in its response — read only `_id`/`status`, never log the raw response object, never persist `ein`. Same closure-only rule as today's `registerA2P`.
- **Ordering constraint:** campaign create requires `phoneNumbers` → purchase the number (and confirm READY via `NUMBER_UPDATED`) before campaign creation.
- **Send gate:** brand VERIFIED + campaign ACTIVE + number READY + wallet funded. Failure events drive `failed` + an owner-visible note.

---

## 6. OTP self-build (P5)

SignalHouse has **no Verify product** → build it:
- New table `otp_codes` (migration): `id`, `phone` (E.164, indexed), `code_hash` (bcrypt/HMAC — never store the raw code), `expires_at`, `consumed_at`, `attempts` (int), `created_at`. Or a minimal `phone, code_hash, expires_at` with row-per-phone upsert. Recommend hashing + 10-min expiry + max-5-attempts + 60s resend throttle to match Twilio Verify's guardrails.
- `SignalHouseProvider.sendOtp(phone)`: generate 6-digit code → store hash + expiry (upsert by phone, reset attempts) → `this.send(<systemBusiness?>, phone, "Your TaskRight code is 123456")`. **Sender question:** OTP sends happen *before* a business number exists (pre-signup). SignalHouse sends by `senderPhoneNumber` — so OTP needs a **dedicated platform number on our own Group/subgroup** (not a business's). Provision one TaskRight-owned number for transactional/OTP traffic; store as `SIGNALHOUSE_OTP_SENDER`. (Twilio Verify hid this; SignalHouse makes it explicit.) Flagged as an implementation prerequisite for P5.
- `verifyOtp(phone, code)`: look up unconsumed unexpired row → compare hash → mark consumed → return boolean. Increment attempts; lock after max.
- Dev mode: when SignalHouse unconfigured, `sendOtp` logs the code to console and `verifyOtp` accepts a fixed test code — **mirrors today's behavior so tests need no live provider.** (Twilio Verify in tests: the OTP path is only hit with `otpCode` present, which test signups omit — preserve that.)

---

## 7. Per-phase test plan & P0–P6 gate criteria

Suite runs `cd backend && npm test` against `task_app_test`. **Green at every gate is the hard requirement.**

- **P0 — Seam + TwilioProvider.** *Gate:* 180/180 unchanged, zero behavior diff. Add: a `TwilioProvider` unit test asserting `parseInbound` maps a Twilio `req.body` fixture to the normalized `InboundMessage`; `verifyInboundSignature` returns true; `send` in dev-mode returns `{status:'dev'}` + logs. *Advance when:* all green + a diff review confirms pure indirection (no logic moved/changed, only relocated).
- **P1 — DB migration + config.** *Gate:* migration up/down runs clean on both DBs; suite green after column renames; new test locks `dev_mode` default + `sms_message_id` round-trips through inbound insert. *Advance when:* green + `\d businesses` shows `sms_*` cols and no `twilio_*`.
- **P2 — `SignalHouseProvider.send`.** *Gate:* with `SMS_PROVIDER_SEND=signalhouse` + a test double for the SDK, an outbound send maps to `POST /message/sms`, strips `+`, treats `enqueuedCount` (not HTTP) as accepted, stores `_id` → `sms_message_id`; a `enqueuedCount:0` (opt-out) response yields `status:'blocked'` and still logs. Twilio send path still green with the flag off. *Advance when:* green under both flag states + a real single live send verified by you.
- **P3 — Inbound webhook.** *Gate:* `parseInbound` maps a SignalHouse `MESSAGE_RECEIVED` envelope fixture to the normalized shape; `verifyInboundSignature` rejects a bad/missing API_KEY (401) and accepts the good secret; C/T/D/N keyword routing + inbound-MMS (`externalMediaUrls`) exercised against the normalized payload. *Advance when:* green + a live inbound (incl. one MMS) round-trips end-to-end.
- **P4 — Provisioning + A2P.** *Gate:* `provisionBusiness`/`registerA2P` build correct payloads (subgroup, number search/purchase, brand w/ `referenceId`, campaign `useDefaultTemplate`) against SDK doubles; EIN never appears in any persisted field or log (assert); webhook event handlers advance `sms_provisioning_status` and persist `sms_brand_id`/`sms_campaign_id` from event fixtures; dev-mode still yields `dev_mode`. *Advance when:* green + a live sandbox provisioning reaches campaign `PENDING_REVIEW` with the §9 decisions resolved.
- **P5 — OTP self-build.** *Gate:* `sendOtp` stores a hashed code + expiry and sends via the OTP sender; `verifyOtp` accepts a valid code once (idempotent consume), rejects wrong/expired/over-attempt; throttle enforced; dev-mode fixed-code path green. Web signup/join integration green. *Advance when:* green + a live OTP received on a real phone.
- **P6 — Cutover + retire Twilio.** *Gate:* delete `TwilioProvider` + `twilioProvisioningService.js` shim + `TWILIO_*`/`TWILIO_VERIFY_SERVICE_SID`; grep shows zero `twilio`/`TWILIO` references; suite green; `SMS_PROVIDER` defaults to `signalhouse`. *Advance when:* green + one full live smoke (signup → provision → send → inbound → OTP) on SignalHouse only.

**Blocking before P4:** the §8 decisions.

---

## 8. Open decisions (please answer — recommended defaults marked)

1. **Sole-prop `entityType` mapping.** SignalHouse `entityType` has no sole-prop value and `POST /brand` requires `ein`; our fleet is mostly `sole_prop`. **Recommend:** map both `sole_prop` and `llc_corp` → `PRIVATE_PROFIT` and require an EIN at KYC for everyone initially (defer a true sole-prop path until we confirm SignalHouse's sole-prop/低-volume flow). Sole props without an EIN can't onboard to 10DLC until then. *Alt:* block sole-prop signups at KYC with a "coming soon" note. — **Your call.**
2. **`businesses.vertical`.** Brand create requires it. **Recommend:** add the column, default every TaskRight business to `PROFESSIONAL` (fits our service-business ICP), and *don't* collect it at signup for v1 (one less field). Revisit if a business's real vertical matters for approval. *Alt:* add a picker to the web KYC step. — **Your call.**
3. **`usecase`: `CUSTOMER_CARE` vs `MIXED`.** Our traffic = appointment reminders, confirmations, completion notices, review requests — all transactional/service. **Recommend:** `CUSTOMER_CARE` (cleanest carrier approval for our content; `MIXED` invites extra sub-usecase scrutiny and is meant for genuinely multi-purpose senders). Use `useDefaultTemplate:true` with our 6 message types as samples. *Alt:* `MIXED` if we expect to add marketing blasts later. — **Your call.**
4. **(New, surfaced above) `businesses.sms_provider` per-business pin — adopt or skip?** **Recommend adopt** (correct strangler pattern, cheap now). Skip is acceptable pre-launch if you'd rather keep the schema minimal and rely solely on the global flag. — **Your call.**
5. **(New, P5 prerequisite) Dedicated OTP sender number.** SignalHouse sends by number, so pre-signup OTP needs a TaskRight-owned number (`SIGNALHOUSE_OTP_SENDER`). Confirm we'll provision one during account bootstrap. — **FYI / confirm.**

(Decisions #1–3 are the reference §9 items you flagged; #4–5 surfaced during this design pass.)

---

## 9. Execution order recap

P0 (seam, this-is-next-after-approval) → P1 (DB + env) → P2 (send) → P3 (inbound) → P4 (provision + A2P, needs §8 answers) → P5 (OTP) → P6 (retire Twilio). One phase per checkpoint: implement → `npm test` → report → await go-ahead.

---

## 10. Go-Live / Live-Credentials Checklist  ← SINGLE SOURCE OF TRUTH

Everything that must be supplied, run, or confirmed once real SignalHouse credentials exist. Keep this section current as phases land — it is the definitive pre-cutover checklist. (Nothing here is exercised by the test suite, which runs fully in dev-mode.)

### A. Credentials & secrets to obtain and place in `backend/.env`
Documented as keys in `backend/.env.example`. The user supplies values; **credentials never go in chat.**
- [ ] `SIGNALHOUSE_API_KEY` — 365-day service-user token. User creates it once via the SignalHouse portal (login → create `api` service user → copy `response.user.token`). Read by `SignalHouseProvider._client()`.
- [ ] `SIGNALHOUSE_BASE_URL` — `https://v2.signalhouse.io` (prod) or `https://v2staging.signalhouse.io` (staging). Read by `_client()`.
- [ ] `SIGNALHOUSE_GROUP_ID` — our fixed Group id (`G`+7). Read by `createInboundWebhook()` and (P4) provisioning.
- [ ] `SIGNALHOUSE_WEBHOOK_SECRET` — strong random **we generate**, placed in `.env` AND in the webhook config (set at `createInboundWebhook`). Read by `verifyInboundSignature()`.
- [ ] `SIGNALHOUSE_OTP_SENDER` — dedicated TaskRight-owned number for pre-signup OTP (P5). SignalHouse sends by number and OTP fires before a business number exists.
- [ ] **Group wallet funded** — portal-only (cards can't go via API, PCI). **Hard prerequisite** for any live send/provision. **CONFIRMED via smoke (Jul 31): the free ceiling is the subgroup layer** — `getGroup`, number *search*, and `createSubgroup`/`deleteSubgroup` work unfunded, but **`createBrand` (even `mock: true`) fails with "Insufficient funds"**. So brand → campaign → number-purchase → send ALL require a funded wallet. `mock:true` still skips the ~$41.50 vetting + the multi-day wait (you pay only ~$4.50 brand + $15 campaign + ~$1/mo number), so it's the cheap-iteration path once funded — but it is NOT free.

### B. One-time bootstrap actions (need live creds)
- [ ] Create the `api` service-user token (user, portal) → `SIGNALHOUSE_API_KEY`.
- [ ] Fund the Group wallet (user, portal).
- [ ] Run `SignalHouseProvider.createInboundWebhook()` **once** to register the single Global webhook (idempotent; safe to re-run).
- [ ] (P5) Provision the dedicated OTP sender number → `SIGNALHOUSE_OTP_SENDER`.
- [ ] Set a **~11-month token-rotation reminder** (365-day token; rotate before expiry; a `401` means "token invalid → alert for rotation," no silent re-auth).

### C. Assumptions to confirm against the live API (built defensively; adjust in one place each)
- [ ] **Inbound auth header name** — assumed `x-webhook-secret`. Centralized in `WEBHOOK_SECRET_HEADER` (`SignalHouseProvider.js`). Confirm what SignalHouse actually presents on webhook POSTs; adjust the one constant.
- [ ] **`createWebhook` `credentials` shape** — assumed `{ apiKey: <secret> }`. Confirm against a live webhook creation (`createInboundWebhook`).
- [ ] **`externalMediaUrls` auth** (reference §9.4, OPEN) — defaulted `authRequired: false` (public). If live MMS downloads 401, flip in `parseInbound` (and `fetchInboundMedia` will attach `Bearer SIGNALHOUSE_API_KEY`).
- [ ] **Outbound send response shape** — mapped to `data.insertedMessages[0]._id` + `data.enqueuedCount` (confirmed vs SDK source, not a live send). Verify on the first real send.
- [ ] **`referenceId` echo on async brand/campaign events** (reference §9.5, OPEN) — P4 correlation depends on `BRAND_CREATION_SUCCESSFUL` / `CAMPAIGN_APPROVED` / `NUMBER_UPDATED` echoing our `referenceId=businessId`. `handleWebhookEvent` falls back to `subgroupId` if absent. Confirm the event payload.
- [ ] **P4 event payload field paths** — `handleWebhookEvent` reads sub-objects defensively via `_eventPayload` (`metaData.Brand`/`Campaign`/`Number`/`data`/`metaData`) and fields `brandId`/`campaignId`/`status`/`referenceId`/`subgroupId`. Confirm the actual nesting + field names for each event type against live samples; adjust `_eventPayload`/the switch if they differ.
- [~] **P4 provisioning response field paths** — CONFIRMED LIVE (funded smoke, Jul 31): `subRes.data.subgroupId` ✅ (`S…`); `searchRes.data.numbers[0].number` ✅ (digits-only 11-digit, e.g. `19713120983`; `_toWireNumber`/`_toE164` handle it); `deleteSubgroup({id:subgroupId})` ✅; **`registerA2P` `brandRes.data._id`/`.status` ✅** (mock brand → `PENDING_CREATION`, then getBrands poll → `PENDING_APPROVAL` + `brandId` arrives async; brand ACCEPTS `referenceId`). **FIXED (bug found live): `_createCampaign` must NOT send `referenceId`** — SignalHouse rejects it on campaign create ("Unrecognized key") though it's valid on brand; removed from provider + smoke. Campaign events correlate via `subgroupId` fallback. **STILL TO CONFIRM: `createCampaign` `res.data.campaignId`** — campaign create requires ≥1 `phoneNumbers`, so needs a *purchased* number (~$1) to validate end-to-end.
- [ ] **Subgroup deletion is async** — `deleteSubgroup` fails with "has active brands" until the brand's async deletion propagates (poll-retry succeeds). Not a code path we use in prod, but note for cleanup tooling.
- [ ] **P4 marketing links** — brand payload uses `${WEBSITE_URL}/privacy` (optIn + privacy) and `${WEBSITE_URL}/terms`. Ensure those pages exist and satisfy 10DLC opt-in requirements before submitting real brands.
- [ ] **EIN handling verified live** — brand response echoes `ein`; `registerA2P` reads only `_id`/`status`, never logs the response/payload. Confirm no EIN appears in logs/DB during a real registration (unit test asserts DB scrub).

### D. Per-phase cutover flags + live verification gates
Flip one capability flag per phase in `.env` (default `twilio`); rollback = unset. See §4.
- [ ] **P2 send:** `SMS_PROVIDER_SEND=signalhouse` → verify one **live SMS** delivered.
- [ ] **P3 inbound:** `SMS_PROVIDER_INBOUND=signalhouse` (+ Global webhook created) → verify a **live inbound SMS and one MMS** round-trip.
- [ ] **P4 provision/A2P:** `SMS_PROVIDER_PROVISION=signalhouse` → live sandbox provisioning reaches campaign `PENDING_REVIEW`; **EIN-scrub verified** (never persisted/logged).
- [ ] **P5 OTP:** `SMS_PROVIDER_OTP=signalhouse` → verify a **live OTP** on a real phone.
- [ ] **P6 cutover:** flip `SMS_PROVIDER=signalhouse` globally; full live smoke (signup → provision → send → inbound → OTP); then retire `TwilioProvider` + `TWILIO_*` + drop `twilio_messaging_service_sid`.

### E. Ongoing ops (post-cutover)
- [ ] Monitor `LOW_BALANCE_ALERT` (<$100) + `AUTO_RECHARGE_FAILED` webhook events.
- [ ] Watch `TMOBILE_THROUGHPUT_100` (T-Mobile silently drops at 100%).
- [ ] Confirm actual rate-card vs the illustrative reference §10 values before relying on cost math.

---

*End of design spec.*
