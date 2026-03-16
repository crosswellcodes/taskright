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
      // Get all service cycles that are 3 days away
      const upcomingServices = await knex('selection_cycles')
        .join('service_cycles', 'selection_cycles.service_cycle_id', '=', 'service_cycles.id')
        .join('customers', 'selection_cycles.customer_id', '=', 'customers.id')
        .whereRaw(`selection_cycles.service_date = CURRENT_DATE + INTERVAL '3 days'`)
        .where('selection_cycles.status', 'open')
        .select(
          'customers.phone_number',
          'selection_cycles.service_date',
          'selection_cycles.id as selection_cycle_id'
        );

      if (upcomingServices.length === 0) {
        console.log('✓ No reminders needed today');
        return;
      }

      console.log(`📬 Found ${upcomingServices.length} customers to remind`);

      // Send reminder to each customer
      let successCount = 0;
      let errorCount = 0;

      for (const service of upcomingServices) {
        try {
          await sendSelectionReminder(
            service.phone_number,
            service.service_date.toISOString().split('T')[0], // Format as YYYY-MM-DD
            3
          );
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