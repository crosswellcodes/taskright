/**
 * signalhouse-trial-test — PAID EXPERIMENT. Tries to reach a real SMS send WITHOUT a
 * carrier-vetted brand, to answer two open questions:
 *   Q1: Does a mock brand ever reach VERIFIED (poll ~90s), or stall at PENDING_APPROVAL?
 *   Q2: Does usecase=TRIAL let createCampaign bypass the "brand must be VERIFIED" gate?
 * If a campaign reaches ACTIVE and --to=+1... is given, it sends one real SMS.
 *
 * Spends real money (~$4.50 mock brand + ~$1 number, +~$15 campaign only if it works).
 * Cleans up everything (number → campaign → brand → subgroup) at the end unless --keep.
 *
 * Run:  node scripts/signalhouse-trial-test.js [--to=+15551234567] [--keep]
 */
require('dotenv').config();

const args = process.argv.slice(2);
const KEEP = args.includes('--keep');
const toArg = args.find((a) => a.startsWith('--to='));
const RECIPIENT = toArg ? toArg.split('=')[1] : null;

function unwrap(res, label) {
  if (!res || !res.success) {
    throw new Error(`${label}: ${res && (res.error ? JSON.stringify(res.error) : 'status ' + res.status)}`);
  }
  return res.data;
}
const wire = (s) => String(s || '').replace(/\D/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const token = process.env.SIGNALHOUSE_API_KEY;
  const baseUrl = process.env.SIGNALHOUSE_BASE_URL || 'https://v2.signalhouse.io';
  const groupId = process.env.SIGNALHOUSE_GROUP_ID;
  if (!token || !groupId) return console.error('❌ need SIGNALHOUSE_API_KEY + SIGNALHOUSE_GROUP_ID in backend/.env');

  const { SignalHouseSDK } = require('@signalhousellc/sdk');
  const sdk = new SignalHouseSDK({ apiKey: token, baseUrl });
  console.log(`TRIAL experiment — group ${groupId} @ ${baseUrl}\n`);

  let subgroupId = null, brandId = null, campaignId = null, number = null;
  try {
    // 1. Subgroup
    const sg = unwrap(await sdk.subgroups.createSubgroup({ subgroupData: { groupId, subgroupName: `TaskRight TRIAL ${Date.now()}`, country: 'US' } }), 'createSubgroup');
    subgroupId = sg.subgroupId;
    console.log(`1. subgroup ✓ ${subgroupId}`);

    // 2. Mock brand + long poll for VERIFIED  (Q1)
    const brandData = {
      subgroupId, entityType: 'PRIVATE_PROFIT', displayName: 'TaskRight TRIAL', companyName: 'TaskRight TRIAL Co',
      ein: '123456789', phone: '15075129073', street: '123 Test St', city: 'Lincoln', state: 'NE',
      postalCode: '68508', country: 'US', email: 'trial@example.com', vertical: 'PROFESSIONAL', referenceId: 'trial-test', mock: true,
    };
    const br = unwrap(await sdk.brands.createBrand({ brandData }), 'createBrand');
    console.log(`2. mock brand ✓ _id=${br._id} status=${br.status}`);
    let brandStatus = br.status;
    for (let i = 0; i < 18; i++) {
      await sleep(5000);
      const list = unwrap(await sdk.brands.getBrands({ subgroupId }), 'getBrands');
      const arr = Array.isArray(list) ? list : (list.brands || list.records || []);
      const b = arr.find((x) => x && (x.referenceId === 'trial-test' || x.subgroupId === subgroupId));
      if (b) {
        brandId = b.brandId || brandId;
        if (b.status && b.status !== brandStatus) { brandStatus = b.status; console.log(`   brand status → ${brandStatus} (brandId=${brandId || 'pending'})`); }
        if (['VERIFIED', 'VETTED_VERIFIED'].includes(String(b.status || '').toUpperCase())) { console.log('   ✅ Q1: mock brand reached VERIFIED!'); break; }
      }
    }
    if (!['VERIFIED', 'VETTED_VERIFIED'].includes(String(brandStatus || '').toUpperCase())) {
      console.log(`   ⚠️  Q1: mock brand stalled at ${brandStatus} (never VERIFIED in ~90s)`);
    }

    // 3. Buy a number (needed for campaign)
    const search = unwrap(await sdk.numbers.getAvailablePhoneNumbers({ smsEnabled: true, mmsEnabled: true, limit: 1 }), 'getAvailablePhoneNumbers');
    number = wire(search.numbers && search.numbers[0] && search.numbers[0].number);
    if (!number) throw new Error('no number available');
    unwrap(await sdk.numbers.purchasePhoneNumber({ phoneNumbers: [number], subgroupId }), 'purchasePhoneNumber');
    console.log(`3. number purchased ✓ ${number}`);
    for (let i = 0; i < 6; i++) { await sleep(4000); const l = unwrap(await sdk.numbers.getPhoneNumbers({ subgroupId }), 'getPhoneNumbers'); const a = Array.isArray(l) ? l : (l.numbers || l.records || []); if (a.some((n) => wire(n.phoneNumber || n.number) === number)) break; }

    // 4. Campaign with usecase TRIAL  (Q2)
    if (!brandId) console.log('   (no brandId yet — attempting campaign anyway)');
    try {
      const camp = unwrap(await sdk.campaigns.createCampaign({ campaignData: {
        useDefaultTemplate: true, brandId, usecase: 'TRIAL', phoneNumbers: [number], directLending: false, ageGated: false,
        sample1: 'Hi [Name], your [Business] service is scheduled for [Date]. Reply C to confirm or T to review tasks.',
      } }), 'createCampaign');
      campaignId = camp.campaignId;
      console.log(`4. ✅ Q2: TRIAL campaign CREATED ✓ campaignId=${campaignId} status=${camp.status}`);
    } catch (e) {
      console.log(`4. ❌ Q2: TRIAL campaign rejected — ${e.message}`);
    }

    // 5. Poll campaign → ACTIVE, then optional send
    if (campaignId) {
      let cstatus = null;
      for (let i = 0; i < 12; i++) {
        const cl = unwrap(await sdk.campaigns.getCampaigns({ subgroupId }), 'getCampaigns');
        const ca = Array.isArray(cl) ? cl : (cl.campaigns || cl.records || []);
        const c = ca.find((x) => x && x.campaignId === campaignId);
        if (c && c.status !== cstatus) { cstatus = c.status; console.log(`   campaign status → ${cstatus}`); }
        if (String(cstatus || '').toUpperCase() === 'ACTIVE') break;
        await sleep(5000);
      }
      if (String(cstatus || '').toUpperCase() === 'ACTIVE') {
        if (RECIPIENT) {
          const snd = await sdk.messages.sendSMS({ senderPhoneNumber: number, recipientPhoneNumbers: [wire(RECIPIENT)], messageBody: 'TaskRight × SignalHouse test message ✅' });
          console.log(`5. send → success=${snd.success} enqueued=${snd.data && snd.data.enqueuedCount} id=${snd.data && snd.data.insertedMessages && snd.data.insertedMessages[0] && snd.data.insertedMessages[0]._id}`);
        } else {
          console.log('5. 🎯 Campaign ACTIVE — reached the SEND GATE. Re-run with --to=+1YOURNUMBER to send.');
        }
      } else {
        console.log(`5. campaign not ACTIVE (last status ${cstatus}) — send gate not reached`);
      }
    }
  } catch (e) {
    console.log('✗ experiment error:', e.message);
  } finally {
    if (!KEEP) {
      console.log('\ncleanup…');
      if (number) { try { await sdk.numbers.deletePhoneNumbers({ phoneNumbers: [number] }); console.log('  number released'); } catch (e) { console.log('  number release err:', e.message); } }
      if (campaignId) { try { await sdk.campaigns.deleteCampaign({ campaignId }); console.log('  campaign deleted'); } catch (e) { console.log('  campaign delete err:', e.message); } }
      if (brandId) { try { await sdk.brands.deleteBrand({ brandId }); console.log('  brand deleted'); } catch (e) { console.log('  brand delete err:', e.message); } }
      if (subgroupId) { for (let i = 0; i < 10; i++) { const s = await sdk.subgroups.deleteSubgroup({ id: subgroupId }); if (s.success) { console.log('  subgroup deleted'); break; } await sleep(3000); } }
    } else {
      console.log(`\n(kept: subgroup ${subgroupId}, brand ${brandId}, campaign ${campaignId}, number ${number})`);
    }
    process.exit(0);
  }
})();
