// Phone-possession gate for every login and signup (business, customer, team
// member). Codes go through the provider seam — Twilio Verify or SignalHouse,
// per SMS_PROVIDER_OTP — so this file never cares which.
//
// Dev escape hatch: 555 numbers can't receive texts from any provider. When
// OTP_DEV_BYPASS_CODE is set AND NODE_ENV isn't 'production', a +1555 number
// skips the real send and that code is accepted. No real US phone has area
// code 555, so the bypass can't open a real account even if misconfigured.
// Never set OTP_DEV_BYPASS_CODE on a deployed backend.

const { getProvider } = require('./sms');

const DEV_PHONE_RE = /^\+1555\d{7}$/;

function devBypassCode(phone) {
  const code = process.env.OTP_DEV_BYPASS_CODE;
  if (!code || process.env.NODE_ENV === 'production') return null;
  return DEV_PHONE_RE.test(String(phone || '')) ? String(code) : null;
}

async function sendLoginCode(phone) {
  if (devBypassCode(phone)) {
    console.log(`📱 [DEV OTP BYPASS] ${phone}: enter OTP_DEV_BYPASS_CODE`);
    return;
  }
  await getProvider('otp').sendOtp(phone);
}

async function verifyLoginCode(phone, code) {
  if (!code) return false;
  const bypass = devBypassCode(phone);
  if (bypass) return String(code) === bypass;
  return getProvider('otp').verifyOtp(phone, String(code));
}

module.exports = { sendLoginCode, verifyLoginCode, devBypassCode };
