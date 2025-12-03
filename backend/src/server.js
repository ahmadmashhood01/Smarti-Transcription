const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const exportRoutes = require('./routes/export');
const labelStudioRoutes = require('./routes/labelStudio');
const { initializeFirebase } = require('./services/firebase');
const { initializeSentry } = require('./services/sentry');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Sentry for error tracking
initializeSentry(app);

// Initialize Firebase Admin
initializeFirebase();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/export', exportRoutes);
app.use('/api/label-studio', labelStudioRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`   - Health check: http://localhost:${PORT}/health`);
  console.log(`   - Export API: http://localhost:${PORT}/api/export`);
  console.log(`   - Label Studio API: http://localhost:${PORT}/api/label-studio`);
});

module.exports = app;

