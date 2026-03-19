/**
 * HTTP Server entry point.
 *
 * Changes from original:
 * 1. Wrapped `app.listen` in an `http.Server` for explicit graceful shutdown control.
 * 2. Added SIGTERM + SIGINT handlers that drain the HTTP server, then close the
 *    MongoDB connection before exiting (important for container/PM2 deployments).
 * 3. Force-exit after 10 seconds if graceful shutdown stalls.
 * 4. Added optional SMTP transporter verification at startup.
 */

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
    // eslint-disable-next-line no-console
    console.warn('[startup] SMTP transporter not available — emails will be skipped.');
  }

  // 3. Start HTTP server
  const server = http.createServer(app);

  server.listen(env.PORT, env.HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Running on http://${env.HOST}:${env.PORT} (${env.NODE_ENV})`);
  });

  // 4. Graceful shutdown handler
  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n[server] ${signal} received — shutting down gracefully...`);

    // Stop accepting new connections
    server.close(async () => {
      try {
        await mongoose.connection.close();
        // eslint-disable-next-line no-console
        console.log('[server] MongoDB connection closed.');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[server] Error closing MongoDB:', err.message);
      }
      process.exit(0);
    });

    // Force-exit if graceful shutdown takes longer than 10 seconds
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error('[server] Graceful shutdown timed out — forcing exit.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 5. Handle uncaught exceptions — log and exit (let process manager restart)
  process.on('uncaughtException', (err) => {
    // eslint-disable-next-line no-console
    console.error('[server] Uncaught exception:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('[server] Unhandled promise rejection:', reason);
    // Don't exit — just log. Unhandled rejections in Express are caught by asyncHandler.
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[server] Failed to start:', error);
  process.exit(1);

});

// Nodemon Trigger: Clear EADDRINUSE
