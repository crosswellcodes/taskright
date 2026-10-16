// Business-local calendar dates (WEB_PORTAL.md "Time zones").
//
// A business operates in one IANA zone (businesses.timezone, migration 029).
// "Today" is that zone's calendar day, never the server's UTC day — from 7pm
// to midnight Central the UTC date is already tomorrow. Date keys are
// YYYY-MM-DD strings; day math on them is pure UTC so it never crosses a DST
// boundary.

const DEFAULT_TIME_ZONE = 'America/Chicago';

function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const resolveTimeZone = (tz) => (isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE);

// YYYY-MM-DD for `now` in `tz` (en-CA formats as ISO year-month-day).
function todayInZone(tz, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTimeZone(tz), year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function addDaysKey(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

module.exports = { DEFAULT_TIME_ZONE, isValidTimeZone, resolveTimeZone, todayInZone, addDaysKey };
