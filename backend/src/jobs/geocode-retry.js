const schedule = require('node-schedule');
const {
  geocodeCustomer,
  findCustomersNeedingGeocode,
} = require('../services/businessService');

/**
 * Geocode retry sweep — heals customers with an address but no coordinates that
 * the fire-and-forget on-write geocode missed (transient Mapbox/network failure).
 * Runs hourly. Bounded by construction: only touches rows under the attempt cap
 * and past the backoff window, and geocodeCustomer increments attempts every pass,
 * so a genuinely unmappable address gets exactly GEOCODE_MAX_ATTEMPTS tries then
 * falls out of the query — until its address is edited (which resets attempts).
 * See shared/specs/GEOCODING_RELIABILITY.md §5.
 */
function startGeocodeRetryJob() {
  const job = schedule.scheduleJob('0 * * * *', async () => {
    console.log('\n📍 [Geocode Retry Job] Starting...');

    try {
      const due = await findCustomersNeedingGeocode(25); // batch cap per run

      let ok = 0, failed = 0;
      for (const c of due) {
        try {
          const result = await geocodeCustomer(c.id, c.address);
          if (result && result.ok) ok++; else failed++;
        } catch (error) {
          console.error(`✗ Geocode retry failed for customer ${c.id}:`, error.message);
          failed++;
        }
      }

      console.log(`✓ Geocode retry: ${due.length} due, ${ok} resolved, ${failed} still unmapped`);
      console.log('📍 [Geocode Retry Job] Complete\n');
    } catch (error) {
      console.error('✗ Geocode Retry Job Error:', error.message);
    }
  });

  console.log('✓ Geocode Retry Job scheduled (runs hourly)');
  return job;
}

module.exports = { startGeocodeRetryJob };
