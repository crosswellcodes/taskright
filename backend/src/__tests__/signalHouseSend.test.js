const SignalHouseProvider = require('../services/sms/SignalHouseProvider');
const { getProvider } = require('../services/sms');

// P2: outbound send via SignalHouse (POST /message/sms). Exercised with an injected
// fake SDK client so no live credentials or network are needed. The rest of the
// suite runs with SMS_PROVIDER unset (→ twilio), proving the Twilio path stays green.
describe('P2: SignalHouseProvider.send', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.SIGNALHOUSE_API_KEY = 'test-key';
    process.env.SIGNALHOUSE_BASE_URL = 'https://v2staging.signalhouse.io';
  });

  afterEach(() => {
    for (const k of ['SIGNALHOUSE_API_KEY', 'SIGNALHOUSE_BASE_URL', 'SMS_PROVIDER_SEND']) {
      if (OLD_ENV[k] === undefined) delete process.env[k];
      else process.env[k] = OLD_ENV[k];
    }
  });

  const provisionedBiz = { id: 7, sms_subgroup_id: 'S1234567', sms_phone_number: '+15551230000' };

  function fakeClient(result) {
    const calls = [];
    return { calls, messages: { sendSMS: async (payload) => { calls.push(payload); return result; } } };
  }

  test('maps to the /message/sms payload, strips +, returns sent + _id', async () => {
    const client = fakeClient({
      success: true,
      status: 201,
      data: { insertedMessages: [{ _id: 'MSG_1' }], enqueuedCount: 1, requestedRecipientCount: 1, failedCount: 0 },
    });
    const res = await new SignalHouseProvider({ client }).send(provisionedBiz, '+15559876543', 'hello');

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toEqual({
      senderPhoneNumber: '15551230000',
      recipientPhoneNumbers: ['15559876543'],
      messageBody: 'hello',
    });
    expect(res).toEqual({ id: 'MSG_1', status: 'sent', raw: expect.any(Object) });
  });

  test('enqueuedCount 0 → blocked (opt-out/DNC), still returns the inserted id', async () => {
    const client = fakeClient({
      success: true,
      status: 201,
      data: { insertedMessages: [{ _id: 'MSG_2', errorCode: 'OUT' }], enqueuedCount: 0 },
    });
    const res = await new SignalHouseProvider({ client }).send(provisionedBiz, '+15559876543', 'hi');
    expect(res.status).toBe('blocked');
    expect(res.id).toBe('MSG_2');
  });

  test('success:false → failed, id null', async () => {
    const client = fakeClient({ success: false, status: 400, error: { message: 'bad request' } });
    const res = await new SignalHouseProvider({ client }).send(provisionedBiz, '+15559876543', 'hi');
    expect(res.status).toBe('failed');
    expect(res.id).toBeNull();
  });

  test('prepends country code to bare 10-digit numbers (the silent-fail footgun)', async () => {
    const client = fakeClient({ success: true, status: 201, data: { insertedMessages: [{ _id: 'M' }], enqueuedCount: 1 } });
    await new SignalHouseProvider({ client }).send(
      { ...provisionedBiz, sms_phone_number: '5551230000' }, '5559876543', 'x'
    );
    expect(client.calls[0].senderPhoneNumber).toBe('15551230000');
    expect(client.calls[0].recipientPhoneNumbers).toEqual(['15559876543']);
  });

  test('dev-mode: unconfigured provider never calls the client', async () => {
    delete process.env.SIGNALHOUSE_API_KEY;
    const client = fakeClient({ success: true, data: {} });
    const res = await new SignalHouseProvider({ client }).send(provisionedBiz, '+15559876543', 'hi');
    expect(res).toEqual({ id: null, status: 'dev', raw: null });
    expect(client.calls).toHaveLength(0);
  });

  test('dev-mode: unprovisioned business never calls the client', async () => {
    const client = fakeClient({ success: true, data: {} });
    const res = await new SignalHouseProvider({ client }).send({ id: 8 }, '+15559876543', 'hi');
    expect(res.status).toBe('dev');
    expect(client.calls).toHaveLength(0);
  });

  test('throws on missing recipient/body (parity with TwilioProvider)', async () => {
    const p = new SignalHouseProvider({ client: fakeClient({}) });
    await expect(p.send(provisionedBiz, '', 'hi')).rejects.toThrow('toPhone and message are required');
    await expect(p.send(provisionedBiz, '+15551112222', '')).rejects.toThrow('toPhone and message are required');
  });

  test('factory: SMS_PROVIDER_SEND=signalhouse selects SignalHouse for send only', () => {
    process.env.SMS_PROVIDER_SEND = 'signalhouse';
    expect(getProvider('send').name).toBe('signalhouse');
    expect(getProvider('provision').name).toBe('twilio'); // other capabilities unaffected
  });
});
