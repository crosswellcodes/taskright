const twilio = require('twilio');
const https = require('https');
const fs = require('fs');
const knex = require('../../db');
const SmsProvider = require('./SmsProvider');

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.taskright.io';

/**
 * TwilioProvider — the existing Twilio implementation, moved behind the SmsProvider
 * seam. This is P0 pure indirection: logic is relocated verbatim from
 * notificationService, twilioProvisioningService, webhooks, and auth — no behavior
 * change. Env vars are read lazily inside methods so tests run in dev-mode without
 * live credentials (unprovisioned business → console log, never a live API call).
 */
class TwilioProvider extends SmsProvider {
  get name() {
    return 'twilio';
  }

  // ── Clients ────────────────────────────────────────────────────────────────
  _parentClient() {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  // Retained for organizational parity (unused today; messaging.twilio.com does
  // not respect the accountSid routing option — see twilioProvisioningService note).
  _subaccountClient(subaccountSid) {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, {
      accountSid: subaccountSid,
    });
  }

  _verifyClient() {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      .verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID);
  }

  // Returns true only when real Twilio credentials are configured.
  _isConfigured() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    return sid && sid.startsWith('AC') && token && token !== 'your_token';
  }

  /**
   * Extract US area code from an E.164 phone number.
   * "+14135551234" → "413"; falls back to "415" if parsing fails.
   */
  _extractAreaCode(e164Phone) {
    try {
      const digits = e164Phone.replace(/^\+1/, '');
      return digits.substring(0, 3);
    } catch {
      return '415';
    }
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  async send(business, toPhone, body) {
    if (!toPhone || !body) {
      throw new Error('toPhone and message are required');
    }

    // Dev mode — business not provisioned yet (fresh signup or test environment)
    if (!business.sms_subgroup_id || !business.twilio_messaging_service_sid) {
      console.log(`📱 [DEV SMS] To ${toPhone}: ${body}`);
      return { id: null, status: 'dev', raw: null };
    }

    const client = this._parentClient();
    const response = await client.messages.create({
      messagingServiceSid: business.twilio_messaging_service_sid,
      to: toPhone,
      body,
    });

    console.log(`✓ SMS sent to ${toPhone} via business ${business.id} (SID: ${response.sid})`);
    return { id: response.sid, status: 'sent', raw: response };
  }

  // ── Provisioning ──────────────────────────────────────────────────────────────
  /**
   * Provision a dedicated Twilio subaccount + Messaging Service + local number.
   * Steps: 1) subaccount 2) Messaging Service (inbound webhook) 3) search number
   * 4) purchase 5) add to Messaging Service; then persist to DB.
   */
  async provisionBusiness(businessId) {
    if (!this._isConfigured()) {
      console.warn(`⚠️  Twilio not configured — skipping provisioning for business ${businessId} (dev mode)`);
      await knex('businesses')
        .where('id', businessId)
        .update({ sms_provisioning_status: 'dev_mode' });
      return;
    }

    const business = await knex('businesses').where('id', businessId).first();
    if (!business) {
      console.error(`Provisioning failed: business ${businessId} not found`);
      return;
    }

    console.log(`🔧 Provisioning Twilio subaccount for business ${businessId} (${business.name})…`);

    try {
      // ── Step 1: Create subaccount ───────────────────────────────────────────
      const subaccount = await this._parentClient().api.v2010.accounts.create({
        friendlyName: business.name,
      });
      const subaccountSid = subaccount.sid;
      console.log(`  ✓ Subaccount created: ${subaccountSid}`);

      // Steps 2–5 use the parent client. messaging.twilio.com does not respect
      // the accountSid routing option, so Messaging Services and phone numbers
      // must live on the same account (parent). The subaccount above is retained
      // for organizational/billing purposes and future A2P registration.
      const pClient = this._parentClient();

      // ── Step 2: Create Messaging Service ────────────────────────────────────
      const messagingService = await pClient.messaging.v1.services.create({
        friendlyName: `${business.name} SMS`,
        inboundRequestUrl: `${API_BASE_URL}/api/webhooks/inbound-sms`,
        inboundMethod: 'POST',
        fallbackUrl: `${API_BASE_URL}/api/webhooks/inbound-sms`,
        fallbackMethod: 'POST',
      });
      const messagingServiceSid = messagingService.sid;
      console.log(`  ✓ Messaging Service created: ${messagingServiceSid}`);

      // ── Step 3: Find available local number ─────────────────────────────────
      const areaCode = this._extractAreaCode(business.phone_number);
      let phoneNumber;

      const available = await pClient.availablePhoneNumbers('US').local.list({
        areaCode: parseInt(areaCode),
        smsEnabled: true,
        limit: 1,
      });

      if (available.length > 0) {
        phoneNumber = available[0].phoneNumber;
      } else {
        console.warn(`  ⚠️  No numbers in area code ${areaCode} — searching nationwide`);
        const fallback = await pClient.availablePhoneNumbers('US').local.list({
          smsEnabled: true,
          limit: 1,
        });
        if (fallback.length === 0) {
          throw new Error('No US local SMS numbers available');
        }
        phoneNumber = fallback[0].phoneNumber;
      }

      // ── Step 4: Purchase the number ─────────────────────────────────────────
      const purchased = await pClient.incomingPhoneNumbers.create({ phoneNumber });
      console.log(`  ✓ Number purchased: ${phoneNumber}`);

      // ── Step 5: Add number to Messaging Service ──────────────────────────────
      await pClient.messaging.v1.services(messagingServiceSid).phoneNumbers.create({
        phoneNumberSid: purchased.sid,
      });
      console.log(`  ✓ Number added to Messaging Service`);

      // ── Persist to DB ────────────────────────────────────────────────────────
      await knex('businesses').where('id', businessId).update({
        sms_subgroup_id: subaccountSid,
        sms_phone_number: phoneNumber,
        twilio_messaging_service_sid: messagingServiceSid,
        sms_provisioning_status: 'active',
        updated_at: knex.raw('CURRENT_TIMESTAMP'),
      });

      console.log(`✅ Twilio provisioning complete for business ${businessId}`);
    } catch (err) {
      console.error(`❌ Twilio provisioning failed for business ${businessId}:`, err.message);
      await knex('businesses').where('id', businessId).update({
        sms_provisioning_status: 'failed',
        updated_at: knex.raw('CURRENT_TIMESTAMP'),
      });
    }
  }

  // ── A2P registration ────────────────────────────────────────────────────────
  /**
   * Register a business for A2P 10DLC via Twilio Trust Hub.
   * Chain: Customer Profile → A2P Messaging Profile → Brand → Campaign → Messaging Service.
   * EIN is used only within this method — never written to DB or logs.
   */
  async registerA2P(businessId, ein) {
    if (!this._isConfigured()) {
      console.warn(`⚠️  Twilio not configured — skipping A2P registration for business ${businessId} (dev mode)`);
      return;
    }

    const business = await knex('businesses').where('id', businessId).first();
    if (!business) {
      console.error(`A2P registration failed: business ${businessId} not found`);
      return;
    }

    console.log(`🔧 Starting A2P 10DLC registration for business ${businessId} (${business.name})…`);

    const pClient = this._parentClient();

    try {
      // ── Step 1: Create Customer Profile ────────────────────────────────────────
      // EIN is included for LLC/Corp only and is never logged.
      const isLlcCorp = business.entity_type === 'llc_corp';

      const profileAttributes = {
        customer_type: isLlcCorp ? 'business' : 'starter',
        company_type: isLlcCorp ? 'private' : 'sole_proprietorship',
        business_name: business.name,
        first_name: business.contact_first_name,
        last_name: business.contact_last_name,
        email: business.contact_email,
        phone_number: business.phone_number,
        street: business.business_street,
        city: business.business_city,
        state_province_region: business.business_state,
        postal_code: business.business_zip,
        country: 'US',
      };
      if (isLlcCorp && ein) {
        profileAttributes.ein = ein;
      }

      // Policy SIDs verified via GET /v1/Policies — split by entity type
      const CUSTOMER_PROFILE_POLICY = isLlcCorp
        ? 'RNdfbf3fae0e1107f8aded0e7cead80bf5' // Secondary Customer Profile of type Business
        : 'RN806dd6cd175f314e1f96a9727ee271f4'; // Starter Customer Profile of type Business

      const A2P_MESSAGING_PROFILE_POLICY = isLlcCorp
        ? 'RNb0d4771c2c98518d916a3d4cd70a8f8b' // A2P Messaging: Local - Business
        : 'RN63da8244384cf0401c39f5f91e674db5'; // Starter A2P Messaging: Direct Customers

      const customerProfile = await pClient.trusthub.v1.customerProfiles.create({
        friendlyName: `${business.name} Profile`,
        email: business.contact_email,
        policyId: CUSTOMER_PROFILE_POLICY,
      });
      const customerProfileSid = customerProfile.sid;
      console.log(`  ✓ Customer Profile created: ${customerProfileSid}`);

      // Attach end-user (contact info) to the profile
      const endUser = await pClient.trusthub.v1.endUsers.create({
        friendlyName: `${business.contact_first_name} ${business.contact_last_name}`,
        type: isLlcCorp ? 'business_information' : 'sole_proprietor_information',
        attributes: profileAttributes,
      });

      await pClient.trusthub.v1.customerProfiles(customerProfileSid)
        .customerProfilesEntityAssignments.create({ objectSid: endUser.sid });
      console.log(`  ✓ End-user attached to Customer Profile`);

      // Submit Customer Profile for review
      await pClient.trusthub.v1.customerProfiles(customerProfileSid).update({ status: 'pending-review' });
      console.log(`  ✓ Customer Profile submitted for review`);

      // ── Step 1b: Create A2P Messaging Profile (Trust Product) ──────────────────
      const a2pProfile = await pClient.trusthub.v1.trustProducts.create({
        friendlyName: `${business.name} A2P Profile`,
        email: business.contact_email,
        policyId: A2P_MESSAGING_PROFILE_POLICY,
      });
      const a2pProfileSid = a2pProfile.sid;
      console.log(`  ✓ A2P Messaging Profile created: ${a2pProfileSid}`);

      await pClient.trusthub.v1.trustProducts(a2pProfileSid)
        .trustProductsEntityAssignments.create({ objectSid: customerProfileSid });
      console.log(`  ✓ Customer Profile attached to A2P Messaging Profile`);

      await pClient.trusthub.v1.trustProducts(a2pProfileSid).update({ status: 'pending-review' });
      console.log(`  ✓ A2P Messaging Profile submitted for review`);

      // ── Step 2: Create Brand Registration ──────────────────────────────────────
      const brand = await pClient.messaging.v1.brandRegistrations.create({
        customerProfileBundleSid: customerProfileSid,
        a2PProfileBundleSid: a2pProfileSid,
      });
      const brandSid = brand.sid;
      console.log(`  ✓ Brand Registration created: ${brandSid}`);

      await knex('businesses').where('id', businessId).update({
        sms_brand_id: brandSid,
        updated_at: knex.raw('CURRENT_TIMESTAMP'),
      });

      // ── Step 3: Create Messaging Campaign ─────────────────────────────────────
      const usecase = business.entity_type === 'sole_prop' ? 'LOW_VOLUME_MIXED' : 'MIXED';

      const campaign = await pClient.messaging.v1.services(business.twilio_messaging_service_sid)
        .usAppToPerson.create({
          brandRegistrationSid: brandSid,
          description: `${business.name} — service notifications, appointment confirmations, and customer communications`,
          messageSamples: [
            'Hi [Name], your service is scheduled for [Date]. Reply C to confirm or T to update your task list.',
            'Your [Business] service was completed today. Reply to leave feedback.',
          ],
          usAppToPersonUsecase: usecase,
          hasEmbeddedLinks: true,
          hasEmbeddedPhone: false,
        });
      const campaignSid = campaign.sid;
      console.log(`  ✓ Messaging Campaign created: ${campaignSid}`);

      // ── Persist final state ────────────────────────────────────────────────────
      await knex('businesses').where('id', businessId).update({
        sms_campaign_id: campaignSid,
        a2p_registration_status: 'pending',
        updated_at: knex.raw('CURRENT_TIMESTAMP'),
      });

      console.log(`✅ A2P 10DLC registration submitted for business ${businessId} — awaiting carrier approval`);
    } catch (err) {
      // Do not log `ein` — log only the error message and step context
      console.error(`❌ A2P registration failed for business ${businessId}:`, err.message);
      await knex('businesses').where('id', businessId).update({
        a2p_registration_status: 'failed',
        updated_at: knex.raw('CURRENT_TIMESTAMP'),
      });
    }
  }

  // ── Inbound webhook ───────────────────────────────────────────────────────────
  parseInbound(req) {
    const {
      To: toPhone,
      From: fromPhone,
      Body: body,
      MessageSid: messageId,
      NumMedia: numMediaStr,
    } = req.body;

    const numMedia = parseInt(numMediaStr) || 0;
    const media = [];
    for (let i = 0; i < numMedia; i++) {
      media.push({
        url: req.body[`MediaUrl${i}`],
        contentType: req.body[`MediaContentType${i}`] || 'image/jpeg',
        authRequired: true,
      });
    }

    return {
      toPhone,
      fromPhone,
      body,
      messageId: messageId || null,
      subgroupId: null,
      media,
    };
  }

  // Twilio inbound webhooks are not signature-validated today — preserve that.
  verifyInboundSignature(req) {
    return true;
  }

  /**
   * Download a Twilio media URL to disk using Basic auth. Follows redirects
   * (Twilio may redirect to CDN; drop auth on redirect — CDN doesn't need it).
   */
  fetchInboundMedia(media, destPath) {
    const url = media.url;
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString('base64');

      const makeRequest = (targetUrl, sendAuth = true) => {
        const reqOptions = sendAuth ? { headers: { Authorization: `Basic ${auth}` } } : {};
        https.get(targetUrl, reqOptions, (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode)) {
            return makeRequest(res.headers.location, false);
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

      makeRequest(url);
    });
  }

  // ── OTP (Twilio Verify) ─────────────────────────────────────────────────────
  async sendOtp(phone) {
    // Throws on error (e.g. rate-limit 20429) — the route detects & maps it.
    await this._verifyClient().verifications.create({ to: phone, channel: 'sms' });
  }

  async verifyOtp(phone, code) {
    try {
      const check = await this._verifyClient().verificationChecks.create({ to: phone, code });
      return check.status === 'approved';
    } catch {
      // Twilio throws when the code is wrong/expired rather than returning status.
      return false;
    }
  }
}

module.exports = TwilioProvider;
