const schedule = require('node-schedule');
const knex = require('../db');
const { sendAutoRepeatNotification } = require('../services/notificationService');

/**
 * Auto-repeat customer selections if not submitted
 * Runs daily at 11:59 PM
 * Auto-repeats selections 1 day before service if customer hasn't submitted
 */
function startAutoRepeatJob() {
  // Schedule for 11:59 PM every day
  const job = schedule.scheduleJob('59 23 * * *', async () => {
    console.log('\n🔄 [Auto-Repeat Job] Starting...');

    try {
      // Get all selection cycles that are 1 day away and NOT submitted
      const upcomingServices = await knex('selection_cycles')
        .join('customers', 'selection_cycles.customer_id', '=', 'customers.id')
        .whereRaw(`selection_cycles.service_date = CURRENT_DATE + INTERVAL '1 day'`)
        .where('selection_cycles.status', 'open')
        .select(
          'selection_cycles.id as selection_cycle_id',
          'customers.id as customer_id',
          'customers.phone_number',
          'selection_cycles.service_date'
        );

      if (upcomingServices.length === 0) {
        console.log('✓ No auto-repeats needed today');
        return;
      }

      console.log(`🔄 Found ${upcomingServices.length} customers to auto-repeat`);

      let successCount = 0;
      let errorCount = 0;

      for (const service of upcomingServices) {
        try {
          // Get previous selection for this customer
          const previousSelection = await knex('selections')
            .where('customer_id', service.customer_id)
            .where('status', 'submitted')
            .orderBy('submitted_at', 'desc')
            .first();

          if (!previousSelection) {
            console.log(`⚠️  No previous selection for customer ${service.customer_id}`);
            continue;
          }

          // Create new selection with previous data
          await knex('selections').insert({
            selection_cycle_id: service.selection_cycle_id,
            customer_id: service.customer_id,
            selected_tasks: previousSelection.selected_tasks,
            selected_total_hours: previousSelection.selected_total_hours,
            status: 'submitted',
            submitted_at: knex.raw('CURRENT_TIMESTAMP'),
            created_at: knex.raw('CURRENT_TIMESTAMP'),
            updated_at: knex.raw('CURRENT_TIMESTAMP')
          });

          // Send notification
          await sendAutoRepeatNotification(
            service.phone_number,
            service.service_date.toISOString().split('T')[0]
          );

          successCount++;
        } catch (error) {
          console.error(`✗ Failed to auto-repeat for customer ${service.customer_id}:`, error.message);
          errorCount++;
        }
      }

      console.log(`✓ Auto-repeated ${successCount} selections, ${errorCount} failed`);
      console.log('🔄 [Auto-Repeat Job] Complete\n');
    } catch (error) {
      console.error('✗ Auto-Repeat Job Error:', error.message);
    }
  });

  console.log('✓ Auto-Repeat Job scheduled (runs daily at 11:59 PM)');
  return job;
}

module.exports = {
  startAutoRepeatJob
};