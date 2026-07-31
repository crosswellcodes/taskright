const request = require('supertest');
const { app, knex, truncateAllTables, createTestBusiness } = require('./helpers');
const SignalHouseProvider = require('../services/sms/SignalHouseProvider');

async function waitFor(predicateFn, { tries = 40, delayMs = 25 } = {}) {
  for (let i = 0; i < tries; i++) {
    const v = await predicateFn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

function fakeClient(overrides = {}) {
  const calls = { createSubgroup: [], getAvailable: [], purchase: [], createBrand: [], createCampaign: [] };
  return {
    calls,
    subgroups: {
      createSubgroup: async (p) => { calls.createSubgroup.push(p); return overrides.subgroup || { success: true, data: { subgroupId: 'S0000001', status: 'active' } }; },
    },
    numbers: {
      getAvailablePhoneNumbers: async (p) => { calls.getAvailable.push(p); return overrides.available || { success: true, data: { numbers: [{ number: '+15557778888' }] } }; },
      purchasePhoneNumber: async (p) => { calls.purchase.push(p); return overrides.purchase || { success: true, data: { message: 'queued' } }; },
    },
    brands: {
      createBrand: async (p) => { calls.createBrand.push(p); return overrides.brand || { success: true, data: { _id: 'BREC1', brandId: null, status: 'PENDING_CREATION', ein: p.brandData.ein } }; },
    },
    campaigns: {
      createCampaign: async (p) => { calls.createCampaign.push(p); return overrides.campaign || { success: true, data: { campaignId: 'C0000001', status: 'PENDING_REVIEW' } }; },
    },
  };
}

// P4: provisioning (subgroup + number) + A2P (brand → webhook → campaign), event-driven.
// Exercised with injected fake clients + DB; no live credentials or network.
describe('P4: SignalHouse provisioning + A2P', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(async () => {
    await truncateAllTables();
    process.env.SIGNALHOUSE_API_KEY = 'test-key';
    process.env.SIGNALHOUSE_BASE_URL = 'https://v2staging.signalhouse.io';
    process.env.SIGNALHOUSE_GROUP_ID = 'G1234567';
    process.env.SIGNALHOUSE_WEBHOOK_SECRET = 'test-secret';
  });

  afterEach(() => {
    for (const k of ['SIGNALHOUSE_API_KEY', 'SIGNALHOUSE_BASE_URL', 'SIGNALHOUSE_GROUP_ID', 'SIGNALHOUSE_WEBHOOK_SECRET', 'SMS_PROVIDER_INBOUND', 'SMS_PROVIDER_PROVISION']) {
      if (OLD_ENV[k] === undefined) delete process.env[k];
      else process.env[k] = OLD_ENV[k];
    }
  });

  afterAll(async () => {
    await knex.destroy();
  });

  describe('provisionBusiness', () => {
    test('creates the subgroup + purchases a number, persists sms_* + provider pin', async () => {
      const { business } = await createTestBusiness();
      const client = fakeClient();
      await new SignalHouseProvider({ client }).provisionBusiness(business.id);

      expect(client.calls.createSubgroup[0].subgroupData.groupId).toBe('G1234567');
      expect(client.calls.createSubgroup[0].subgroupData.subgroupName).toBe(business.name);
      expect(client.calls.purchase[0]).toEqual({ phoneNumbers: ['15557778888'], subgroupId: 'S0000001' });

      const row = await knex('businesses').where('id', business.id).first();
      expect(row.sms_subgroup_id).toBe('S0000001');
      expect(row.sms_phone_number).toBe('+15557778888');
      expect(row.sms_provisioning_status).toBe('pending');
      expect(row.sms_provider).toBe('signalhouse');
    });

    test('dev-mode (unconfigured) marks dev_mode + pins provider, no client calls', async () => {
      delete process.env.SIGNALHOUSE_API_KEY;
      const { business } = await createTestBusiness();
      const client = fakeClient();
      await new SignalHouseProvider({ client }).provisionBusiness(business.id);

      expect(client.calls.createSubgroup).toHaveLength(0);
      const row = await knex('businesses').where('id', business.id).first();
      expect(row.sms_provisioning_status).toBe('dev_mode');
      expect(row.sms_provider).toBe('signalhouse');
    });

    test('no available numbers → provisioning failed', async () => {
      const { business } = await createTestBusiness();
      const client = fakeClient({ available: { success: true, data: { numbers: [] } } });
      await new SignalHouseProvider({ client }).provisionBusiness(business.id);

      const row = await knex('businesses').where('id', business.id).first();
      expect(row.sms_provisioning_status).toBe('failed');
    });
  });

  describe('registerA2P', () => {
    test('creates a PRIVATE_PROFIT brand with our decisions + EIN transient, marks pending', async () => {
      const { business } = await createTestBusiness();
      const client = fakeClient();
      await new SignalHouseProvider({ client }).registerA2P(business.id, '987654321');

      const bd = client.calls.createBrand[0].brandData;
      expect(bd.entityType).toBe('PRIVATE_PROFIT');
      expect(bd.vertical).toBe('PROFESSIONAL');
      expect(bd.referenceId).toBe(String(business.id));
      expect(bd.ein).toBe('987654321'); // passed transiently

      const row = await knex('businesses').where('id', business.id).first();
      expect(row.a2p_registration_status).toBe('pending');
    });

    test('EIN is never persisted anywhere on the business row', async () => {
      const { business } = await createTestBusiness();
      await new SignalHouseProvider({ client: fakeClient() }).registerA2P(business.id, '987654321');
      const row = await knex('businesses').where('id', business.id).first();
      expect(JSON.stringify(row)).not.toContain('987654321');
    });

    test('dev-mode (unconfigured) is a no-op', async () => {
      delete process.env.SIGNALHOUSE_API_KEY;
      const { business } = await createTestBusiness();
      const client = fakeClient();
      await new SignalHouseProvider({ client }).registerA2P(business.id, '987654321');
      expect(client.calls.createBrand).toHaveLength(0);
    });
  });

  describe('handleWebhookEvent', () => {
    async function provisionedBusiness() {
      const { business } = await createTestBusiness();
      await knex('businesses').where('id', business.id).update({
        sms_subgroup_id: 'S0000001', sms_phone_number: '+15557778888', sms_provisioning_status: 'pending',
      });
      return business;
    }

    test('BRAND_CREATION_SUCCESSFUL stores brandId but does NOT create the campaign yet', async () => {
      // Campaign create requires a VERIFIED brand (confirmed live) — so brand-created
      // only stores the id; the campaign waits for BRAND_IDENTITY_STATUS_UPDATED.
      const business = await provisionedBusiness();
      const client = fakeClient();
      const req = { body: { event: 'BRAND_CREATION_SUCCESSFUL', metaData: { Brand: { referenceId: String(business.id), brandId: 'BXYZ' } } } };
      await new SignalHouseProvider({ client }).handleWebhookEvent(req);

      expect(client.calls.createCampaign).toHaveLength(0);
      const row = await knex('businesses').where('id', business.id).first();
      expect(row.sms_brand_id).toBe('BXYZ');
      expect(row.sms_campaign_id).toBeNull();
    });

    test('BRAND_IDENTITY_STATUS_UPDATED (VERIFIED) creates the campaign', async () => {
      const business = await provisionedBusiness();
      await knex('businesses').where('id', business.id).update({ sms_brand_id: 'BXYZ' });
      const client = fakeClient();
      const req = { body: { event: 'BRAND_IDENTITY_STATUS_UPDATED', metaData: { Brand: { referenceId: String(business.id), status: 'VERIFIED' } } } };
      await new SignalHouseProvider({ client }).handleWebhookEvent(req);

      expect(client.calls.createCampaign[0].campaignData.brandId).toBe('BXYZ');
      expect(client.calls.createCampaign[0].campaignData.usecase).toBe('CUSTOMER_CARE');
      expect(client.calls.createCampaign[0].campaignData.phoneNumbers).toEqual(['15557778888']);

      const row = await knex('businesses').where('id', business.id).first();
      expect(row.sms_campaign_id).toBe('C0000001');
    });

    test('CAMPAIGN_APPROVED marks a2p approved + stores campaignId', async () => {
      const business = await provisionedBusiness();
      const req = { body: { event: 'CAMPAIGN_APPROVED_BY_SIGNAL_HOUSE', metaData: { Campaign: { referenceId: String(business.id), campaignId: 'CAPPROVED' } } } };
      await new SignalHouseProvider({ client: fakeClient() }).handleWebhookEvent(req);

      const row = await knex('businesses').where('id', business.id).first();
      expect(row.a2p_registration_status).toBe('approved');
      expect(row.sms_campaign_id).toBe('CAPPROVED');
    });

    test('NUMBER_UPDATED READY marks provisioning active', async () => {
      const business = await provisionedBusiness();
      const req = { body: { event: 'NUMBER_UPDATED', metaData: { Number: { referenceId: String(business.id), status: 'READY' } } } };
      await new SignalHouseProvider({ client: fakeClient() }).handleWebhookEvent(req);

      const row = await knex('businesses').where('id', business.id).first();
      expect(row.sms_provisioning_status).toBe('active');
    });

    test('BRAND_CREATION_FAILED marks a2p failed', async () => {
      const business = await provisionedBusiness();
      const req = { body: { event: 'BRAND_CREATION_FAILED', metaData: { Brand: { referenceId: String(business.id) } } } };
      await new SignalHouseProvider({ client: fakeClient() }).handleWebhookEvent(req);

      const row = await knex('businesses').where('id', business.id).first();
      expect(row.a2p_registration_status).toBe('failed');
    });

    test('unknown referenceId is a no-op (no throw)', async () => {
      const req = { body: { event: 'NUMBER_UPDATED', metaData: { Number: { referenceId: '99999999', status: 'READY' } } } };
      await expect(new SignalHouseProvider({ client: fakeClient() }).handleWebhookEvent(req)).resolves.toBeUndefined();
    });
  });

  describe('POST /api/webhooks/inbound-sms (event dispatch)', () => {
    test('routes a provisioning event to the handler (not the message path)', async () => {
      process.env.SMS_PROVIDER_INBOUND = 'signalhouse';
      const { business } = await createTestBusiness();
      await knex('businesses').where('id', business.id)
        .update({ sms_subgroup_id: 'SUBX', sms_provisioning_status: 'pending' });

      const envelope = { event: 'NUMBER_UPDATED', metaData: { Number: { referenceId: String(business.id), status: 'READY' } } };
      const res = await request(app)
        .post('/api/webhooks/inbound-sms')
        .set('x-webhook-secret', 'test-secret')
        .send(envelope);
      expect(res.status).toBe(200);

      const active = await waitFor(async () => {
        const row = await knex('businesses').where('id', business.id).first();
        return row.sms_provisioning_status === 'active' ? row : null;
      });
      expect(active).toBeTruthy();

      // No message row should be created for a non-message event.
      const msgCount = await knex('messages').where('business_id', business.id).count('* as n').first();
      expect(Number(msgCount.n)).toBe(0);
    });
  });
});
