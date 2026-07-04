const twilio = require('twilio');
const knex = require('../db');

const PARENT_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const PARENT_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.taskright.io';

// Returns true only when real Twilio credentials are configured
function twilioIsConfigured() {
  return (
    PARENT_ACCOUNT_SID &&
    PARENT_ACCOUNT_SID.startsWith('AC') &&
    PARENT_AUTH_TOKEN &&
    PARENT_AUTH_TOKEN !== 'your_token'
  );
}

function parentClient() {
  return twilio(PARENT_ACCOUNT_SID, PARENT_AUTH_TOKEN);
}

function subaccountClient(subaccountSid) {
  return twilio(PARENT_ACCOUNT_SID, PARENT_AUTH_TOKEN, { accountSid: subaccountSid });
}

/**
 * Extract US area code from an E.164 phone number.
 * "+14135551234" → "413"
 * Falls back to "415" (San Francisco) if parsing fails.
 */
function extractAreaCode(e164Phone) {
  try {
    const digits = e164Phone.replace(/^\+1/, '');
    return digits.substring(0, 3);
  } catch {
    return '415';
  }
}

/**
 * Provision a dedicated Twilio subaccount + Messaging Service + local number
 * for a newly created business. Called fire-and-forget from auth signup.
 *
 * Steps:
 *   1. Create Twilio subaccount (named after the business)
 *   2. Create Messaging Service in the subaccount (sets inbound webhook)
 *   3. Search for + purchase a local number in the business's area code
 *   4. Add number to the Messaging Service pool
 *   5. Persist subaccount SID, phone number, and messaging service SID to DB
 */
async function provisionBusiness(businessId) {
  if (!twilioIsConfigured()) {
    console.warn(`⚠️  Twilio not configured — skipping provisioning for business ${businessId} (dev mode)`);
    await knex('businesses')
      .where('id', businessId)
      .update({ twilio_provisioning_status: 'dev_mode' });
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
    const subaccount = await parentClient().api.v2010.accounts.create({
      friendlyName: business.name
    });
    const subaccountSid = subaccount.sid;
    console.log(`  ✓ Subaccount created: ${subaccountSid}`);

    // Steps 2–5 use the parent client. messaging.twilio.com does not respect
    // the accountSid routing option, so Messaging Services and phone numbers
    // must live on the same account (parent). The subaccount above is retained
    // for organizational/billing purposes and future A2P registration.
    const pClient = parentClient();

    // ── Step 2: Create Messaging Service ────────────────────────────────────
    const messagingService = await pClient.messaging.v1.services.create({
      friendlyName: `${business.name} SMS`,
      inboundRequestUrl: `${API_BASE_URL}/api/webhooks/inbound-sms`,
      inboundMethod: 'POST',
      fallbackUrl: `${API_BASE_URL}/api/webhooks/inbound-sms`,
      fallbackMethod: 'POST'
    });
    const messagingServiceSid = messagingService.sid;
    console.log(`  ✓ Messaging Service created: ${messagingServiceSid}`);

    // ── Step 3: Find available local number ─────────────────────────────────
    const areaCode = extractAreaCode(business.phone_number);
    let phoneNumber;

    const available = await pClient.availablePhoneNumbers('US').local.list({
      areaCode: parseInt(areaCode),
      smsEnabled: true,
      limit: 1
    });

    if (available.length > 0) {
      phoneNumber = available[0].phoneNumber;
    } else {
      console.warn(`  ⚠️  No numbers in area code ${areaCode} — searching nationwide`);
      const fallback = await pClient.availablePhoneNumbers('US').local.list({
        smsEnabled: true,
        limit: 1
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
      phoneNumberSid: purchased.sid
    });
    console.log(`  ✓ Number added to Messaging Service`);

    // ── Persist to DB ────────────────────────────────────────────────────────
    await knex('businesses').where('id', businessId).update({
      twilio_subaccount_sid: subaccountSid,
      twilio_phone_number: phoneNumber,
      twilio_messaging_service_sid: messagingServiceSid,
      twilio_provisioning_status: 'active',
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    });

    console.log(`✅ Twilio provisioning complete for business ${businessId}`);
  } catch (err) {
    console.error(`❌ Twilio provisioning failed for business ${businessId}:`, err.message);
    await knex('businesses').where('id', businessId).update({
      twilio_provisioning_status: 'failed',
      updated_at: knex.raw('CURRENT_TIMESTAMP')
    });
  }
}

/**
 * Register a business for A2P 10DLC via Twilio Trust Hub.
 * Called fire-and-forget from the KYC route after KYC fields are saved.
 *
 * Chain: Customer Profile → Brand Registration → Messaging Campaign → link to Messaging Service
 * EIN is passed as a parameter and used only within this function — never written to DB or logs.
 *
 * @param {number} businessId
 * @param {string|null} ein - EIN for LLC/Corp path; null for Sole Prop
 */
async function registerA2P(businessId, ein) {
  if (!twilioIsConfigured()) {
    console.warn(`⚠️  Twilio not configured — skipping A2P registration for business ${businessId} (dev mode)`);
    return;
  }

  const business = await knex('businesses').where('id', businessId).first();
  if (!business) {
    console.error(`A2P registration failed: business ${businessId} not found`);
    return;
  }

  console.log(`🔧 Starting A2P 10DLC registration for business ${businessId} (${business.name})…`);

  const pClient = parentClient();

  try {
    // ── Step 1: Create Customer Profile ────────────────────────────────────────
    // Build the profile attributes. EIN is included for LLC/Corp only and is
    // never logged — do not add it to any console.log or error message.
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
    // brandRegistrations.create() requires two distinct bundle types:
    // customerProfileBundleSid = the Customer Profile above (entity identity, BU... SID)
    // a2PProfileBundleSid = a trustProducts bundle (messaging capability, BU... SID, separate type)
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
      a2p_brand_sid: brandSid,
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    });

    // ── Step 3: Create Messaging Campaign ─────────────────────────────────────
    // Use MIXED usecase for flexibility; LOW_VOLUME_MIXED for sole prop is also valid.
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
      a2p_campaign_sid: campaignSid,
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

module.exports = { provisionBusiness, registerA2P };
