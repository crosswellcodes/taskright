/**
 * signalhouse-smoke — free, read-mostly control-plane validation of our SignalHouse
 * integration against the LIVE API. Confirms our payload shapes are accepted and the
 * response field paths our code reads are correct (the §10 "confirm live" items).
 *
 * Reads SIGNALHOUSE_API_KEY / _BASE_URL / _GROUP_ID from backend/.env (never printed).
 *
 * What it does (all free):
 *   1. getGroup / getMyOnboarding      — connectivity (read)
 *   2. getAvailablePhoneNumbers        — number search only (read; NEVER purchases)
 *   3. createSubgroup                  — first real write (cleaned up at the end)
 *   4. createBrand({ mock: true })     — mock brand, no real vetting cost
 *   5. poll getBrands                  — watch the mock brand's status / brandId
 *   6. createCampaign                  — if a mock brandId appears (mirrors _createCampaign)
 *
 * What it never does: purchase a number, send a message, or (by default) create the
 * real Global webhook. Flags:
 *   --keep       leave the test subgroup/brand in place (default: delete them)
 *   --no-brand   skip the mock brand + campaign steps
 *   --webhook    also create the Global inbound webhook (needs a real public API_BASE_URL)
 *
 * Run from the backend dir:  node scripts/signalhouse-smoke.js
 */
require('dotenv').config();

const args = new Set(process.argv.slice(2));
const KEEP = args.has('--keep');
const DO_BRAND = !args.has('--no-brand');
const DO_WEBHOOK = args.has('--webhook');

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.taskright.io';
const results = [];

async function step(name, fn) {
  process.stdout.write(`\n▶ ${name}\n`);
  try {
    const out = await fn();
    results.push({ name, ok: true });
    return out;
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
    results.push({ name, ok: false });
    return null;
  }
}

// SDK returns { success, data, status } — unwrap or throw a readable error.
function unwrap(res, label) {
  if (!res || !res.success) {
    const detail = res && (res.error ? JSON.stringify(res.error) : `status ${res.status}`);
    throw new Error(`${label} failed: ${detail}`);
  }
  return res.data;
}

(async () => {
  const token = process.env.SIGNALHOUSE_API_KEY;
  const baseUrl = process.env.SIGNALHOUSE_BASE_URL || 'https://v2.signalhouse.io';
  const groupId = process.env.SIGNALHOUSE_GROUP_ID;

  if (!token) return console.error('❌ SIGNALHOUSE_API_KEY not set in backend/.env');
  if (!groupId) return console.error('❌ SIGNALHOUSE_GROUP_ID not set in backend/.env (run signalhouse-whoami.js)');

  let SignalHouseSDK;
  try { ({ SignalHouseSDK } = require('@signalhousellc/sdk')); }
  catch (e) { return console.error('❌ SDK not installed:', e.message); }

  const sdk = new SignalHouseSDK({ apiKey: token, baseUrl });
  console.log(`SignalHouse smoke test — group ${groupId} @ ${baseUrl}`);

  // ── 1. Connectivity ─────────────────────────────────────────────────────────
  await step('getGroup (connectivity)', async () => {
    const data = unwrap(await sdk.groups.getGroup({ id: groupId }), 'getGroup');
    const g = Array.isArray(data) ? data[0] : data;
    console.log(`  ✓ ${g.groupName} — status ${g.status}, compliance ${g.complianceStatus}`);
  });

  // ── 2. Number search (read only — never purchases) ──────────────────────────
  await step('getAvailablePhoneNumbers (search only)', async () => {
    const data = unwrap(await sdk.numbers.getAvailablePhoneNumbers({ smsEnabled: true, mmsEnabled: true, limit: 3 }), 'getAvailablePhoneNumbers');
    const numbers = (data && data.numbers) || [];
    console.log(`  ✓ ${numbers.length} available number(s); response path data.numbers[].number = ${numbers[0] ? numbers[0].number : 'n/a'}`);
    if (!data || !('numbers' in data)) console.log('  ⚠️  response has no `numbers` key — provisionBusiness reads data.numbers; confirm path');
  });

  // ── 3. createSubgroup (first real write) ────────────────────────────────────
  let subgroupId = null;
  await step('createSubgroup (write)', async () => {
    const subgroupData = { groupId, subgroupName: `TaskRight Smoke ${Date.now()}`, country: 'US' };
    const data = unwrap(await sdk.subgroups.createSubgroup({ subgroupData }), 'createSubgroup');
    subgroupId = data.subgroupId;
    console.log(`  ✓ subgroupId = ${subgroupId} (status ${data.status})`);
    if (!subgroupId) console.log('  ⚠️  no data.subgroupId — provisionBusiness reads that path; confirm');
  });

  // ── 4/5/6. Mock brand → status → campaign ───────────────────────────────────
  let brandId = null;
  if (DO_BRAND && subgroupId) {
    await step('createBrand (mock: true)', async () => {
      const brandData = {
        subgroupId, entityType: 'PRIVATE_PROFIT',
        displayName: 'TaskRight Smoke', companyName: 'TaskRight Smoke Co',
        ein: '123456789', phone: '15075129073',
        street: '123 Test St', city: 'Lincoln', state: 'NE', postalCode: '68508', country: 'US',
        email: 'smoke@example.com', vertical: 'PROFESSIONAL', referenceId: 'smoke-test',
        mock: true,
      };
      const data = unwrap(await sdk.brands.createBrand({ brandData }), 'createBrand');
      console.log(`  ✓ brand record _id=${data._id}, status=${data.status}, brandId=${data.brandId || '(null — arrives async)'}`);
    });

    await step('getBrands (poll mock status for brandId)', async () => {
      for (let i = 0; i < 6; i++) {
        const data = unwrap(await sdk.brands.getBrands({ subgroupId }), 'getBrands');
        const list = Array.isArray(data) ? data : (data.brands || data.records || []);
        const brand = list.find((b) => b && (b.referenceId === 'smoke-test' || b.subgroupId === subgroupId));
        if (brand) {
          brandId = brand.brandId || null;
          console.log(`  ✓ brand status=${brand.status || brand.identityStatus || '?'}, brandId=${brandId || '(pending)'}`);
          if (brandId) return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      console.log('  ⚠️  no brandId within poll window (mock may still be processing)');
    });

    if (brandId) {
      await step('createCampaign (mock brand)', async () => {
        const campaignData = {
          useDefaultTemplate: true, brandId, usecase: 'CUSTOMER_CARE',
          phoneNumbers: [], directLending: false, ageGated: false,
          sample1: 'Hi [Name], your [Business] service is scheduled for [Date]. Reply C to confirm, T to review tasks, D to request a date change, or N to leave a note.',
          // campaign create rejects referenceId (verified live) — omit it.
        };
        const data = unwrap(await sdk.campaigns.createCampaign({ campaignData }), 'createCampaign');
        console.log(`  ✓ campaignId=${data.campaignId}, status=${data.status}`);
      });
    }
  }

  // ── Optional: create the real Global webhook (needs a real public API_BASE_URL) ─
  if (DO_WEBHOOK) {
    await step('createWebhook (Global inbound)', async () => {
      const webhookData = {
        groupId, name: 'TaskRight inbound (Global)', endpointType: 'Global',
        url: `${API_BASE_URL}/api/webhooks/inbound-sms`,
        subscribedEvents: ['MESSAGE_RECEIVED', 'BRAND_CREATION_SUCCESSFUL', 'CAMPAIGN_APPROVED_BY_SIGNAL_HOUSE', 'NUMBER_UPDATED'],
        authType: 'API_KEY', apiHeaderPrefix: 'x-webhook-secret',
        credentials: { apiKey: process.env.SIGNALHOUSE_WEBHOOK_SECRET || 'set-a-secret' },
      };
      const data = unwrap(await sdk.webhooks.createWebhook({ webhookData }), 'createWebhook');
      console.log(`  ✓ webhook _id=${data._id} → ${webhookData.url}`);
      console.log('  ⚠️  Verify this URL is your real, publicly-reachable endpoint.');
    });
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  if (subgroupId && !KEEP) {
    await step('cleanup: deleteSubgroup', async () => {
      unwrap(await sdk.subgroups.deleteSubgroup({ id: subgroupId }), 'deleteSubgroup');
      console.log(`  ✓ deleted test subgroup ${subgroupId}`);
    });
  } else if (subgroupId) {
    console.log(`\n(kept test subgroup ${subgroupId} — --keep)`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n──────────  SUMMARY  ──────────');
  for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'}  ${r.name}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} step(s) failed — see above.` : '\nAll steps passed. Control plane is live. ✅');
  process.exit(failed ? 1 : 0);
})();
