const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const env = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const { successResponse } = require('./utils/response');

const app = express();

// ── Security: hide server identity ─────────────────────────────────────────
app.disable('x-powered-by');
app.set('trust proxy', 1);

// ── Request correlation ID ──────────────────────────────────────────────────
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ── Compression ─────────────────────────────────────────────────────────────
app.use(compression());

// ── Security Headers (Helmet) ───────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // 'unsafe-inline' required for MUI/Emotion runtime styles
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: env.IS_PRODUCTION ? [] : null
      }
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: env.IS_PRODUCTION
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    // Cross-origin policies
    crossOriginEmbedderPolicy: false, // keep false — needed if embedding third-party resources
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// ── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server (no origin) and health checks
      if (!origin) return callback(null, true);

      if (env.CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      // In dev with no explicit CORS_ORIGINS configured, allow all local origins
      if (!env.IS_PRODUCTION && env.CORS_ORIGINS.length === 0) {
        return callback(null, true);
      }

      return callback(new Error('CORS origin not allowed'));
    },
    credentials: true
  })
);

// ── Global Rate Limit (broad, permissive — protects against DoS) ────────────
// Strict auth-specific rate limiting is done at the route level (authRateLimit.js)
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests, please try again later.'
    }
  })
);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  successResponse(res, { status: 'ok', requestId: req.requestId }, 'Service healthy')
);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/faculty', require('./routes/facultyRoutes'));
app.use('/api/hod', require('./routes/facultyRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/batch', require('./routes/batchRoutes'));
app.use('/api/daily-status', require('./routes/dailyStatusRoutes'));

app.get('/', (req, res) =>
  successResponse(res, { service: 'Inhouse Internships 2.0 Backend' })
);

// ── Error handling (must be last) ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
