# SignalHouse API Reference (captured for the Twilio → SignalHouse migration)

**Status:** REFERENCE — captured & user-validated from the SignalHouse docs (July 26, 2026). Authoritative external-API truth for the migration.
**Companion:** the migration **design spec** (SmsProvider seam, per-file swap plan) is to be written next — read this + `HANDOFF.md` first.
**Scope of capture:** the blocking set for a full provider swap. Anything marked ⬜ OPEN is not yet captured / is a decision.

> Everything here was transcribed from `app2.signalhouse.io/docs` (account-gated, JS-rendered — not web-fetchable) and confirmed field-by-field. Treat as ground truth for request/response shapes. Endpoint REST paths are noted where the docs showed them; where only the SDK method was shown, that's marked.

---

## 0. SDK & conventions

- **Package:** `@signalhousellc/sdk` — `import { SignalHouseSDK } from "@signalhousellc/sdk"`
- **Init:** `new SignalHouseSDK({ apiKey, baseUrl })` — throws if either missing.
  - Prod `baseUrl`: `https://v2.signalhouse.io` · Staging: `https://v2staging.signalhouse.io`
  - `apiKey` = a JWT / service-user token. Per-request override: `options: { token }`. Custom headers: `options: { headers: {...} }`.
- **Auth header (raw HTTP):** `Authorization: Bearer <token>`
- **Error model — returned, NOT thrown:** success `{ success: true, data, status }`; error `{ success: false, error, status }`. Only client-side missing-param validation throws `SignalHouseValidationError` (`status: 400`, message `"Missing required parameter: <field>"`). → Provider layer checks `response.success`, doesn't try/catch HTTP.
- **Multipart auto (SDK builds FormData):** `sendMMS`, `sendGroupMessage`, `landings.create/update`, `brands.submitAppeal`.
- **Phone format:** 11-digit, **digits only, no `+`** (e.g. `12025551234`). A leading `+` is accepted & stripped; spaces/dashes are not. ⚠️ **Footgun:** validation only requires 10+ digits, so a bare 10-digit number returns 202 then **silently fails to fulfill** — always prepend country code `1`.
- **Money:** all amounts in **microdollars** (1,000,000 = $1.00).
- **ID formats:** `groupId` = `G`+7 (8 chars); `subgroupId` = `S…`; `brandId` = `B…`; `campaignId` = `C…`; message/webhook `_id` = Mongo ObjectId string.

### Roles
`admin` (full) · `developer` (messaging/numbers/API-keys/webhooks) · `billing` · `user` (basic) · `api` (service users). Service users may only be `api` (or internal `signalhouse_api`).

---

## 1. Domain model → our Twilio architecture

| Twilio (current) | SignalHouse | Notes |
|---|---|---|
| Parent account | **Group** (fixed, ours) | one, funded once (wallet at Group level) |
| Per-business subaccount | **Subgroup** (`S…`) | one per business |
| A2P Brand (Trust Hub bundle) | **Brand** (`B…`) | per business |
| A2P Campaign | **Campaign** (`C…`) | per business |
| Purchased number | **Number** | per business, local 10DLC |
| Messaging Service SID (routing) | **— none —** send by `senderPhoneNumber` | drop the column |
| Twilio Verify (OTP) | **— none —** self-build | see §8 |

---

## 2. Auth endpoints

### `POST /auth` (login → 12h JWT) — *not used server-side*
Req: `email` (req), `password` (req, min 8). → **200** `{ token }` (12h). Used only for the human/portal login and to bootstrap a service user.

### `POST /user/serviceuser` (create API key → 365d JWT)
Roles to call: **admin, developer**.
| Field | Req | Notes |
|---|---|---|
| `groupId` | opt | required when `role='api'`; `G`+8 chars |
| `name` | **req** | descriptive |
| `role` | **req** | `'api'` (or internal `'signalhouse_api'`) |

**201** `{ user: { user: { _id, firstName, role, activeGroupId, status, mfaEnabled, viewGroupIds, createdAt, updatedAt }, token } }` — `token` is the **365-day** key → our `SIGNALHOUSE_API_KEY` (`response.user.token`, or `response.data.user.token` via SDK).

**Bootstrap (user-performed, one-time):** user logs in (`/auth` with their creds) → creates the `api` service user → drops the token in `.env`. *Claude never handles the email/password — only the resulting token reaches config.* Handle `401` as "token invalid/expired → alert for rotation" (no silent re-auth). Rotate before the 365-day expiry (set a ~11-month reminder).

---

## 3. Provisioning endpoints

### `POST /subgroup` — createSubgroup (per business)
Req (15; required: `groupId`, `subgroupName`): `groupId`*, `subgroupName`*, `subgroupCompanyName`, `contactFirstName`, `contactLastName`, `contactMiddleName`, `addressLine1`, `addressLine2`, `city`, `state`, `country`, `postalCode`, `phone`, `carrierIdFamily` (`Default`|`ATT`|`TMobile`|`Verizon`|`USCellular`|`GoogleVoice`|`ClearSky`|`Interop`), `carrierIdRegion` (`PRClaro`|`GuamDocomo`|`GuamGTA`|`GuamITE`|null, only when family=ClearSky). carrierId* are role-gated; **we omit both (Default).**
**201** `{ _id, groupId, subgroupId, subgroupName, status:"active", carrierIdFamily, carrierIdRegion, createdAt, updatedAt }` — **store `subgroupId`** (the `S…` value, not `_id`); synchronous.

### `POST /brand` — createBrand (per business, at KYC/EIN)
Roles: admin, developer, api, billing, user. Req (31; required: `subgroupId`, `entityType`, `displayName`, `companyName`, `ein`, `phone`, `street`, `city`, `state`, `postalCode`, `country`, `email`, `vertical`):
- `subgroupId`*, `entityType`* (`PRIVATE_PROFIT`|`PUBLIC_PROFIT`|`NON_PROFIT`|`GOVERNMENT`), `displayName`*, `companyName`*, `ein`*, `einIssuingCountry`, `altBusinessId`, `altBusinessIdType` (`NONE`|`DUNS`|`LEI`|`GIIN`), `firstName`, `lastName`, `phone`*, `mobilePhone`, `street`*, `city`*, `state`* (2-char), `postalCode`*, `country`* (2-char), `email`*, `vertical`*, `brandRelationship` (ignored on create → system sets `MEDIUM_ACCOUNT`), `stockSymbol`/`stockExchange`/`website`/`businessContactEmail` (**required for `PUBLIC_PROFIT`**), `referenceId` (max 50 — **use our businessId, for webhook correlation**), `tag[]`, `mock` (bool — testing), `optInLink`, `privacyPolicyLink`, `termsAndConditionsLink`, `landingId`.
- `vertical` enum: PROFESSIONAL, REAL_ESTATE, HEALTHCARE, HUMAN_RESOURCES, ENERGY, ENTERTAINMENT, RETAIL, TRANSPORTATION, AGRICULTURE, INSURANCE, POSTAL, EDUCATION, HOSPITALITY, FINANCIAL, POLITICAL, GAMBLING, LEGAL, CONSTRUCTION, NGO, MANUFACTURING, GOVERNMENT, TECHNOLOGY, COMMUNICATION.

**202 (async)** `{ _id, groupId, subgroupId, brandId:null, status:"PENDING_CREATION", …all fields incl ein…, brandRelationship:"MEDIUM_ACCOUNT", statusHistory:[{timestamp,status}], createdAt, updatedAt }`
- ⚠️ **`brandId` is `null` on create** → real id arrives via `BRAND_CREATION_SUCCESSFUL` webhook. Store `_id` + status now; persist `sms_brand_id` on the event.
- ⚠️ **Response echoes `ein`** → **never log the raw response / never persist `ein`.** Read only `_id`/`status`.

### `POST /campaign` — createCampaign (per business, after brand + number)
Roles: admin, developer, api, user. **Recommended: `useDefaultTemplate: true`** (auto-generates description/messageFlow/opt-in copy/privacy+terms from the verified brand + vertical). Req (32; required: `brandId`, `usecase`, `description`, `messageFlow`, `phoneNumbers`, `privacyPolicyLink`, `termsAndConditionsLink` — the last four **auto-fill when `useDefaultTemplate:true`**):
- `useDefaultTemplate`, `brandId`*, `usecase`*, `subUsecases[]` (req when usecase LOW_VOLUME 1-5 / MIXED 2-5), `description`*, `messageFlow`*, `phoneNumbers`* (max 49 unless `numberPool`, max 5000), `embeddedLink` (def true), `embeddedPhone` (def false), `embeddedLinkSample` (req when embeddedLink), `termsAndConditions` (def true), `numberPool` (def false), `ageGated` (req when autofill; def false), `directLending` (req when autofill; def false), `subscriberOptIn`/`OptOut`/`Help` (def true), `sample1..5` (20-1024; **≥1 req when autofill**), `helpMessage` (req when subscriberHelp), `optinKeywords` (def `START,SUBSCRIBE`), `optoutKeywords` (def `STOP,UNSUBSCRIBE`), `helpKeywords` (def `HELP`), `optinMessage` (req when subscriberOptIn), `optoutMessage` (req when subscriberOptOut), `autoRenewal` (def true), `tag`, `privacyPolicyLink`*, `termsAndConditionsLink`*.
- `usecase`/`subUsecases` enum: 2FA, ACCOUNT_NOTIFICATION, AGENTS_FRANCHISES, CARRIER_EXEMPT, CHARITY, CUSTOMER_CARE, DELIVERY_NOTIFICATION, EMERGENCY, FRAUD_ALERT, HIGHER_EDUCATION, K12_EDUCATION, LOW_VOLUME, M2M, MARKETING, MIXED, POLITICAL, POLLING_VOTING, PROXY, PUBLIC_SAFETY_RESTRICTED, PUBLIC_SERVICE_ANNOUNCEMENT, SECURITY_ALERT, SOCIAL, SOLE_PROPRIETOR, SWEEPSTAKE, TRIAL, UCAAS_HIGH, UCAAS_LOW.
- **Autofill caller-required:** `useDefaultTemplate`, `brandId`, `usecase`, `subUsecases` (if LOW_VOLUME/MIXED), `directLending`, `ageGated`, `phoneNumbers`, ≥1 `sample`.

**201** `{ _id, groupId, subgroupId, brandId, campaignId, status:"PENDING_REVIEW", usecase, description, messageFlow, phoneNumbers, createdAt, updatedAt }`
- **`campaignId` returned synchronously** → store `sms_campaign_id` now. `status: PENDING_REVIEW` → `ACTIVE` via `CAMPAIGN_APPROVED_BY_SIGNAL_HOUSE` (or `CAMPAIGN_REJECTED_BY_SIGNAL_HOUSE`).
- **Ordering:** `phoneNumbers` is required at create → **purchase the number before the campaign.**

---

## 4. Numbers

### `GET /number/available` — search
Roles: admin, developer, api, billing, user. Req (all opt): `smsEnabled`, `mmsEnabled`, `voiceEnabled`, `country`, `state`, `npa`, `nxx`, `phoneNumber`, `limit`, `page`.
**200** `{ numbers: [ { number, country, type:"LONG_CODE", capabilities:["SMS","MMS"], npa, nxx } ] }`. Search `smsEnabled:true` (+`mmsEnabled:true`) scoped by business `state`/`npa`.

### `POST /number` — purchase
Roles: admin, developer, api, billing, user. Req: `phoneNumbers`* (array, **`1`+10-digit digits-only**), `subgroupId`*.
**202 (async, ack only)** `{ message:"Number purchase request has been queued successfully" }` — **no id.** Outcome via `NUMBER_PURCHASE_SUCCESSFUL`/`_FAILED`, then `NUMBER_UPDATED` (`IN_PROGRESS → READY`). We store the number we requested (correlate on `phoneNumber` + `subgroupId`).

*Not used:* `POST /number/toll-free` ({quantity 1-10, subgroupId} → 202 {message, orderId}; needs `tollFreeEnabled`). Also skip: getNumberHealth, updatePhoneNumber, transfer, searchNpaNxx, lookupLocations, portIn, getPortRequests. *Optional later:* `deletePhoneNumbers` (offboard), `assignPhoneNumberToCampaign` (campaign-create already attaches).

---

## 5. Messaging

### `POST /message/sms`* — sendSMS  (*path inferred; MMS confirmed `/message/mms`, SDK `messages.sendSMS`)
Roles: admin, developer, api, billing, user. **Prereqs:** brand `VERIFIED`|`VETTED_VERIFIED` + campaign `ACTIVE` + number `READY` + funded wallet.
Req: `senderPhoneNumber`* (our number), `recipientPhoneNumber`* (Array[String]), `messageBody`*, `statusCallbackUrl`, `enableShortlink`, `filterLandlinesAndInactiveNumbers` (def false; adds carrier-lookup fee).
**201** `{ insertedMessages: [ { _id, senderPhoneNumber, messageType:"SMS", direction:"OUTBOUND", recipientPhoneNumber, messageBody, segmentCount, status:"ENQUEUED", enableShortlink, createdAt } ] }`
- **`_id` → store as `sms_message_id`.** Success `status:"ENQUEUED"`.
- Response also carries (per docs prose): `requestedRecipientCount`, `enqueuedCount`, `failedCount`, `dncBlockedNumbers[]`, `filteredNumbers[]`. `requestedRecipientCount = enqueuedCount + failedCount + dncBlockedNumbers.length + filteredNumbers.length`.
- ⚠️ **Blocked/opt-out sends still return 201** → treat **`enqueuedCount` (not HTTP status)** as "accepted." Per-message `errorCode` (`"OUT"` = campaign opt-out; `null` on success); also on the FAILED status-callback.
- Note: field name `recipientPhoneNumber` (singular) vs SDK method param `recipientPhoneNumbers` (plural).

### `POST /message/mms` — sendMMS  *(likely not wired day 1 — our outbound is SMS-only; inbound MMS is what we handle)*
Req: `senderPhoneNumber`*, `recipientPhoneNumber`* (Array or String), `messageBody` (opt, def ""), `statusCallbackUrl`, `mediaUrls[]` (≤5 URLs) **or** `images` (≤5 files, ≤10MB total, multipart), `enableCompression` (def false), `enableShortlink` (def false), `filterLandlinesAndInactiveNumbers` (def false).
**201** same `insertedMessages[]` shape, `messageType:"MMS"`. Same counts/`enqueuedCount` semantics.

---

## 6. Webhooks (inbound + status)

### `POST /webhook` — createWebhook
Roles: admin, developer, api. Req: `groupId`*, `name`*, `endpointType`* (`Global`|`Number`), `phoneNumber` (req if Number), `url`*, `subscribedEvents[]` (schema-optional but **an empty/omitted array delivers nothing — always list ours**), `authType` (`NONE`|`BASIC`|`API_KEY`|`OAUTH2`), `apiHeaderPrefix` (API_KEY prefix), `credentials` (object, key/secret per authType).
**201** `{ _id, groupId, name, endpointType, subscribedEvents, url, authType, createdAt, updatedAt }` — **`credentials` not echoed.**

**→ Signature verification = configured outbound auth (NOT HMAC).** SignalHouse doesn't sign payloads; instead we set `authType: "API_KEY"` (or BASIC) + a strong random secret in `credentials`, which it presents on **every** webhook POST; our endpoint verifies it matches `SIGNALHOUSE_WEBHOOK_SECRET` → else 401. (Twilio's current no-validation posture means we're no worse off regardless; this is strictly better.)

**Design decision: one `Global` webhook for the whole Group** — inbound payloads carry `subgroupId` + `recipientPhoneNumber`, so we route by `sms_subgroup_id` at the app layer. Simpler than a webhook per number.

### Inbound payload — `MESSAGE_RECEIVED`
Envelope (shared by all events): `{ timestamp, event, identifier, metaData }`. For messages, `metaData` wraps a capital-M `Message`:
```
{ timestamp, event:"MESSAGE_RECEIVED", identifier:<msg _id>,
  metaData: { Message: {
    _id, groupId, subgroupId, brandId, campaignId,
    phoneNumber,            // OUR number that received it
    carrier, carrierFamily, carrierRegion, plmn,
    messageType, direction:"INBOUND",
    senderPhoneNumber,      // the CUSTOMER (Twilio 'From')
    recipientPhoneNumber,   // OUR number (Twilio 'To')
    messageBody,            // → C/T/D/N keyword routing
    segmentCount, statusCallbackUrl, status,
    statusHistory:[{timestamp,status}], dcaBulkId,
    externalMediaUrls:[],   // inbound MMS media (replaces Twilio MediaUrl*)
    uploadedFileReferences:[], isGroupMessage, enableCompression,
    successOrFailureReason, enableShortlink, shortlinkCount,
    createdAt, updatedAt } } }
```
Routing map: business ← `subgroupId` (or `recipientPhoneNumber` fallback); customer ← `senderPhoneNumber`; keyword ← `messageBody`. ⬜ OPEN: whether `externalMediaUrls` are public or need our API key to fetch (affects inbound-MMS download port).

### Full event enum (subscribe explicitly)
- **Brand:** BRAND_CREATION_SUCCESSFUL, BRAND_CREATION_FAILED, BRAND_UPDATE_SUCCESSFUL/_FAILED, BRAND_DELETION_SUCCESSFUL/_FAILED, BRAND_REVET_SUCCESSFUL/_FAILED, **BRAND_IDENTITY_STATUS_UPDATED** (→ VERIFIED/UNVERIFIED/VETTED_VERIFIED), BRAND_VETTING_REQUEST_CREATED/_UPDATED/_FAILED
- **Campaign:** **CAMPAIGN_APPROVED_BY_SIGNAL_HOUSE** (→ ACTIVE), CAMPAIGN_REJECTED_BY_SIGNAL_HOUSE, CAMPAIGN_CREATION_FAILED, CAMPAIGN_UPDATE_SUCCESSFUL/_FAILED, CAMPAIGN_DELETION_SUCCESSFUL/_FAILED, CAMPAIGN_RENEWAL_SUCCESSFUL/_FAILED, CAMPAIGN_DCA_APPEAL_SUBMITTED
- **Number:** NUMBER_PURCHASE_SUCCESSFUL/_FAILED, NUMBER_ASSIGNMENT_SUCCESSFUL/_FAILED, NUMBER_UNASSIGNMENT_SUCCESSFUL/_FAILED, NUMBER_DELETION_SUCCESSFUL/_FAILED, NUMBER_RENEWAL_SUCCESSFUL/_FAILED, NUMBER_MIGRATION_SUCCESSFUL/_FAILED, **NUMBER_UPDATED** (IN_PROGRESS→READY)
- **Message:** SMS_SENT, SMS_FAILED, MMS_SENT, MMS_FAILED, **MESSAGE_DELIVERED**, **MESSAGE_FAILED** (Message doc, status "FAILED"), **MESSAGE_RECEIVED**, P2P_SENT/_FAILED/_INBOUND (P2P rail — n/a to us), TMOBILE_THROUGHPUT_75/90/100 (notify only; 100 = T-Mobile silently drops)
- **Subscription/Billing:** SUBSCRIPTION_RENEWAL_SUCCESSFUL/_FAILED, LOW_BALANCE_ALERT (<$100), AUTO_RECHARGE_SUCCESSFUL/_FAILED

**Our `subscribedEvents` set:** BRAND_CREATION_SUCCESSFUL, BRAND_CREATION_FAILED, BRAND_IDENTITY_STATUS_UPDATED, CAMPAIGN_APPROVED_BY_SIGNAL_HOUSE, CAMPAIGN_REJECTED_BY_SIGNAL_HOUSE, CAMPAIGN_CREATION_FAILED, NUMBER_PURCHASE_SUCCESSFUL, NUMBER_PURCHASE_FAILED, NUMBER_ASSIGNMENT_SUCCESSFUL, NUMBER_ASSIGNMENT_FAILED, NUMBER_UPDATED, MESSAGE_RECEIVED, MESSAGE_DELIVERED, MESSAGE_FAILED, SMS_FAILED, MMS_FAILED, + (ops) LOW_BALANCE_ALERT, AUTO_RECHARGE_FAILED, SUBSCRIPTION_RENEWAL_FAILED, TMOBILE_THROUGHPUT_100.

⬜ OPEN (nice-to-have): a `BRAND_CREATION_SUCCESSFUL` / `CAMPAIGN_APPROVED` payload sample to confirm it echoes `referenceId` (+ carries `brandId`/`campaignId`/`subgroupId`) for correlation.

---

## 7. Provisioning sequence & event-driven status

**At signup (fire-and-forget):**
1. `POST /subgroup` → store `sms_subgroup_id` (sync, `active`).
2. `GET /number/available` (state/npa, sms+mms) → `POST /number` (async ack) → store requested number `sms_phone_number` (pending).
3. `POST /webhook` once for the Group (`Global`, our event set, `authType:API_KEY` + secret) — *idempotent one-time setup, not per business.*

**At KYC (EIN in hand — analog of `registerA2P`):**
4. `POST /brand` (incl `referenceId=businessId`) → store `_id` + `PENDING_CREATION`. **Scrub `ein` from the response.**
5. On `BRAND_CREATION_SUCCESSFUL` → store `sms_brand_id`. On `BRAND_IDENTITY_STATUS_UPDATED` (VERIFIED/VETTED_VERIFIED) → mark brand ready.
6. `POST /campaign` (`useDefaultTemplate:true`, `brandId`, `usecase`, `phoneNumbers:[number]`, `directLending:false`, `ageGated:false`, ≥1 sample, `referenceId=businessId`) → store `sms_campaign_id` + `PENDING_REVIEW`.
7. On `NUMBER_UPDATED`→READY, `NUMBER_ASSIGNMENT_SUCCESSFUL`, `CAMPAIGN_APPROVED_BY_SIGNAL_HOUSE` → advance `sms_provisioning_status`.

**Send gate:** brand VERIFIED + campaign ACTIVE + number READY + wallet funded. Failure events (`*_FAILED`, `CAMPAIGN_REJECTED`) drive the `failed` status + owner-visible note.

---

## 8. Our-data → payload mapping + gaps

Current `businesses` cols: `name`, `phone_number`, `entity_type`('sole_prop'|'llc_corp'), `contact_first_name`, `contact_last_name`, `contact_email`, `business_street`, `business_city`, `business_state`(2), `business_zip`. EIN = **transient only** (never stored).

- **Subgroup:** name←name, contact←contact_*, address←business_*, country←'US', phone←phone_number.
- **Brand:** subgroupId←`sms_subgroup_id`; entityType←map `llc_corp`→`PRIVATE_PROFIT`, `sole_prop`→⬜OPEN (§9); displayName/companyName←name; ein←transient; contact/address←business_*; email←contact_email; vertical←⬜ **NEW field needed**; opt-in/privacy/terms←our marketing `/privacy` `/terms`; referenceId←businessId.
- **Campaign:** brandId←`sms_brand_id`; usecase←⬜ decision (`CUSTOMER_CARE` vs `MIXED`); phoneNumbers←`[sms_phone_number]`; samples←canned strings mirroring our 6 notification types; referenceId←businessId.

### DB migration (provider-neutral `sms_*`; pre-launch, clean rename — no data to migrate)
| Current | New |
|---|---|
| `twilio_subaccount_sid` | `sms_subgroup_id` |
| `twilio_phone_number` | `sms_phone_number` |
| `twilio_messaging_service_sid` | **DROP** |
| `twilio_provisioning_status` | `sms_provisioning_status` |
| `a2p_brand_sid` | `sms_brand_id` |
| `a2p_campaign_sid` | `sms_campaign_id` |
| `a2p_registration_status` | keep |
| `messages.twilio_message_sid` | `sms_message_id` |
| — | **add** `businesses.vertical` |

### Env
`SIGNALHOUSE_API_KEY` (365d service-user token), `SIGNALHOUSE_BASE_URL`, `SIGNALHOUSE_GROUP_ID`, `SIGNALHOUSE_WEBHOOK_SECRET`. Retire `TWILIO_*` at cutover.

---

## 9. Open decisions (resolve in the design spec / with product)
1. **Sole-proprietor path** — SH `entityType` has no sole-prop value + brand requires `ein`. Options: default all TaskRight businesses to `PRIVATE_PROFIT` initially and defer true sole-prop; or find SH's sole-prop flow. **Decision needed before onboarding sole props.**
2. **`vertical`** — collect at signup or default (e.g. a sensible fixed value) — new `businesses` column.
3. **`usecase`** — `CUSTOMER_CARE` vs `MIXED` for our reminder/confirmation/review traffic.
4. **Inbound MMS media** — are `externalMediaUrls` public or auth-required to download?
5. **`referenceId` echo** — confirm async brand/campaign events return it (correlation).

---

## 10. Rate card (illustrative — example "Pro Plan", microdollars ÷1e6 = USD)
Provisioning **costs money** and is billed per action: `brandCreate` $4.50, `campaignCreate` $15.00, `brandVettingStandardAegis` $41.50, `numberLocal` $1.00/mo, `carrierIdLookup` $0.003; monthly plan fee $5.00; per-segment carrier rates ~$0.004–0.007 in/out varying by carrier. **These are the sample plan's values, not our confirmed rates** — confirm our actual plan. Wallet is at the **Group** level (we fund once; all subgroups draw from it) and funding is a **hard prerequisite** (portal-only; cards can't go via API — PCI).

---

## 11. Surgical execution plan (phased — mirrors our app-component cadence)

The migration behind a single `SmsProvider` seam so Twilio's ~95 call-sites collapse to a handful, swapped phase-by-phase with the test suite green at each step. **Each phase is independently reviewable.**

- **P0 — Seam + scaffolding (no behavior change).** Define `SmsProvider` interface (`send`, `provisionBusiness`, `registerA2P`, `parseInbound`, `verifyInboundSignature`, `sendOtp`/`verifyOtp`). Wrap the *existing* Twilio code as `TwilioProvider` implementing it; route all call-sites through the seam. Tests stay green — this is pure indirection. *(Enables everything below to be a provider swap, not a rewrite.)*
- **P1 — DB migration + config.** Provider-neutral `sms_*` columns (§8) + new env. Update test helpers/seeds (currently seed Twilio-shaped columns).
- **P2 — `SignalHouseProvider.send`.** Outbound SMS via `POST /message/sms`; phone-format boundary (strip `+`); `enqueuedCount`/`_id` handling. Swap `notificationService` behind the seam. *(Smallest, highest-frequency path — verify first.)*
- **P3 — Inbound webhook.** New `/api/webhooks/signalhouse` (or reuse path) → `parseInbound` (subgroupId/senderPhoneNumber/messageBody) + `verifyInboundSignature` (API_KEY secret). Re-point C/T/D/N keyword routing + inbound-MMS (`externalMediaUrls`). Create the one Global webhook.
- **P4 — Provisioning + A2P (the big one).** `provisionBusiness` (subgroup + number + one-time webhook) and `registerA2P` (brand + campaign, event-driven status via the webhook). Event handlers advance `sms_provisioning_status`. EIN-scrub discipline.
- **P5 — OTP self-build.** Replace Twilio Verify in web `/signup` + `/join/[code]`: generate code → `provider.send` → store w/ expiry → check. (No SH Verify product.)
- **P6 — Cutover + retire Twilio.** Remove `TwilioProvider` + `TWILIO_*` once P2–P5 verified. Ops: token-rotation reminder, `LOW_BALANCE_ALERT` monitoring.

**Open before P4:** the §9 decisions (sole-prop, vertical, usecase).

---

*End of captured reference. Next: write the migration design spec (SmsProvider interface shape, exact per-file swap list, migration file, test plan) from this + `HANDOFF.md`.*
