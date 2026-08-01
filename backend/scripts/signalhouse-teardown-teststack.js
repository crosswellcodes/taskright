/**
 * signalhouse-teardown-teststack — release the persistent test stack (stops the
 * ~$1/mo number) and clear backend/.signalhouse-test.json. Run when done testing.
 *
 * Run:  node scripts/signalhouse-teardown-teststack.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', '.signalhouse-test.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let state;
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return console.log('nothing to tear down (no .signalhouse-test.json)'); }

  const { SignalHouseSDK } = require('@signalhousellc/sdk');
  const sdk = new SignalHouseSDK({ apiKey: process.env.SIGNALHOUSE_API_KEY, baseUrl: process.env.SIGNALHOUSE_BASE_URL || 'https://v2.signalhouse.io' });

  if (state.number) { try { await sdk.numbers.deletePhoneNumbers({ phoneNumbers: [state.number] }); console.log(`number ${state.number} released`); } catch (e) { console.log('number release err:', e.message); } }
  if (state.campaignId) { try { await sdk.campaigns.deleteCampaign({ campaignId: state.campaignId }); console.log(`campaign ${state.campaignId} deleted`); } catch (e) { console.log('campaign delete err:', e.message); } }
  if (state.brandId) { try { await sdk.brands.deleteBrand({ brandId: state.brandId }); console.log(`brand ${state.brandId} deleted`); } catch (e) { console.log('brand delete err:', e.message); } }
  if (state.subgroupId) { for (let i = 0; i < 10; i++) { const s = await sdk.subgroups.deleteSubgroup({ id: state.subgroupId }); if (s.success) { console.log(`subgroup ${state.subgroupId} deleted`); break; } await sleep(3000); } }

  fs.unlinkSync(STATE_FILE);
  console.log('cleared .signalhouse-test.json — stack torn down.');
  process.exit(0);
})();
