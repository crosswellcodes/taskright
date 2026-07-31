const { knex, truncateAllTables, createTestBusiness } = require('./helpers');
const { getProvider } = require('../services/sms');

// P1 of the Twilio → SignalHouse migration: lock the provider-neutral sms_* schema
// contracts introduced by migration 026 + the dev-mode fallback that keeps the
// suite green without live credentials.
describe('P1: provider-neutral sms_* schema', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await knex.destroy();
  });

  test('a new business gets the sms_provider + vertical column defaults', async () => {
    const { business } = await createTestBusiness();
    const row = await knex('businesses').where('id', business.id).first();
    expect(row.sms_provider).toBe('twilio');
    expect(row.vertical).toBe('PROFESSIONAL');
  });

  test('dev-mode provisioning marks sms_provisioning_status = dev_mode', async () => {
    // No live Twilio creds in the test env → provisionBusiness must no-op to dev_mode.
    const { business } = await createTestBusiness();
    await getProvider('provision').provisionBusiness(business.id);
    const row = await knex('businesses').where('id', business.id).first();
    expect(row.sms_provisioning_status).toBe('dev_mode');
  });

  test('sms_message_id round-trips on the messages table', async () => {
    const { business } = await createTestBusiness();
    await knex('messages').insert({
      business_id: business.id,
      direction: 'outbound',
      body: 'hello',
      sms_message_id: 'SMtest12345',
      to_phone: '+15551234567',
      from_phone: '+15557654321',
    });
    const msg = await knex('messages').where('sms_message_id', 'SMtest12345').first();
    expect(msg).toBeTruthy();
    expect(msg.sms_message_id).toBe('SMtest12345');
  });
});
