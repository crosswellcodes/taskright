const knex = require('knex');
const knexConfig = require('../knexfile');

const env = process.env.NODE_ENV || 'development';
const config = knexConfig[env];

// Initialize Knex properly
const db = knex(config);

// Test the connection
db.raw('SELECT 1')
  .then(() => {
    console.log('✓ Database connection successful');
  })
  .catch((error) => {
    console.error('✗ Database connection failed:', error.message);
  });

module.exports = db;