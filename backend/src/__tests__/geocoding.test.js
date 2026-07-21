const { EventEmitter } = require('events');
const https = require('https');
const { knex, truncateAllTables, createTestBusiness } = require('./helpers');
const businessService = require('../services/businessService');

// ─── Mapbox mock ────────────────────────────────────────────────────────────
// geocodeCustomer → fetchGeocode uses the module-level https.get. We override it
// (same cached module object) so no real network call happens; each test seeds
// the next response with mockMapbox().
let nextResponse;
function mockMapbox(feature, statusCode = 200) {
  nextResponse = { statusCode, body: JSON.stringify({ features: feature ? [feature] : [] }) };
}
function feature(lng, lat, relevance) {
  return { center: [lng, lat], relevance, place_name: 'Somewhere, NE' };
}

let httpsSpy;
let businessId;
let phoneSeq = 0;

async function makeCustomer(fields = {}) {
  phoneSeq += 1;
  const [c] = await knex('customers').insert({
    business_id: businessId,
    name: 'Test Customer',
    phone_number: `+1402555${String(1000 + phoneSeq)}`,
    created_at: knex.raw('CURRENT_TIMESTAMP'),
    updated_at: knex.raw('CURRENT_TIMESTAMP'),
    ...fields,
  }).returning('*');
  return c;
}

// Flush the fire-and-forget geocode kicked off by updateCustomerDetails.
const flush = () => new Promise((r) => setImmediate(r));

beforeAll(() => {
  process.env.MAPBOX_ACCESS_TOKEN = 'test-token';
  httpsSpy = jest.spyOn(https, 'get').mockImplementation((url, cb) => {
    const res = new EventEmitter();
    res.statusCode = nextResponse.statusCode;
    cb(res);
    process.nextTick(() => {
      res.emit('data', nextResponse.body);
      res.emit('end');
    });
    return { on: () => {} };
  });
});

afterAll(async () => {
  httpsSpy.mockRestore();
  await knex.destroy();
});

beforeEach(async () => {
  await truncateAllTables();
  httpsSpy.mockClear();
  nextResponse = undefined;
  const biz = await createTestBusiness();
  businessId = biz.business.id;
});

describe('geocodeCustomer — on-write', () => {
  test('confident match stores coords + relevance, records one attempt', async () => {
    mockMapbox(feature(-96.7030, 40.7918, 0.95));
    const c = await makeCustomer({ address: '1234 South St, Lincoln NE' });

    const res = await businessService.geocodeCustomer(c.id, c.address);
    expect(res).toMatchObject({ ok: true });

    const row = await knex('customers').where('id', c.id).first();
    expect(Number(row.lat)).toBeCloseTo(40.7918, 3);
    expect(Number(row.lng)).toBeCloseTo(-96.7030, 3);
    expect(Number(row.geocode_relevance)).toBeCloseTo(0.95, 2);
    expect(row.geocode_attempts).toBe(1);
    expect(row.geocoded_at).not.toBeNull();
  });

  test('low-confidence match is NOT stored (G1) — coords stay null, relevance recorded', async () => {
    mockMapbox(feature(-78.577, 42.709, 0.5)); // the "South Wales" failure mode
    const c = await makeCustomer({ address: '123 Main Street West' });

    const res = await businessService.geocodeCustomer(c.id, c.address);
    expect(res).toMatchObject({ ok: false, reason: 'low_confidence' });

    const row = await knex('customers').where('id', c.id).first();
    expect(row.lat).toBeNull();
    expect(row.lng).toBeNull();
    expect(Number(row.geocode_relevance)).toBeCloseTo(0.5, 2);
    expect(row.geocode_attempts).toBe(1);
  });

  test('no match — coords null, attempt still recorded', async () => {
    mockMapbox(null);
    const c = await makeCustomer({ address: 'nowhere at all' });

    const res = await businessService.geocodeCustomer(c.id, c.address);
    expect(res).toMatchObject({ ok: false, reason: 'no_match' });

    const row = await knex('customers').where('id', c.id).first();
    expect(row.lat).toBeNull();
    expect(row.geocode_attempts).toBe(1);
  });

  test('no token → skipped, no attempt recorded, no network call', async () => {
    const saved = process.env.MAPBOX_ACCESS_TOKEN;
    delete process.env.MAPBOX_ACCESS_TOKEN;
    const c = await makeCustomer({ address: '1 Somewhere' });

    const res = await businessService.geocodeCustomer(c.id, c.address);
    expect(res).toEqual({ skipped: true });
    expect(httpsSpy).not.toHaveBeenCalled();

    const row = await knex('customers').where('id', c.id).first();
    expect(row.geocode_attempts).toBe(0);
    process.env.MAPBOX_ACCESS_TOKEN = saved;
  });

  test('attempt is recorded before the network resolves — counts toward the cap (G2)', async () => {
    mockMapbox(null);
    const c = await makeCustomer({ address: 'bad', geocode_attempts: 2 });

    await businessService.geocodeCustomer(c.id, c.address);
    const row = await knex('customers').where('id', c.id).first();
    expect(row.geocode_attempts).toBe(3); // hits the cap
  });
});

describe('updateCustomerDetails — reset on address change', () => {
  test('new address clears old pin, resets attempts, then re-geocodes', async () => {
    // Start with a mapped customer that had prior failed attempts.
    const c = await makeCustomer({
      address: 'old address', lat: 40.0, lng: -96.0,
      geocode_relevance: 0.9, geocode_attempts: 2,
    });

    mockMapbox(null); // the re-geocode misses, so we can observe the reset cleanly
    await businessService.updateCustomerDetails(c.id, { address: 'a brand new address' });
    await flush();

    const row = await knex('customers').where('id', c.id).first();
    expect(row.address).toBe('a brand new address');
    expect(row.lat).toBeNull();                 // old pin cleared
    expect(row.geocode_relevance).toBeNull();
    // reset 2 → 0, then the fire-and-forget re-geocode incremented to 1
    expect(row.geocode_attempts).toBe(1);
  });

  test('clearing address nulls everything and does NOT geocode', async () => {
    const c = await makeCustomer({
      address: 'some address', lat: 40.0, lng: -96.0,
      geocode_relevance: 0.9, geocode_attempts: 1,
    });
    httpsSpy.mockClear();

    await businessService.updateCustomerDetails(c.id, { address: '' });
    await flush();

    const row = await knex('customers').where('id', c.id).first();
    expect(row.address).toBeNull();
    expect(row.lat).toBeNull();
    expect(row.geocoded_at).toBeNull();
    expect(row.geocode_relevance).toBeNull();
    expect(row.geocode_attempts).toBe(0);
    expect(httpsSpy).not.toHaveBeenCalled();
  });

  test('updating a non-address field leaves geocode tracking untouched', async () => {
    const c = await makeCustomer({
      address: 'stable address', lat: 40.0, lng: -96.0,
      geocode_relevance: 0.9, geocode_attempts: 1,
    });
    httpsSpy.mockClear();

    await businessService.updateCustomerDetails(c.id, { notes: 'hello' });
    await flush();

    const row = await knex('customers').where('id', c.id).first();
    expect(Number(row.lat)).toBe(40.0);
    expect(row.geocode_attempts).toBe(1);
    expect(httpsSpy).not.toHaveBeenCalled();
  });
});

describe('deriveGeocodeStatus', () => {
  const s = (c) => businessService.deriveGeocodeStatus(c);
  test('no address → none', () => {
    expect(s({ address: null })).toBe('none');
  });
  test('has coords → ok', () => {
    expect(s({ address: 'x', lat: 40, geocode_attempts: 1 })).toBe('ok');
  });
  test('no coords, under cap → pending', () => {
    expect(s({ address: 'x', lat: null, geocode_attempts: 1 })).toBe('pending');
  });
  test('no coords, at cap → failed', () => {
    expect(s({ address: 'x', lat: null, geocode_attempts: 3 })).toBe('failed');
  });
});

describe('findCustomersNeedingGeocode — bounded due-selection', () => {
  test('selects only address-without-coords rows under the cap and past backoff', async () => {
    const due1 = await makeCustomer({ address: 'due, never tried' }); // attempts 0, attempted_at null
    const dueOld = await makeCustomer({ address: 'due, tried long ago', geocode_attempts: 1 });
    await knex('customers').where('id', dueOld.id)
      .update({ geocode_attempted_at: knex.raw(`NOW() - INTERVAL '7 hours'`) });

    const mapped = await makeCustomer({ address: 'already mapped', lat: 40.0, lng: -96.0 });
    const capped = await makeCustomer({ address: 'gave up', geocode_attempts: 3 });
    await knex('customers').where('id', capped.id)
      .update({ geocode_attempted_at: knex.raw(`NOW() - INTERVAL '7 hours'`) });
    const recent = await makeCustomer({ address: 'tried just now', geocode_attempts: 1 });
    await knex('customers').where('id', recent.id)
      .update({ geocode_attempted_at: knex.raw('CURRENT_TIMESTAMP') });
    const noAddr = await makeCustomer({ address: null });

    const rows = await businessService.findCustomersNeedingGeocode(25);
    const ids = rows.map((r) => r.id).sort((a, b) => a - b);

    expect(ids).toEqual([due1.id, dueOld.id].sort((a, b) => a - b));
    expect(ids).not.toContain(mapped.id);
    expect(ids).not.toContain(capped.id);
    expect(ids).not.toContain(recent.id);
    expect(ids).not.toContain(noAddr.id);
  });

  test('respects the limit', async () => {
    await makeCustomer({ address: 'a' });
    await makeCustomer({ address: 'b' });
    await makeCustomer({ address: 'c' });
    const rows = await businessService.findCustomersNeedingGeocode(2);
    expect(rows).toHaveLength(2);
  });
});
