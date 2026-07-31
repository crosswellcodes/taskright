const knex = require('../db');
const { getProvider } = require('./sms');

/**
 * Send an SMS on behalf of a business, via the configured SMS provider.
 *
 * In dev mode (business not yet provisioned), the provider logs to console
 * instead of calling out — so the rest of the app works without live credentials.
 *
 * Every real send is logged to the messages table for communication history.
 * (Dev-mode sends are not logged — behavior preserved from the Twilio original.)
 *
 * @param {Object} business  - Full business DB row (needs id, sms_subgroup_id,
 *                             sms_phone_number, and provider-specific send state)
 * @param {String} toPhone   - Recipient E.164 phone number
 * @param {String} message   - SMS body
 * @returns {Promise<Object|null>} Provider response object, or null in dev mode
 */
async function sendSMS(business, toPhone, message) {
  const result = await getProvider('send').send(business, toPhone, message);

  // Only a genuinely-sent message is recorded in the thread history. dev-mode sends
  // log nothing (preserves original behavior); blocked/failed sends are already
  // logged by the provider and must not appear in the thread as if delivered.
  // (TwilioProvider only ever returns 'sent' or 'dev' — behavior unchanged there.)
  if (result.status !== 'sent') {
    return result.raw;
  }

  // Best-effort outbound message log — don't let a logging failure block the caller
  try {
    // Attempt to resolve customer_id from the recipient phone (null for business-owner notifications)
    const customer = await knex('customers')
      .where('phone_number', toPhone)
      .where('business_id', business.id)
      .first();

    await knex('messages').insert({
      business_id: business.id,
      customer_id: customer ? customer.id : null,
      direction: 'outbound',
      body: message,
      sms_message_id: result.id,
      to_phone: toPhone,
      from_phone: business.sms_phone_number || null,
    });
  } catch (logErr) {
    console.error('Outbound message log failed:', logErr.message);
  }

  return result.raw;
}

/**
 * Notify customer that their service is complete and what their next date is.
 */
async function sendServiceCompletionNotification(business, customerPhone, nextServiceDate, nextDeadline) {
  const message = nextServiceDate
    ? `Your service is complete — thank you! Your next visit is ${nextServiceDate}. Confirm your tasks by ${nextDeadline} in the TaskRight app.`
    : `Your service is complete — thank you! Open the TaskRight app to view your upcoming services.`;
  return await sendSMS(business, customerPhone, message);
}

/**
 * Remind customer to submit their task selections before the deadline.
 */
async function sendSelectionReminder(business, customerPhone, serviceDate, daysUntilDeadline, businessName) {
  const name = businessName || business.name || 'your provider';
  const message = `Your ${name} service is on ${serviceDate}. Reply C to confirm, T to review tasks, D to request a date change, or N to leave a note for your team.`;
  return await sendSMS(business, customerPhone, message);
}

/**
 * Notify customer that their previous selections were auto-confirmed.
 */
async function sendAutoRepeatNotification(business, customerPhone, serviceDate, businessName) {
  const name = businessName || business.name || 'your provider';
  const message = `Your tasks for your ${name} service on ${serviceDate} have been confirmed. Reply T to make changes, D to request a different date, or N to add a note for your team.`;
  return await sendSMS(business, customerPhone, message);
}

/**
 * Welcome a new customer and let them know their first service date.
 */
async function sendWelcomeNotification(business, customerPhone, businessName, firstServiceDate) {
  const message = firstServiceDate
    ? `Welcome to ${businessName}! Your first service is scheduled for ${firstServiceDate}. Download the TaskRight app to view and select your tasks.`
    : `Welcome to ${businessName}! Download the TaskRight app to view your upcoming services and select your tasks.`;
  return await sendSMS(business, customerPhone, message);
}

/**
 * Notify customer that their service has been rescheduled.
 */
async function sendRescheduleNotification(business, customerPhone, newDate) {
  const message = `Your service has been rescheduled to ${newDate}. Open the TaskRight app to confirm your task selections.`;
  return await sendSMS(business, customerPhone, message);
}

module.exports = {
  sendSMS,
  sendServiceCompletionNotification,
  sendSelectionReminder,
  sendAutoRepeatNotification,
  sendWelcomeNotification,
  sendRescheduleNotification,
};
