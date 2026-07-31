const request = require('supertest');
const { app, knex, truncateAllTables, createTestBusiness, createTestCustomer } = require('./helpers');
const SignalHouseProvider = require('../services/sms/SignalHouseProvider');

const makeReq = (body, headers = {}) => ({ body, headers });

async function waitForRow(queryFn, { tries = 40, delayMs = 25 } = {}) {
  for (let i = 0; i < tries; i++) {
    const row = await queryFn();
    if (row) return row;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

// P3: inbound webhook — parse the MESSAGE_RECEIVED envelope, verify the API_KEY
// secret, route by subgroupId, and create the one Global webhook. Exercised with
// fixtures + an injected client; no live credentials or network.
describe('P3: SignalHouse inbound', () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    for (const k of ['SMS_PROVIDER_INBOUND', 'SIGNALHOUSE_WEBHOOK_SECRET', 'SIGNALHOUSE_GROUP_ID', 'SIGNALHOUSE_API_KEY', 'SIGNALHOUSE_BASE_URL']) {
      if (OLD_ENV[k] === undefined) delete process.env[k];
      else process.env[k] = OLD_ENV[k];
    }
  });

  afterAll(async () => {
    await knex.destroy();
  });

  describe('parseInbound', () => {
    test('maps a MESSAGE_RECEIVED envelope, normalizing digits → E.164', () => {
      const req = makeReq({
        event: 'MESSAGE_RECEIVED',
        metaData: {
          Message: {
            _id: 'M1', subgroupId: 'S123',
            senderPhoneNumber: '15551239876', recipientPhoneNumber: '15550001111',
            messageBody: 'C',
            externalMediaUrls: ['https://cdn.signalhouse.io/a/b.png'],
          },
        },
      });
      expect(new SignalHouseProvider().parseInbound(req)).toEqual({
        toPhone: '+15550001111',
        fromPhone: '+15551239876',
        body: 'C',
        messageId: 'M1',
        subgroupId: 'S123',
        media: [{ url: 'https://cdn.signalhouse.io/a/b.png', contentType: 'image/png', authRequired: false }],
      });
    });

    test('no media → empty media array; falls back to phoneNumber for the recipient', () => {
      const req = makeReq({
        metaData: { Message: { _id: 'M2', subgroupId: 'S9', senderPhoneNumber: '15551112222', phoneNumber: '15550009999', messageBody: 'hi' } },
      });
      const inbound = new SignalHouseProvider().parseInbound(req);
      expect(inbound.media).toEqual([]);
      expect(inbound.toPhone).toBe('+15550009999');
      expect(inbound.body).toBe('hi');
    });
  });

  describe('verifyInboundSignature', () => {
    test('accepts a matching secret header, rejects wrong/missing/no-secret', () => {
      const p = new SignalHouseProvider();
      process.env.SIGNALHOUSE_WEBHOOK_SECRET = 'sekret';
      expect(p.verifyInboundSignature(makeReq({}, { 'x-webhook-secret': 'sekret' }))).toBe(true);
      expect(p.verifyInboundSignature(makeReq({}, { 'x-webhook-secret': 'wrong' }))).toBe(false);
      expect(p.verifyInboundSignature(makeReq({}, {}))).toBe(false);
      delete process.env.SIGNALHOUSE_WEBHOOK_SECRET;
      expect(p.verifyInboundSignature(makeReq({}, { 'x-webhook-secret': 'sekret' }))).toBe(false);
    });
  });

  describe('createInboundWebhook', () => {
    function fakeWebhookClient({ existing = null, createResult } = {}) {
      const calls = { getWebhooks: [], createWebhook: [] };
      return {
        calls,
        webhooks: {
          getWebhooks: async (p) => { calls.getWebhooks.push(p); return existing || { success: true, data: { webhooks: [] } }; },
          createWebhook: async (p) => { calls.createWebhook.push(p); return createResult || { success: true, data: { _id: 'WH1' } }; },
        },
      };
    }

    test('posts a Global webhook with our event set + API_KEY auth', async () => {
      const c = fakeWebhookClient();
      const res = await new SignalHouseProvider({ client: c }).createInboundWebhook();
      expect(res.created).toBe(true);
      expect(c.calls.createWebhook).toHaveLength(1);
      const wd = c.calls.createWebhook[0].webhookData;
      expect(wd.endpointType).toBe('Global');
      expect(wd.url).toMatch(/\/api\/webhooks\/inbound-sms$/);
      expect(wd.authType).toBe('API_KEY');
      expect(wd.subscribedEvents).toEqual(
        expect.arrayContaining(['MESSAGE_RECEIVED', 'CAMPAIGN_APPROVED_BY_SIGNAL_HOUSE', 'BRAND_CREATION_SUCCESSFUL'])
      );
    });

    test('is idempotent — skips create when a Global webhook already targets our URL', async () => {
      // Learn the URL the provider targets from a create, then present it as existing.
      const c1 = fakeWebhookClient();
      await new SignalHouseProvider({ client: c1 }).createInboundWebhook();
      const url = c1.calls.createWebhook[0].webhookData.url;

      const c2 = fakeWebhookClient({ existing: { success: true, data: { webhooks: [{ url }] } } });
      const res = await new SignalHouseProvider({ client: c2 }).createInboundWebhook();
      expect(res.created).toBe(false);
      expect(c2.calls.createWebhook).toHaveLength(0);
    });
  });

  describe('POST /api/webhooks/inbound-sms (routing + auth)', () => {
    beforeEach(async () => {
      await truncateAllTables();
      process.env.SMS_PROVIDER_INBOUND = 'signalhouse';
      process.env.SIGNALHOUSE_WEBHOOK_SECRET = 'test-secret';
    });

    test('routes to the business by subgroup and records the inbound message', async () => {
      const { business } = await createTestBusiness();
      await knex('businesses').where('id', business.id)
        .update({ sms_subgroup_id: 'SUB123', sms_phone_number: '+15550001111' });
      const { customer } = await createTestCustomer(business.id);
      const custDigits = String(customer.phoneNumber).replace(/\D/g, '');

      const envelope = {
        event: 'MESSAGE_RECEIVED',
        metaData: {
          Message: {
            _id: 'IN1', subgroupId: 'SUB123',
            senderPhoneNumber: custDigits, recipientPhoneNumber: '15550001111',
            messageBody: 'hello there', externalMediaUrls: [],
          },
        },
      };

      const res = await request(app)
        .post('/api/webhooks/inbound-sms')
        .set('x-webhook-secret', 'test-secret')
        .send(envelope);
      expect(res.status).toBe(200);

      const row = await waitForRow(() => knex('messages').where('sms_message_id', 'IN1').first());
      expect(row).toBeTruthy();
      expect(row.business_id).toBe(business.id);
      expect(row.customer_id).toBe(customer.id);
      expect(row.direction).toBe('inbound');
      expect(row.body).toBe('hello there');
    });

    test('rejects a bad secret with 401 and records nothing', async () => {
      const { business } = await createTestBusiness();
      await knex('businesses').where('id', business.id)
        .update({ sms_subgroup_id: 'SUB999', sms_phone_number: '+15550002222' });

      const envelope = {
        event: 'MESSAGE_RECEIVED',
        metaData: {
          Message: {
            _id: 'IN2', subgroupId: 'SUB999',
            senderPhoneNumber: '15551112222', recipientPhoneNumber: '15550002222',
            messageBody: 'hi', externalMediaUrls: [],
          },
        },
      };

      const res = await request(app)
        .post('/api/webhooks/inbound-sms')
        .set('x-webhook-secret', 'WRONG')
        .send(envelope);
      expect(res.status).toBe(401);

      await new Promise((r) => setTimeout(r, 50));
      const row = await knex('messages').where('sms_message_id', 'IN2').first();
      expect(row).toBeFalsy();
    });
  });
});
