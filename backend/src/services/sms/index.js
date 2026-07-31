/**
 * SMS provider factory — the reversibility spine of the Twilio→SignalHouse migration.
 *
 * Primary selector `SMS_PROVIDER` (default 'twilio') with per-capability overrides
 * so cutover can flip one capability at a time and roll back independently:
 *   SMS_PROVIDER            'twilio' (default) | 'signalhouse'
 *   SMS_PROVIDER_SEND       overrides outbound send
 *   SMS_PROVIDER_INBOUND    overrides webhook parse/verify/media
 *   SMS_PROVIDER_PROVISION  overrides provisionBusiness + registerA2P
 *   SMS_PROVIDER_OTP        overrides sendOtp/verifyOtp
 *
 * Env is read per call so tests / ops can flip a flag without a process restart of
 * this module's state. Instances are cached per resolved provider name.
 *
 * See shared/specs/SIGNALHOUSE_MIGRATION.md §1.
 */
const TwilioProvider = require('./TwilioProvider');
const SignalHouseProvider = require('./SignalHouseProvider');

const CAPABILITY_ENV = {
  send: 'SMS_PROVIDER_SEND',
  inbound: 'SMS_PROVIDER_INBOUND',
  provision: 'SMS_PROVIDER_PROVISION',
  otp: 'SMS_PROVIDER_OTP',
};

const instances = {};

function instanceFor(name) {
  if (!instances[name]) {
    switch (name) {
      case 'twilio':
        instances[name] = new TwilioProvider();
        break;
      case 'signalhouse':
        instances[name] = new SignalHouseProvider();
        break;
      default:
        throw new Error(`Unknown SMS provider: ${name}`);
    }
  }
  return instances[name];
}

function resolveName(capability) {
  const capEnv = CAPABILITY_ENV[capability];
  const override = capEnv ? process.env[capEnv] : undefined;
  return override || process.env.SMS_PROVIDER || 'twilio';
}

/**
 * @param {'default'|'send'|'inbound'|'provision'|'otp'} [capability]
 * @returns {import('./SmsProvider')}
 */
function getProvider(capability = 'default') {
  return instanceFor(resolveName(capability));
}

module.exports = { getProvider };
