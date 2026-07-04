const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/businesses');
const customerRoutes = require('./routes/customers');
const teamMemberRoutes = require('./routes/teamMembers');
const webhookRoutes = require('./routes/webhooks');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// Twilio webhooks send application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running!' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/team-members', teamMemberRoutes);
app.use('/api/webhooks', webhookRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

module.exports = app;
