// App-level limit on texted verification codes (POST /api/auth/verify/send).
// The send endpoint is public by design (website /signup, /join, portal login,
// mobile app), so this is what stands between us and SMS pumping: an attacker
// scripting the endpoint to text premium or random numbers on our bill.
//
// Two dimensions, each with a short and a daily window:
//   per phone — stops one number being flooded (and our cost on it)
//   per IP    — stops one client rotating through many numbers
// Counts live in otp_send_events (migration 031), not memory, so the limit holds
// across backend processes. Advisory locks serialize the check+insert per phone
// and per IP, so a parallel burst can't slip past the count.
//
// A send reserves a row first and the caller releases it if the provider then
// fails, so only codes we actually texted count against a real user.

const knex = require('../db');

const LIMITS = {
  phone: [
    { windowSec: 10 * 60, max: 3 },
    { windowSec: 24 * 60 * 60, max: 10 },
  ],
  ip: [
    { windowSec: 60 * 60, max: 20 },
    { windowSec: 24 * 60 * 60, max: 100 },
  ],
};

const RETENTION_SEC = 24 * 60 * 60; // longest window

// Advisory-lock namespaces (first key of pg_advisory_xact_lock(int, int)).
const LOCK_PHONE = 7101;
const LOCK_IP = 7102;

// Seconds until `value` is back under `limit`, or 0 if it's under it now. The
// max-th most recent send in the window is the one that has to age out.
async function waitSeconds(trx, column, value, { windowSec, max }) {
  const row = await trx('otp_send_events')
    .where(column, value)
    .whereRaw('created_at > now() - make_interval(secs => ?)', [windowSec])
    .orderBy('created_at', 'desc')
    .offset(max - 1)
    .first(trx.raw('ceil(extract(epoch from (created_at + make_interval(secs => ?) - now())))::int as wait', [windowSec]));
  return row ? Math.max(1, row.wait) : 0;
}

function rateLimitedError(retryAfterSeconds) {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const when = minutes >= 60
    ? `in about ${Math.ceil(minutes / 60)} hour${minutes > 60 ? 's' : ''}`
    : `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  return Object.assign(
    new Error(`Too many verification codes requested. Please try again ${when}.`),
    { code: 'RATE_LIMITED', statusCode: 429, retryAfterSeconds }
  );
}

/**
 * Check the limits for a send to `phone` from `ip` and, if allowed, record it.
 * Returns the reservation id (pass to releaseOtpSend if the send fails).
 * Throws { code: 'RATE_LIMITED', statusCode: 429, retryAfterSeconds } when over.
 */
async function reserveOtpSend(phone, ip) {
  return knex.transaction(async (trx) => {
    // Phone lock before IP lock, always — consistent order, no deadlock.
    await trx.raw('select pg_advisory_xact_lock(?, hashtext(?))', [LOCK_PHONE, phone]);
    if (ip) await trx.raw('select pg_advisory_xact_lock(?, hashtext(?))', [LOCK_IP, ip]);

    const checks = LIMITS.phone.map((l) => ['phone', phone, l]);
    if (ip) checks.push(...LIMITS.ip.map((l) => ['ip', ip, l]));
    let wait = 0;
    for (const [column, value, limit] of checks) { // sequential: one connection
      wait = Math.max(wait, await waitSeconds(trx, column, value, limit));
    }
    if (wait > 0) throw rateLimitedError(wait);

    await trx('otp_send_events')
      .whereRaw('created_at < now() - make_interval(secs => ?)', [RETENTION_SEC])
      .del();
    const [row] = await trx('otp_send_events').insert({ phone, ip: ip || null }).returning('id');
    return row.id;
  });
}

// Un-count a reserved send that never went out (provider error).
async function releaseOtpSend(id) {
  await knex('otp_send_events').where('id', id).del();
}

module.exports = { reserveOtpSend, releaseOtpSend, LIMITS };
