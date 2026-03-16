require('dotenv').config();

const app = require('./src/app');
const { startSelectionReminderJob } = require('./src/jobs/selection-reminders');
const { startAutoRepeatJob } = require('./src/jobs/auto-repeat');

// Start cron jobs
console.log('\n🕐 Starting scheduled jobs...');
startSelectionReminderJob();
startAutoRepeatJob();
console.log('✓ All scheduled jobs started\n');

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: task_app_db (PostgreSQL 18)`);
  console.log(`🔐 JWT enabled with 24-hour token expiry\n`);
});

module.exports = app;
