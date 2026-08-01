/**
 * signalhouse-send — send ONE real SMS through the persistent test stack (from
 * signalhouse-setup-teststack.js). Costs pennies per send. This is what confirms
 * whether a mock brand/campaign delivers a REAL SMS to a phone.
 *
 * Run:  node scripts/signalhouse-send.js --to=+15075129073 [--body="custom text"]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', '.signalhouse-test.json');
const wire = (s) => String(s || '').replace(/\D/g, '');

const args = process.argv.slice(2);
const toArg = args.find((a) => a.startsWith('--to='));
const bodyArg = args.find((a) => a.startsWith('--body='));
const RECIPIENT = toArg ? toArg.split('=')[1] : null;
const BODY = bodyArg ? bodyArg.slice('--body='.length) : 'TaskRight × SignalHouse live test ✅';

(async () => {
  if (!RECIPIENT) return console.error('❌ pass --to=+1XXXXXXXXXX');

  let state;
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return console.error('❌ no .signalhouse-test.json — run signalhouse-setup-teststack.js first'); }
  if (!state.number) return console.error('❌ no number in the test stack — setup may not have finished');
  if (String(state.campaignStatus || '').toUpperCase() !== 'ACTIVE') {
    console.log(`⚠️  campaign status is "${state.campaignStatus || 'unknown'}", not ACTIVE — attempting the send anyway to see the API's response.`);
  }

  const { SignalHouseSDK } = require('@signalhousellc/sdk');
  const sdk = new SignalHouseSDK({ apiKey: process.env.SIGNALHOUSE_API_KEY, baseUrl: process.env.SIGNALHOUSE_BASE_URL || 'https://v2.signalhouse.io' });

  console.log(`Sending from ${state.number} → ${wire(RECIPIENT)} …`);
  const res = await sdk.messages.sendSMS({
    senderPhoneNumber: state.number,
    recipientPhoneNumbers: [wire(RECIPIENT)],
    messageBody: BODY,
  });

  if (!res || !res.success) {
    console.log(`❌ send failed (status ${res && res.status}): ${res && JSON.stringify(res.error)}`);
    return process.exit(1);
  }
  const d = res.data || {};
  const m = (d.insertedMessages && d.insertedMessages[0]) || {};
  console.log('✓ API accepted the request:');
  console.log(`   enqueuedCount = ${d.enqueuedCount}  failedCount = ${d.failedCount}  dncBlocked = ${(d.dncBlockedNumbers || []).length}`);
  console.log(`   message _id = ${m._id || 'n/a'}  status = ${m.status || 'n/a'}  errorCode = ${m.errorCode == null ? 'null' : m.errorCode}`);
  console.log(d.enqueuedCount ? '\n🎯 Enqueued — check the phone. If it arrives, mock delivers REAL SMS.' : '\n⚠️  enqueuedCount 0 — blocked/opt-out/sandbox; not delivered.');
  process.exit(0);
})();
