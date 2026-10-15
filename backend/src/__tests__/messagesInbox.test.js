const request = require('supertest');
const {
  app, knex, truncateAllTables, createTestBusiness, addCustomerToBusiness,
} = require('./helpers');
const { getProvider } = require('../services/sms');

// Web portal M4 (Messages): unified inbox, explicit mark-read (messages.read_at,
// migration 028), Home's unread Action Center item, and send-failure surfacing.

let businessId, token, alice, bob;
const auth = (req) => req.set('Authorization', `Bearer ${token}`);

// Insert a message row directly (inbound arrives via webhook; no provider in tests).
async function msg(customerId, direction, body, extra = {}) {
  const [row] = await knex('messages').insert({
    business_id: extra.businessId || businessId,
    customer_id: customerId,
    direction,
    body,
    media_urls: extra.media ? JSON.stringify(extra.media) : null,
    read_at: extra.readAt || null,
  }).returning('*');
  return row;
}

beforeEach(async () => {
  await truncateAllTables();
  const biz = await createTestBusiness();
  businessId = biz.business.id;
  token = biz.token;
  alice = await addCustomerToBusiness(businessId, token, { name: 'Alice', phoneNumber: '+13330006001' });
  bob = await addCustomerToBusiness(businessId, token, { name: 'Bob', phoneNumber: '+13330006002' });
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await knex.destroy(); });

describe('GET /api/businesses/:businessId/messages/inbox', () => {
  it('returns an empty inbox for a business with no messages', async () => {
    const res = await auth(request(app).get(`/api/businesses/${businessId}/messages/inbox`));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, threads: [], totalUnread: 0 });
  });

  it('lists one thread per customer, newest first, with last message + unread count', async () => {
    await msg(alice.id, 'outbound', 'Hi Alice');
    await msg(alice.id, 'inbound', 'old reply', { readAt: new Date() });
    await msg(bob.id, 'outbound', 'Hi Bob');
    await msg(alice.id, 'inbound', 'are you coming?');
    const last = await msg(alice.id, 'inbound', 'photo', { media: ['/uploads/messages/x_0.jpg'] });

    const res = await auth(request(app).get(`/api/businesses/${businessId}/messages/inbox`));
    expect(res.status).toBe(200);
    expect(res.body.threads.map(t => t.customerId)).toEqual([alice.id, bob.id]);
    expect(res.body.threads[0]).toMatchObject({
      customerName: 'Alice',
      phoneNumber: '+13330006001',
      unreadCount: 2,
      lastMessage: { id: last.id, direction: 'inbound', body: 'photo', hasMedia: true },
    });
    expect(res.body.threads[1]).toMatchObject({ unreadCount: 0, lastMessage: { body: 'Hi Bob', hasMedia: false } });
    expect(res.body.totalUnread).toBe(2);
  });

  it('excludes other businesses\' messages and unknown-number inbound', async () => {
    const other = await createTestBusiness();
    const carl = await addCustomerToBusiness(other.business.id, other.token, { name: 'Carl', phoneNumber: '+13330006003' });
    await msg(carl.id, 'inbound', 'not yours', { businessId: other.business.id });
    await msg(null, 'inbound', 'who is this?');

    const res = await auth(request(app).get(`/api/businesses/${businessId}/messages/inbox`));
    expect(res.body.threads).toEqual([]);
    expect(res.body.totalUnread).toBe(0);
  });

  it('403s with another business token', async () => {
    const other = await createTestBusiness();
    const res = await request(app).get(`/api/businesses/${businessId}/messages/inbox`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/businesses/:businessId/customers/:customerId/messages/read', () => {
  it('marks only that customer\'s unread inbound messages read', async () => {
    await msg(alice.id, 'inbound', 'one');
    await msg(alice.id, 'inbound', 'two');
    await msg(bob.id, 'inbound', 'bob unread');

    const res = await auth(request(app).post(`/api/businesses/${businessId}/customers/${alice.id}/messages/read`));
    expect(res.status).toBe(200);
    expect(res.body.markedRead).toBe(2);

    const inbox = await auth(request(app).get(`/api/businesses/${businessId}/messages/inbox`));
    const byId = Object.fromEntries(inbox.body.threads.map(t => [t.customerId, t.unreadCount]));
    expect(byId[alice.id]).toBe(0);
    expect(byId[bob.id]).toBe(1);

    // Idempotent.
    const again = await auth(request(app).post(`/api/businesses/${businessId}/customers/${alice.id}/messages/read`));
    expect(again.body.markedRead).toBe(0);
  });

  it('404s on another business\'s customer', async () => {
    const other = await createTestBusiness();
    const carl = await addCustomerToBusiness(other.business.id, other.token, { name: 'Carl', phoneNumber: '+13330006004' });
    const res = await auth(request(app).post(`/api/businesses/${businessId}/customers/${carl.id}/messages/read`));
    expect(res.status).toBe(404);
  });
});

describe('Home summary — unread messages Action Center item', () => {
  it('lists customers with unread inbound messages', async () => {
    await msg(alice.id, 'inbound', 'hello?');
    await msg(alice.id, 'inbound', 'hello??');
    await msg(bob.id, 'inbound', 'read already', { readAt: new Date() });

    const res = await auth(request(app).get(`/api/businesses/${businessId}/home-summary`));
    expect(res.status).toBe(200);
    expect(res.body.summary.actionCenter.unreadMessages).toEqual([
      expect.objectContaining({ customerId: alice.id, customerName: 'Alice', unreadCount: 2 }),
    ]);
  });
});

describe('Thread read + send', () => {
  it('GET thread returns messages oldest-first', async () => {
    await msg(alice.id, 'outbound', 'first');
    await msg(alice.id, 'inbound', 'second');
    const res = await auth(request(app).get(`/api/businesses/${businessId}/customers/${alice.id}/messages`));
    expect(res.status).toBe(200);
    expect(res.body.messages.map(m => m.body)).toEqual(['first', 'second']);
  });

  it('POST send logs an outbound message (dev-mode provider)', async () => {
    const res = await auth(request(app).post(`/api/businesses/${businessId}/customers/${alice.id}/messages`))
      .send({ body: '  On our way  ' });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatchObject({ direction: 'outbound', body: 'On our way', mediaUrls: null });
  });

  it('POST send surfaces a provider failure as 502 SMS_SEND_FAILED and logs nothing', async () => {
    jest.spyOn(getProvider('send'), 'send').mockRejectedValue(new Error("The 'To' number is not a valid phone number."));
    const res = await auth(request(app).post(`/api/businesses/${businessId}/customers/${alice.id}/messages`))
      .send({ body: 'hi' });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('SMS_SEND_FAILED');
    expect(res.body.error).toMatch(/not a valid phone number/);
    expect(await knex('messages').where('customer_id', alice.id).count('* as n').first()).toEqual({ n: '0' });
  });
});
