const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const knex = require('../../db');
const SmsProvider = require('./SmsProvider');

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.taskright.io';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://taskrightpro.com';

// SignalHouse presents our configured secret on every webhook POST (authType API_KEY).
// This is the header it sends it in — configured via apiHeaderPrefix at webhook creation.
// Centralized here; confirm against the live webhook config at the P3 gate.
const WEBHOOK_SECRET_HEADER = 'x-webhook-secret';

// Events we subscribe the one Global webhook to (reference §6 "Our subscribedEvents set").
const SUBSCRIBED_EVENTS = [
  'BRAND_CREATION_SUCCESSFUL', 'BRAND_CREATION_FAILED', 'BRAND_IDENTITY_STATUS_UPDATED',
  'CAMPAIGN_APPROVED_BY_SIGNAL_HOUSE', 'CAMPAIGN_REJECTED_BY_SIGNAL_HOUSE', 'CAMPAIGN_CREATION_FAILED',
  'NUMBER_PURCHASE_SUCCESSFUL', 'NUMBER_PURCHASE_FAILED', 'NUMBER_ASSIGNMENT_SUCCESSFUL',
  'NUMBER_ASSIGNMENT_FAILED', 'NUMBER_UPDATED',
  'MESSAGE_RECEIVED', 'MESSAGE_DELIVERED', 'MESSAGE_FAILED', 'SMS_FAILED', 'MMS_FAILED',
  // Ops alerts
  'LOW_BALANCE_ALERT', 'AUTO_RECHARGE_FAILED', 'SUBSCRIPTION_RENEWAL_FAILED', 'TMOBILE_THROUGHPUT_100',
];

// Self-built OTP (SignalHouse has no Verify product — reference §8 / spec §6).
const OTP_TTL_MS = 10 * 60 * 1000;   // 10-minute expiry
const OTP_MAX_ATTEMPTS = 5;          // lock after 5 wrong tries
const OTP_RESEND_THROTTLE_MS = 60 * 1000; // 60s between sends per phone

/**
 * SignalHouseProvider — the SignalHouse implementation of the SmsProvider seam.
 *
 * P2 scope: outbound `send` only. provisionBusiness / registerA2P / parseInbound /
 * verifyInboundSignature / fetchInboundMedia / sendOtp / verifyOtp are added in
 * P3–P5 and inherit the base "not implemented" throw until then.
 *
 * The SDK is lazy-required inside _client() so the module loads (and the test suite
 * runs) without the package or live credentials present — dev-mode short-circuits
 * before any client is created, and unit tests inject a fake client.
 *
 * See shared/specs/SIGNALHOUSE_MIGRATION.md §1 + SIGNALHOUSE_API_REFERENCE.md §5.
 */
class SignalHouseProvider extends SmsProvider {
  /**
   * @param {object} [opts]
   * @param {object} [opts.client]  Injected SDK client (tests). Bypasses lazy require.
   * @param {function} [opts.otpGenerator]  Deterministic OTP source (tests).
   */
  constructor(opts = {}) {
    super();
    this._injectedClient = opts.client || null;
    this._otpGenerator = opts.otpGenerator || null;
  }

  get name() {
    return 'signalhouse';
  }

  // Configured only when we have a key + base URL to build a client.
  _isConfigured() {
    return Boolean(process.env.SIGNALHOUSE_API_KEY && process.env.SIGNALHOUSE_BASE_URL);
  }

  _client() {
    if (this._injectedClient) return this._injectedClient;
    // Lazy require — the package is only needed for a live send.
    const { SignalHouseSDK } = require('@signalhousellc/sdk');
    return new SignalHouseSDK({
      apiKey: process.env.SIGNALHOUSE_API_KEY,
      baseUrl: process.env.SIGNALHOUSE_BASE_URL,
    });
  }

  /**
   * Normalize an E.164 (+1…) number to SignalHouse wire format: digits only, no `+`,
   * with a country code. The API's validation only requires 10+ digits, so a bare
   * 10-digit number 202s then silently fails — always prepend `1`. (Reference §0.)
   */
  _toWireNumber(e164) {
    let digits = String(e164 || '').replace(/\D/g, '');
    if (digits.length === 10) digits = `1${digits}`;
    return digits;
  }

  async send(business, toPhone, body) {
    if (!toPhone || !body) {
      throw new Error('toPhone and message are required');
    }

    // Dev mode — provider unconfigured or business not provisioned on SignalHouse.
    if (!this._isConfigured() || !business.sms_subgroup_id || !business.sms_phone_number) {
      console.log(`📱 [DEV SMS] To ${toPhone}: ${body}`);
      return { id: null, status: 'dev', raw: null };
    }

    // SDK returns { success, data, status } — errors are returned, not thrown.
    const response = await this._client().messages.sendSMS({
      senderPhoneNumber: this._toWireNumber(business.sms_phone_number),
      recipientPhoneNumbers: [this._toWireNumber(toPhone)],
      messageBody: body,
    });

    if (!response || !response.success) {
      console.error(
        `❌ SignalHouse send failed (status ${response && response.status}) to ${toPhone}`
      );
      return { id: null, status: 'failed', raw: response || null };
    }

    const data = response.data || {};
    const inserted = Array.isArray(data.insertedMessages) ? data.insertedMessages[0] : null;
    const insertedId = inserted ? inserted._id : null;
    // A 201 with enqueuedCount 0 means fully blocked (moderation / campaign opt-out /
    // DNC). Treat enqueuedCount — not the HTTP status — as the accept signal.
    const enqueuedCount = typeof data.enqueuedCount === 'number'
      ? data.enqueuedCount
      : (inserted ? 1 : 0);

    if (enqueuedCount === 0) {
      console.warn(`⚠️  SignalHouse send blocked (opt-out/DNC) to ${toPhone}`);
      return { id: insertedId, status: 'blocked', raw: response };
    }

    console.log(`✓ SMS sent to ${toPhone} via business ${business.id} (id: ${insertedId || 'n/a'})`);
    return { id: insertedId, status: 'sent', raw: response };
  }

  // ── Inbound webhook ───────────────────────────────────────────────────────────
  /**
   * Normalize a SignalHouse MESSAGE_RECEIVED envelope into an InboundMessage.
   * Envelope: { timestamp, event, identifier, metaData: { Message: {...} } }.
   * SignalHouse phone numbers are digits-only (no +) → normalized back to E.164 so
   * they match our DB (business.sms_phone_number / customers.phone_number).
   */
  parseInbound(req) {
    const msg = (req.body && req.body.metaData && req.body.metaData.Message) || {};
    const urls = Array.isArray(msg.externalMediaUrls) ? msg.externalMediaUrls : [];
    const media = urls.filter(Boolean).map((url) => ({
      url,
      contentType: this._inferContentType(url),
      // OPEN (reference §9.4): whether externalMediaUrls are public or need our API
      // key. Default to public; flip to true if live downloads 401.
      authRequired: false,
    }));

    return {
      toPhone: this._toE164(msg.recipientPhoneNumber || msg.phoneNumber),
      fromPhone: this._toE164(msg.senderPhoneNumber),
      body: msg.messageBody || '',
      messageId: msg._id || null,
      subgroupId: msg.subgroupId || null,
      media,
    };
  }

  /**
   * SignalHouse doesn't sign payloads (no HMAC) — instead it presents our configured
   * API_KEY secret in a header on every webhook POST. Compare it, timing-safe, to
   * SIGNALHOUSE_WEBHOOK_SECRET. Fail closed when either the secret or header is absent.
   */
  verifyInboundSignature(req) {
    const expected = process.env.SIGNALHOUSE_WEBHOOK_SECRET;
    const provided = req.headers ? req.headers[WEBHOOK_SECRET_HEADER] : undefined;
    if (!expected || !provided || typeof provided !== 'string') return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  fetchInboundMedia(media, destPath) {
    const headers = {};
    if (media.authRequired && process.env.SIGNALHOUSE_API_KEY) {
      headers.Authorization = `Bearer ${process.env.SIGNALHOUSE_API_KEY}`;
    }
    return this._download(media.url, destPath, headers);
  }

  /**
   * One-time Group bootstrap: create the single Global inbound webhook. Idempotent —
   * skips if a Global webhook already points at our endpoint. Run once at setup
   * (not per business). Requires SIGNALHOUSE_GROUP_ID + SIGNALHOUSE_WEBHOOK_SECRET.
   */
  async createInboundWebhook() {
    const client = this._client();
    const url = `${API_BASE_URL}/api/webhooks/inbound-sms`;

    const existing = await client.webhooks.getWebhooks({ endpointType: 'Global' });
    if (existing && existing.success) {
      const list = Array.isArray(existing.data)
        ? existing.data
        : (existing.data && Array.isArray(existing.data.webhooks) ? existing.data.webhooks : []);
      const match = list.find((w) => w && w.url === url);
      if (match) {
        console.log('✓ Global inbound webhook already exists — skipping create');
        return { created: false, webhook: match };
      }
    }

    const webhookData = {
      groupId: process.env.SIGNALHOUSE_GROUP_ID,
      name: 'TaskRight inbound (Global)',
      endpointType: 'Global',
      url,
      subscribedEvents: SUBSCRIBED_EVENTS,
      authType: 'API_KEY',
      apiHeaderPrefix: WEBHOOK_SECRET_HEADER,
      // credentials shape ("key/secret per authType") — confirm live at the P3 gate.
      credentials: { apiKey: process.env.SIGNALHOUSE_WEBHOOK_SECRET },
    };

    const res = await client.webhooks.createWebhook({ webhookData });
    if (!res || !res.success) {
      throw new Error(`SignalHouse createWebhook failed (status ${res && res.status})`);
    }
    console.log('✓ Global inbound webhook created');
    return { created: true, webhook: res.data };
  }

  // ── Provisioning (subgroup + number) ──────────────────────────────────────────
  /**
   * At signup (fire-and-forget): create the business's subgroup + purchase a local
   * number. The one Global webhook is a separate one-time bootstrap (createInboundWebhook),
   * NOT created here. Stamps sms_provider='signalhouse' (per-business pin) + status.
   * Number purchase is async — outcome arrives via NUMBER_* webhooks (handleWebhookEvent).
   */
  async provisionBusiness(businessId) {
    if (!this._isConfigured()) {
      console.warn(`⚠️  SignalHouse not configured — skipping provisioning for business ${businessId} (dev mode)`);
      await knex('businesses').where('id', businessId)
        .update({ sms_provisioning_status: 'dev_mode', sms_provider: 'signalhouse' });
      return;
    }

    const business = await knex('businesses').where('id', businessId).first();
    if (!business) {
      console.error(`Provisioning failed: business ${businessId} not found`);
      return;
    }

    console.log(`🔧 Provisioning SignalHouse subgroup for business ${businessId} (${business.name})…`);

    try {
      const client = this._client();

      // ── Step 1: create subgroup (synchronous) ───────────────────────────────
      const subgroupData = {
        groupId: process.env.SIGNALHOUSE_GROUP_ID,
        subgroupName: business.name,
        subgroupCompanyName: business.name,
        contactFirstName: business.contact_first_name || undefined,
        contactLastName: business.contact_last_name || undefined,
        addressLine1: business.business_street || undefined,
        city: business.business_city || undefined,
        state: business.business_state || undefined,
        postalCode: business.business_zip || undefined,
        country: 'US',
        phone: this._toWireNumber(business.phone_number) || undefined,
      };
      const subRes = await client.subgroups.createSubgroup({ subgroupData });
      if (!subRes || !subRes.success) {
        throw new Error(`createSubgroup failed (status ${subRes && subRes.status})`);
      }
      const subgroupId = subRes.data.subgroupId; // the S… value, not _id
      console.log(`  ✓ Subgroup created: ${subgroupId}`);

      // ── Step 2: find + purchase a local number (purchase is async) ───────────
      const searchFilters = { smsEnabled: true, mmsEnabled: true, limit: 1 };
      if (business.business_state) searchFilters.state = business.business_state;
      let searchRes = await client.numbers.getAvailablePhoneNumbers(searchFilters);
      let candidates = (searchRes && searchRes.success && searchRes.data && searchRes.data.numbers) || [];
      if (candidates.length === 0 && searchFilters.state) {
        // Fall back to a nationwide search.
        searchRes = await client.numbers.getAvailablePhoneNumbers({ smsEnabled: true, mmsEnabled: true, limit: 1 });
        candidates = (searchRes && searchRes.success && searchRes.data && searchRes.data.numbers) || [];
      }
      if (candidates.length === 0) {
        throw new Error('No available SMS numbers found');
      }
      const chosen = candidates[0].number;
      const wireNumber = this._toWireNumber(chosen);

      const purchaseRes = await client.numbers.purchasePhoneNumber({
        phoneNumbers: [wireNumber],
        subgroupId,
      });
      if (!purchaseRes || !purchaseRes.success) {
        throw new Error(`purchasePhoneNumber failed (status ${purchaseRes && purchaseRes.status})`);
      }
      console.log(`  ✓ Number purchase queued: ${wireNumber}`);

      // Persist. Number stays pending until NUMBER_UPDATED→READY (handleWebhookEvent).
      await knex('businesses').where('id', businessId).update({
        sms_subgroup_id: subgroupId,
        sms_phone_number: this._toE164(wireNumber),
        sms_provisioning_status: 'pending',
        sms_provider: 'signalhouse',
        updated_at: knex.raw('CURRENT_TIMESTAMP'),
      });

      console.log(`✅ SignalHouse provisioning requested for business ${businessId}`);
    } catch (err) {
      console.error(`❌ SignalHouse provisioning failed for business ${businessId}:`, err.message);
      await knex('businesses').where('id', businessId).update({
        sms_provisioning_status: 'failed',
        sms_provider: 'signalhouse',
        updated_at: knex.raw('CURRENT_TIMESTAMP'),
      });
    }
  }

  // ── A2P registration (brand → [webhook] → campaign) ───────────────────────────
  /**
   * At KYC (EIN in hand): create the 10DLC brand. The campaign is created LATER, once
   * BRAND_CREATION_SUCCESSFUL supplies the real brandId (see handleWebhookEvent).
   *
   * EIN is transient — passed to the brand payload and never persisted or logged. The
   * brand response ECHOES ein, so we read ONLY _id/status and never log the response.
   * §8 decisions: entityType=PRIVATE_PROFIT for all; vertical defaults to PROFESSIONAL.
   */
  async registerA2P(businessId, ein) {
    if (!this._isConfigured()) {
      console.warn(`⚠️  SignalHouse not configured — skipping A2P registration for business ${businessId} (dev mode)`);
      return;
    }

    const business = await knex('businesses').where('id', businessId).first();
    if (!business) {
      console.error(`A2P registration failed: business ${businessId} not found`);
      return;
    }

    console.log(`🔧 Starting SignalHouse brand registration for business ${businessId} (${business.name})…`);

    try {
      const brandData = {
        subgroupId: business.sms_subgroup_id,
        entityType: 'PRIVATE_PROFIT',
        displayName: business.name,
        companyName: business.name,
        ein, // transient — never persisted/logged
        firstName: business.contact_first_name || undefined,
        lastName: business.contact_last_name || undefined,
        phone: this._toWireNumber(business.phone_number),
        street: business.business_street,
        city: business.business_city,
        state: business.business_state,
        postalCode: business.business_zip,
        country: 'US',
        email: business.contact_email,
        vertical: business.vertical || 'PROFESSIONAL',
        referenceId: String(businessId),
        optInLink: `${WEBSITE_URL}/privacy`,
        privacyPolicyLink: `${WEBSITE_URL}/privacy`,
        termsAndConditionsLink: `${WEBSITE_URL}/terms`,
      };

      const brandRes = await this._client().brands.createBrand({ brandData });
      // NOTE: never log brandRes / brandData — both carry ein.
      if (!brandRes || !brandRes.success) {
        throw new Error(`createBrand failed (status ${brandRes && brandRes.status})`);
      }
      const brandStatus = brandRes.data && brandRes.data.status; // PENDING_CREATION; brandId is null now

      await knex('businesses').where('id', businessId).update({
        a2p_registration_status: 'pending',
        updated_at: knex.raw('CURRENT_TIMESTAMP'),
      });

      console.log(`✅ SignalHouse brand submitted for business ${businessId} (status ${brandStatus}) — campaign follows on brand success`);
    } catch (err) {
      // err.message only — never the error object (could carry the request body / ein).
      console.error(`❌ SignalHouse A2P registration failed for business ${businessId}:`, err.message);
      await knex('businesses').where('id', businessId).update({
        a2p_registration_status: 'failed',
        updated_at: knex.raw('CURRENT_TIMESTAMP'),
      });
    }
  }

  // ── Event-driven provisioning/status (the one Global webhook) ─────────────────
  /**
   * Dispatch a non-message webhook event (brand/campaign/number/ops). Correlates the
   * business via referenceId (fallback subgroupId), advances sms_provisioning_status /
   * a2p_registration_status, persists ids, and creates the campaign on brand success.
   *
   * ⚠️ Non-message event payload shapes are OPEN (reference §9.5) — extraction is
   * defensive; confirm field paths against a live event at the P4 gate.
   */
  async handleWebhookEvent(req) {
    const body = (req && req.body) || {};
    const event = body.event;
    const payload = this._eventPayload(body);
    const business = await this._correlateBusiness(payload);

    if (!business) {
      console.warn(`SignalHouse event ${event} — no matching business (ref ${payload.referenceId || 'n/a'})`);
      return;
    }

    try {
      switch (event) {
        case 'BRAND_CREATION_SUCCESSFUL': {
          if (payload.brandId) {
            await knex('businesses').where('id', business.id)
              .update({ sms_brand_id: payload.brandId, updated_at: knex.raw('CURRENT_TIMESTAMP') });
          }
          console.log(`✓ Brand created for business ${business.id} (${payload.brandId || 'no id'})`);
          // Now that we have a brandId + a purchased number, create the campaign.
          const fresh = await knex('businesses').where('id', business.id).first();
          if (fresh.sms_brand_id && fresh.sms_phone_number) {
            await this._createCampaign(fresh);
          }
          break;
        }
        case 'BRAND_CREATION_FAILED':
          await this._setA2p(business.id, 'failed');
          console.warn(`✗ Brand creation failed for business ${business.id}`);
          break;
        case 'BRAND_IDENTITY_STATUS_UPDATED':
          console.log(`ℹ️  Brand identity for business ${business.id}: ${payload.status || 'unknown'}`);
          break;
        case 'CAMPAIGN_APPROVED_BY_SIGNAL_HOUSE':
          if (payload.campaignId) {
            await knex('businesses').where('id', business.id)
              .update({ sms_campaign_id: payload.campaignId, updated_at: knex.raw('CURRENT_TIMESTAMP') });
          }
          await this._setA2p(business.id, 'approved');
          console.log(`✅ Campaign approved for business ${business.id}`);
          break;
        case 'CAMPAIGN_REJECTED_BY_SIGNAL_HOUSE':
        case 'CAMPAIGN_CREATION_FAILED':
          await this._setA2p(business.id, 'failed');
          console.warn(`✗ Campaign ${event} for business ${business.id}`);
          break;
        case 'NUMBER_UPDATED':
          if (!payload.status || String(payload.status).toUpperCase() === 'READY') {
            await this._setProvisioning(business.id, 'active');
            console.log(`✅ Number READY for business ${business.id}`);
          }
          break;
        case 'NUMBER_PURCHASE_SUCCESSFUL':
        case 'NUMBER_ASSIGNMENT_SUCCESSFUL':
          console.log(`✓ ${event} for business ${business.id}`);
          break;
        case 'NUMBER_PURCHASE_FAILED':
        case 'NUMBER_ASSIGNMENT_FAILED':
          await this._setProvisioning(business.id, 'failed');
          console.warn(`✗ ${event} for business ${business.id}`);
          break;
        default:
          // Ops alerts (LOW_BALANCE_ALERT, AUTO_RECHARGE_FAILED, TMOBILE_THROUGHPUT_100, …)
          console.log(`ℹ️  SignalHouse event ${event} for business ${business.id}`);
      }
    } catch (err) {
      console.error(`SignalHouse event ${event} handling failed for business ${business.id}:`, err.message);
    }
  }

  /** Create the 10DLC campaign (autofill template). Called on brand success. */
  async _createCampaign(business) {
    const campaignData = {
      useDefaultTemplate: true,
      brandId: business.sms_brand_id,
      usecase: 'CUSTOMER_CARE', // §8 decision #3
      phoneNumbers: [this._toWireNumber(business.sms_phone_number)],
      directLending: false,
      ageGated: false,
      sample1: 'Hi [Name], your [Business] service is scheduled for [Date]. Reply C to confirm, T to review tasks, D to request a date change, or N to leave a note for your team.',
      sample2: 'Your [Business] service was completed today — thank you! Reply to share quick feedback.',
      // NOTE: campaign create does NOT accept referenceId (verified live — SignalHouse
      // rejects it as an unrecognized key; unlike brand create, which does). Campaign
      // events correlate via subgroupId in handleWebhookEvent.
    };
    const res = await this._client().campaigns.createCampaign({ campaignData });
    if (!res || !res.success) {
      throw new Error(`createCampaign failed (status ${res && res.status})`);
    }
    const campaignId = res.data && res.data.campaignId; // returned synchronously
    await knex('businesses').where('id', business.id).update({
      sms_campaign_id: campaignId || null,
      a2p_registration_status: 'pending',
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    });
    console.log(`  ✓ Campaign submitted for business ${business.id} (${campaignId || 'no id'})`);
  }

  _setA2p(businessId, status) {
    return knex('businesses').where('id', businessId)
      .update({ a2p_registration_status: status, updated_at: knex.raw('CURRENT_TIMESTAMP') });
  }

  _setProvisioning(businessId, status) {
    return knex('businesses').where('id', businessId)
      .update({ sms_provisioning_status: status, updated_at: knex.raw('CURRENT_TIMESTAMP') });
  }

  /** Pull the relevant sub-object out of an event envelope (shapes OPEN — defensive). */
  _eventPayload(body) {
    const md = body.metaData || {};
    return md.Brand || md.Campaign || md.Number || md.Message || md.data || md || {};
  }

  /** Correlate an event to a business: referenceId (=businessId) first, then subgroupId. */
  async _correlateBusiness(payload) {
    if (payload.referenceId) {
      const id = parseInt(payload.referenceId, 10);
      if (!Number.isNaN(id)) {
        const b = await knex('businesses').where('id', id).first();
        if (b) return b;
      }
    }
    if (payload.subgroupId) {
      return knex('businesses').where('sms_subgroup_id', payload.subgroupId).first();
    }
    return null;
  }

  // ── OTP (self-built — no SignalHouse Verify product) ──────────────────────────
  /**
   * Generate a 6-digit code, store it HASHED with a 10-min expiry (one row per phone,
   * throttled to one send/60s), and text it from our dedicated OTP sender number.
   * When SignalHouse (or the OTP sender) isn't configured, the code is stored and
   * logged to console instead of sent — the dev/test fallback, mirroring [DEV SMS].
   */
  async sendOtp(phone) {
    // Throttle: one active send per phone per window.
    const existing = await knex('otp_codes').where('phone', phone).orderBy('id', 'desc').first();
    if (existing && !existing.consumed_at) {
      const age = Date.now() - new Date(existing.created_at).getTime();
      if (age < OTP_RESEND_THROTTLE_MS) {
        const err = new Error('Too many attempts. Please wait before requesting another code.');
        err.status = 429;
        throw err;
      }
    }

    const code = this._generateOtp();
    await knex('otp_codes').where('phone', phone).del();
    await knex('otp_codes').insert({
      phone,
      code_hash: this._hashOtp(code),
      expires_at: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      created_at: knex.raw('CURRENT_TIMESTAMP'),
    });

    const sender = process.env.SIGNALHOUSE_OTP_SENDER;
    const body = `Your TaskRight verification code is ${code}`;

    if (!this._isConfigured() || !sender) {
      console.log(`📱 [DEV OTP] To ${phone}: ${code}`);
      return;
    }

    const response = await this._client().messages.sendSMS({
      senderPhoneNumber: this._toWireNumber(sender),
      recipientPhoneNumbers: [this._toWireNumber(phone)],
      messageBody: body,
    });
    const enqueued = response && response.success && response.data
      && (typeof response.data.enqueuedCount === 'number' ? response.data.enqueuedCount : 1);
    if (!enqueued) {
      // Parity with Twilio Verify: a send failure surfaces to the route.
      throw new Error(`OTP send failed (status ${response && response.status})`);
    }
  }

  /**
   * Check a code against the stored hash: rejects missing/consumed/expired/over-attempt
   * rows, increments attempts on a wrong code, and consumes the row on success (single use).
   */
  async verifyOtp(phone, code) {
    const row = await knex('otp_codes').where('phone', phone).orderBy('id', 'desc').first();
    if (!row) return false;
    if (row.consumed_at) return false;
    if (new Date(row.expires_at).getTime() < Date.now()) return false;
    if (row.attempts >= OTP_MAX_ATTEMPTS) return false;

    const provided = this._hashOtp(String(code || ''));
    const a = Buffer.from(provided);
    const b = Buffer.from(row.code_hash);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!ok) {
      await knex('otp_codes').where('id', row.id).update({ attempts: row.attempts + 1 });
      return false;
    }

    await knex('otp_codes').where('id', row.id).update({ consumed_at: knex.raw('CURRENT_TIMESTAMP') });
    return true;
  }

  _generateOtp() {
    if (this._otpGenerator) return String(this._otpGenerator());
    return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  }

  // HMAC-SHA256 keyed by JWT_SECRET — protects codes at rest (6-digit codes are
  // low-entropy but short-lived, single-use, and attempt-limited).
  _hashOtp(code) {
    const key = process.env.JWT_SECRET || 'taskright-otp-fallback';
    return crypto.createHmac('sha256', key).update(String(code)).digest('hex');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  /** digits-only (SignalHouse) → E.164. 10-digit gets +1; 11+ gets a bare +. */
  _toE164(digits) {
    const d = String(digits || '').replace(/\D/g, '');
    if (!d) return null;
    return d.length === 10 ? `+1${d}` : `+${d}`;
  }

  _inferContentType(url) {
    const m = String(url).split('?')[0].match(/\.([a-z0-9]+)$/i);
    const ext = m ? m[1].toLowerCase() : null;
    const map = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', heic: 'image/heic', mp4: 'video/mp4',
    };
    return (ext && map[ext]) || 'image/jpeg';
  }

  /** Download a URL to disk, following redirects (dropping auth on cross-origin redirect). */
  _download(url, destPath, headers = {}) {
    return new Promise((resolve, reject) => {
      const makeRequest = (targetUrl, reqHeaders) => {
        https.get(targetUrl, { headers: reqHeaders }, (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode)) {
            return makeRequest(res.headers.location, {});
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`Media download failed: HTTP ${res.statusCode}`));
          }
          const file = fs.createWriteStream(destPath);
          res.pipe(file);
          file.on('finish', () => file.close(resolve));
          file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
        }).on('error', reject);
      };
      makeRequest(url, headers);
    });
  }
}

module.exports = SignalHouseProvider;
