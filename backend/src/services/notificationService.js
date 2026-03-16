const twilio = require('twilio');

// Initialize Twilio client with environment variables
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

/**
 * Send SMS notification to customer
 * @param {String} phoneNumber - Customer's phone number (E.164 format)
 * @param {String} message - SMS message body
 * @returns {Promise} Twilio message response
 */
async function sendSMS(phoneNumber, message) {
  try {
    // Validate inputs
    if (!phoneNumber || !message) {
      throw new Error('Phone number and message are required');
    }

    if (!TWILIO_PHONE_NUMBER) {
      console.warn('⚠️  TWILIO_PHONE_NUMBER not set - SMS not sent (development mode)');
      console.log(`Would send SMS to ${phoneNumber}: ${message}`);
      return null;
    }

    // Send SMS via Twilio
    const response = await twilioClient.messages.create({
      from: TWILIO_PHONE_NUMBER,
      to: phoneNumber,
      body: message
    });

    console.log(`✓ SMS sent to ${phoneNumber} (SID: ${response.sid})`);
    return response;
  } catch (error) {
    console.error(`✗ Failed to send SMS to ${phoneNumber}:`, error.message);
    throw error;
  }
}

/**
 * Send service completion notification
 * @param {String} customerPhone - Customer's phone number
 * @param {String} nextServiceDate - Date of next service
 * @returns {Promise}
 */
async function sendServiceCompletionNotification(customerPhone, nextServiceDate) {
  const message = `Your service is complete! Your next service is ${nextServiceDate}. Confirm or change your selections by [deadline]. Tap to open app.`;
  return await sendSMS(customerPhone, message);
}

/**
 * Send selection reminder notification
 * @param {String} customerPhone - Customer's phone number
 * @param {String} serviceDate - Date of upcoming service
 * @param {Number} daysUntilDeadline - Days until submission deadline
 * @returns {Promise}
 */
async function sendSelectionReminder(customerPhone, serviceDate, daysUntilDeadline) {
  const message = `Time to confirm or change your selections for ${serviceDate}. You have ${daysUntilDeadline} days to submit.`;
  return await sendSMS(customerPhone, message);
}

/**
 * Send auto-repeat confirmation notification
 * @param {String} customerPhone - Customer's phone number
 * @param {String} serviceDate - Date of service
 * @returns {Promise}
 */
async function sendAutoRepeatNotification(customerPhone, serviceDate) {
  const message = `Your selections have been auto-confirmed for ${serviceDate}. You can change them until [deadline].`;
  return await sendSMS(customerPhone, message);
}

/**
 * Send welcome/invitation SMS to new customer
 * @param {String} customerPhone - Customer's phone number
 * @param {String} businessName - Name of the business
 * @returns {Promise}
 */
async function sendWelcomeNotification(customerPhone, businessName) {
  const message = `Welcome to ${businessName}! Tap here to set up your account: [app-link]`;
  return await sendSMS(customerPhone, message);
}

module.exports = {
  sendSMS,
  sendServiceCompletionNotification,
  sendSelectionReminder,
  sendAutoRepeatNotification,
  sendWelcomeNotification
};