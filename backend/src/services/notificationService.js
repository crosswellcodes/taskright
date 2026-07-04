const twilio = require('twilio');
const knex = require('../db');

const PARENT_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const PARENT_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

function parentClient() {
  return twilio(PARENT_ACCOUNT_SID, PARENT_AUTH_TOKEN);
}

/**
 * Send an SMS on behalf of a business via their dedicated Messaging Service.
 *
 * In dev mode (business not yet provisioned), logs to console instead of
 * calling Twilio — so the rest of the app works without live credentials.
 *
 * Every successful send is logged to the messages table for communication history.
 *
 * @param {Object} business  - Full business DB row (needs id, twilio_subaccount_sid,
 *                             twilio_messaging_service_sid, twilio_phone_number)
 * @param {String} toPhone   - Recipient E.164 phone number
 * @param {String} message   - SMS body
 * @returns {Promise<Object|null>} Twilio response object, or null in dev mode
 */
async function sendSMS(business, toPhone, message) {
  if (!toPhone || !message) {
    throw new Error('toPhone and message are required');
  }

  // Dev mode — business not provisioned yet (fresh signup or test environment)
  if (!business.twilio_subaccount_sid || !business.twilio_messaging_service_sid) {
    console.log(`📱 [DEV SMS] To ${toPhone}: ${message}`);
    return null;
  }

  const client = parentClient();
  const response = await client.messages.create({
    messagingServiceSid: business.twilio_messaging_service_sid,
    to: toPhone,
    body: message
  });

  console.log(`✓ SMS sent to ${toPhone} via business ${business.id} (SID: ${response.sid})`);

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
      twilio_message_sid: response.sid,
      to_phone: toPhone,
      from_phone: business.twilio_phone_number || null,
    });
  } catch (logErr) {
    console.error('Outbound message log failed:', logErr.message);
  }

  return response;
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
