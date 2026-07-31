/**
 * signalhouse-whoami — read-only "is my SignalHouse token wired up, and what's my
 * group id?" probe. Reads SIGNALHOUSE_API_KEY from backend/.env (never printed).
 *
 * 1) Decodes the token locally (no network) to show its group claim.
 * 2) Confirms via a live read-only API call (getMyOnboarding / getGroup).
 *
 * Run from the backend dir:  node scripts/signalhouse-whoami.js
 */
require('dotenv').config();

function decodeJwtPayload(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length < 2) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

(async () => {
  const token = process.env.SIGNALHOUSE_API_KEY;
  if (!token) {
    console.error('❌ SIGNALHOUSE_API_KEY not set in backend/.env');
    process.exit(1);
  }

  // ── 1) Local decode (no network) ────────────────────────────────────────────
  const claims = decodeJwtPayload(token);
  let groupId = null;
  if (claims) {
    groupId = claims.activeGroupId || claims.groupId || null;
    console.log('🔑 Token claims (decoded locally, no network):');
    console.log('   groupId :', groupId || '(not present in token)');
    console.log('   role    :', claims.role || '(n/a)');
    if (claims.exp) console.log('   expires :', new Date(claims.exp * 1000).toISOString());
  } else {
    console.log('ℹ️  Token is not a decodable JWT — will rely on the API call.');
  }

  // ── 2) Live read-only confirmation ──────────────────────────────────────────
  const baseUrl = process.env.SIGNALHOUSE_BASE_URL || 'https://v2.signalhouse.io';
  let SignalHouseSDK;
  try {
    ({ SignalHouseSDK } = require('@signalhousellc/sdk'));
  } catch (e) {
    console.error('❌ SDK not installed:', e.message);
    process.exit(1);
  }

  const sdk = new SignalHouseSDK({ apiKey: token, baseUrl });
  console.log(`\n🌐 Calling SignalHouse API at ${baseUrl} …`);

  try {
    const onboarding = await sdk.onboarding.getMyOnboarding();
    if (onboarding && onboarding.success) {
      console.log('✓ getMyOnboarding OK');
      console.log(JSON.stringify(onboarding.data, null, 2));
    } else {
      console.log('⚠️  getMyOnboarding returned:', JSON.stringify(onboarding, null, 2));
    }
  } catch (e) {
    console.log('⚠️  getMyOnboarding call failed:', e.message);
  }

  if (groupId) {
    try {
      const grp = await sdk.groups.getGroup({ id: groupId });
      if (grp && grp.success) {
        console.log('\n✓ getGroup OK');
        console.log(JSON.stringify(grp.data, null, 2));
      } else {
        console.log('\n⚠️  getGroup returned:', JSON.stringify(grp, null, 2));
      }
    } catch (e) {
      console.log('\n⚠️  getGroup call failed:', e.message);
    }
  }

  console.log('\n──────────');
  console.log('GROUP ID  →', groupId || '(check the API output above)');
  console.log('Add to backend/.env:  SIGNALHOUSE_GROUP_ID=' + (groupId || '<from above>'));
  process.exit(0);
})();
