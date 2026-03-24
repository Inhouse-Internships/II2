const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');
const mongoose = require('mongoose');

async function startServer() {
  // 1. Connect to database first
  await connectDB();

  // 1b. Seed default admin if none exists
  const seedAdmin = require('./config/seed');
  await seedAdmin();

  // 2. (Optional) Verify SMTP at startup to catch misconfiguration early
  const { verifyTransporter } = require('./mailer');
  const smtpOk = await verifyTransporter();
  if (!smtpOk) {
    console.warn('[startup] SMTP transporter not available — emails will be skipped.');
  }

  // 3. Start HTTP server
  const server = http.createServer(app);

  server.listen(env.PORT, env.HOST);

  // 4. Graceful shutdown handler
  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received — shutting down gracefully...`);

    // Stop accepting new connections
    server.close(async () => {
      try {
        await mongoose.connection.close();
        console.log('[server] MongoDB connection closed.');
      } catch (err) {
        console.error('[server] Error closing MongoDB:', err.message);
      }
      process.exit(0);
    });

    // Force-exit if graceful shutdown takes longer than 10 seconds
    setTimeout(() => {
      console.error('[server] Graceful shutdown timed out — forcing exit.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 5. Handle uncaught exceptions — log and exit (let process manager restart)
  process.on('uncaughtException', (err) => {
    console.error('[server] Uncaught exception:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled promise rejection:', reason);
    // Don't exit — just log. Unhandled rejections in Express are caught by asyncHandler.
  });
}

startServer().catch((error) => {
  console.error('[server] Failed to start:', error);
  process.exit(1);

});

// Nodemon Trigger: Clear EADDRINUSE

// wake up


