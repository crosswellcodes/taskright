/**
 * signalhouse-setup-teststack — provision ONE reusable test stack and KEEP it, so
 * send/OTP/inbound tests reuse it instead of paying setup costs every run.
 *
 * Creates (once): subgroup → mock brand (poll to VERIFIED) → number → campaign
 * (usecase CUSTOMER_CARE, mirrors our provider) → poll to ACTIVE. Saves the ids to a
 * gitignored backend/.signalhouse-test.json. Idempotent: if that file already has a
 * stack, it RE-POLLS the existing brand/campaign status instead of creating new ones
 * (so you can re-run to check whether the campaign has gone ACTIVE yet).
 *
 * Costs ~$20 ONCE (mock brand ~$4.50 + campaign ~$15 + number ~$1/mo). After that,
 * sends are pennies. Release with signalhouse-teardown-teststack.js when done.
 *
 * Run:  node scripts/signalhouse-setup-teststack.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', '.signalhouse-test.json');
const wire = (s) => String(s || '').replace(/\D/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isVerified = (s) => ['VERIFIED', 'VETTED_VERIFIED'].includes(String(s || '').toUpperCase());

function unwrap(res, label) {
  if (!res || !res.success) throw new Error(`${label}: ${res && (res.error ? JSON.stringify(res.error) : 'status ' + res.status)}`);
  return res.data;
}
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`   (saved → ${STATE_FILE})`);
}

async function pollBrand(sdk, subgroupId, refId) {
  for (let i = 0; i < 24; i++) {
    const data = unwrap(await sdk.brands.getBrands({ subgroupId }), 'getBrands');
    const arr = Array.isArray(data) ? data : (data.brands || data.records || []);
    const b = arr.find((x) => x && (x.referenceId === refId || x.subgroupId === subgroupId));
    if (b) { console.log(`   brand status: ${b.status} (brandId=${b.brandId || 'pending'})`); if (isVerified(b.status) && b.brandId) return b; }
    await sleep(5000);
  }
  return null;
}
async function pollCampaign(sdk, subgroupId, campaignId) {
  for (let i = 0; i < 36; i++) {
    const data = unwrap(await sdk.campaigns.getCampaigns({ subgroupId }), 'getCampaigns');
    const arr = Array.isArray(data) ? data : (data.campaigns || data.records || []);
    const c = arr.find((x) => x && x.campaignId === campaignId);
    if (c) { console.log(`   campaign status: ${c.status}`); if (String(c.status).toUpperCase() === 'ACTIVE') return c; }
    await sleep(5000);
  }
  return null;
}

(async () => {
  const token = process.env.SIGNALHOUSE_API_KEY;
  const baseUrl = process.env.SIGNALHOUSE_BASE_URL || 'https://v2.signalhouse.io';
  const groupId = process.env.SIGNALHOUSE_GROUP_ID;
  if (!token || !groupId) return console.error('❌ need SIGNALHOUSE_API_KEY + SIGNALHOUSE_GROUP_ID in backend/.env');

  const { SignalHouseSDK } = require('@signalhousellc/sdk');
  const sdk = new SignalHouseSDK({ apiKey: token, baseUrl });
  const state = loadState();
  const refId = state.referenceId || `teststack-${Date.now()}`;

  try {
    // Resume mode — a stack already exists; just re-poll its statuses.
    if (state.campaignId && state.subgroupId) {
      console.log(`Resume: existing stack (subgroup ${state.subgroupId}, campaign ${state.campaignId}) — re-polling…`);
      const c = await pollCampaign(sdk, state.subgroupId, state.campaignId);
      state.campaignStatus = c ? c.status : (state.campaignStatus || 'pending');
      saveState(state);
      console.log(c ? '\n✅ Campaign ACTIVE — stack is ready to send.' : `\n⏳ Campaign not ACTIVE yet (${state.campaignStatus}). Re-run later.`);
      return;
    }

    console.log(`Provisioning a fresh test stack (ref ${refId})…\n`);

    // 1. Subgroup
    const sg = unwrap(await sdk.subgroups.createSubgroup({ subgroupData: { groupId, subgroupName: `TaskRight TestStack ${Date.now()}`, country: 'US' } }), 'createSubgroup');
    state.subgroupId = sg.subgroupId; state.referenceId = refId; saveState(state);
    console.log(`1. subgroup ✓ ${state.subgroupId}`);

    // 2. Mock brand → VERIFIED
    const brandData = {
      subgroupId: state.subgroupId, entityType: 'PRIVATE_PROFIT', displayName: 'TaskRight TestStack', companyName: 'TaskRight TestStack Co',
      ein: '123456789', phone: '15075129073', street: '123 Test St', city: 'Lincoln', state: 'NE', postalCode: '68508',
      country: 'US', email: 'teststack@example.com', vertical: 'PROFESSIONAL', referenceId: refId, mock: true,
    };
    unwrap(await sdk.brands.createBrand({ brandData }), 'createBrand');
    console.log('2. mock brand created — polling to VERIFIED…');
    const brand = await pollBrand(sdk, state.subgroupId, refId);
    if (!brand) throw new Error('brand did not reach VERIFIED in the poll window');
    state.brandId = brand.brandId; saveState(state);
    console.log(`   ✓ brand VERIFIED — brandId=${state.brandId}`);

    // 3. Number
    const search = unwrap(await sdk.numbers.getAvailablePhoneNumbers({ smsEnabled: true, mmsEnabled: true, limit: 1 }), 'getAvailablePhoneNumbers');
    const num = wire(search.numbers && search.numbers[0] && search.numbers[0].number);
    if (!num) throw new Error('no number available');
    unwrap(await sdk.numbers.purchasePhoneNumber({ phoneNumbers: [num], subgroupId: state.subgroupId }), 'purchasePhoneNumber');
    state.number = num; saveState(state);
    console.log(`3. number purchased ✓ ${num} (polling until listed…)`);
    for (let i = 0; i < 8; i++) { await sleep(4000); const l = unwrap(await sdk.numbers.getPhoneNumbers({ subgroupId: state.subgroupId }), 'getPhoneNumbers'); const a = Array.isArray(l) ? l : (l.numbers || l.records || []); if (a.some((n) => wire(n.phoneNumber || n.number) === num)) { console.log('   ✓ number listed on subgroup'); break; } }

    // 4. Campaign (CUSTOMER_CARE — mirrors our provider) → ACTIVE
    const camp = unwrap(await sdk.campaigns.createCampaign({ campaignData: {
      useDefaultTemplate: true, brandId: state.brandId, usecase: 'CUSTOMER_CARE', phoneNumbers: [num], directLending: false, ageGated: false,
      sample1: 'Hi [Name], your [Business] service is scheduled for [Date]. Reply C to confirm, T to review tasks, D to request a date change, or N to leave a note for your team.',
      sample2: 'Your [Business] service was completed today — thank you! Reply to share quick feedback.',
    } }), 'createCampaign');
    state.campaignId = camp.campaignId; state.campaignStatus = camp.status; saveState(state);
    console.log(`4. campaign created ✓ campaignId=${state.campaignId} status=${camp.status} — polling to ACTIVE…`);
    const active = await pollCampaign(sdk, state.subgroupId, state.campaignId);
    state.campaignStatus = active ? active.status : state.campaignStatus; saveState(state);

    console.log('\n──────────');
    if (active) console.log('✅ Test stack READY. Run: node scripts/signalhouse-send.js --to=+15075129073');
    else console.log(`⏳ Stack provisioned but campaign is ${state.campaignStatus}, not ACTIVE yet.\n   Re-run this script later to re-poll — it will resume, not recreate.`);
    console.log(`   subgroup=${state.subgroupId} brand=${state.brandId} campaign=${state.campaignId} number=${state.number}`);
  } catch (e) {
    console.log('\n✗ setup error:', e.message);
    console.log('  (partial stack saved to .signalhouse-test.json — re-run to resume, or run teardown to clean up)');
  } finally {
    process.exit(0);
  }
})();
