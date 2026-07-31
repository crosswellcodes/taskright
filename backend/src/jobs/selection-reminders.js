const schedule = require('node-schedule');
const knex = require('../db');
const { sendSelectionReminder } = require('../services/notificationService');

/**
 * Send selection reminders to customers
 * Runs daily at 11:59 PM
 * Reminds customers to submit selections 3 days before service
 */
function startSelectionReminderJob() {
  // Schedule for 11:59 PM every day
  const job = schedule.scheduleJob('59 23 * * *', async () => {
    console.log('\n📨 [Selection Reminder Job] Starting...');

    try {
      // Get all service cycles that are 3 days away, joining businesses for per-business SMS routing
      const upcomingServices = await knex('selection_cycles')
        .join('customers', 'selection_cycles.customer_id', '=', 'customers.id')
        .join('businesses', 'customers.business_id', '=', 'businesses.id')
        .whereRaw(`selection_cycles.service_date = CURRENT_DATE + INTERVAL '3 days'`)
        .where('selection_cycles.status', 'open')
        .select(
          'customers.phone_number',
          'selection_cycles.service_date',
          'selection_cycles.id as selection_cycle_id',
          'businesses.id as business_id',
          'businesses.name as business_name',
          'businesses.sms_subgroup_id',
          'businesses.twilio_messaging_service_sid',
          'businesses.sms_phone_number'
        );

      if (upcomingServices.length === 0) {
        console.log('✓ No reminders needed today');
        return;
      }

      console.log(`📬 Found ${upcomingServices.length} customers to remind`);

      let successCount = 0;
      let errorCount = 0;

      for (const service of upcomingServices) {
        try {
          // Construct the business object expected by sendSMS
          const business = {
            id: service.business_id,
            sms_subgroup_id: service.sms_subgroup_id,
            twilio_messaging_service_sid: service.twilio_messaging_service_sid,
            sms_phone_number: service.sms_phone_number,
          };

          const serviceDate = service.service_date instanceof Date
            ? service.service_date.toISOString().split('T')[0]
            : String(service.service_date).split('T')[0];

          await sendSelectionReminder(business, service.phone_number, serviceDate, 3, service.business_name);
          successCount++;
        } catch (error) {
          console.error(`✗ Failed to send reminder to ${service.phone_number}:`, error.message);
          errorCount++;
        }
      }

      console.log(`✓ Sent ${successCount} reminders, ${errorCount} failed`);
      console.log('📨 [Selection Reminder Job] Complete\n');
    } catch (error) {
      console.error('✗ Selection Reminder Job Error:', error.message);
    }
  });

  console.log('✓ Selection Reminder Job scheduled (runs daily at 11:59 PM)');
  return job;
}

module.exports = {
  startSelectionReminderJob
};
