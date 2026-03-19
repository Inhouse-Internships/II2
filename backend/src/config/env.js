const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: process.env.ENV_FILE || path.resolve(process.cwd(), '.env')
});

function readEnv(key, { defaultValue, required = false } = {}) {
  const value = process.env[key];
  if (value !== undefined && value !== null && value !== '') {
    return value;
  }

  if (required) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return defaultValue;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value).toLowerCase() === 'true';
}

function toList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toEmailDomains(value) {
  const domains = toList(value);
  if (domains.length === 0) {
    return ['@adityauniversity.in', '@aec.edu.in'];
  }
  return domains.map(d => d.startsWith('@') ? d : `@${d}`);
}

function toEmailDomain(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '@adityauniversity.in';
  }

  return normalized.startsWith('@') ? normalized : `@${normalized}`;
}

const os = require('os');

function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const name in interfaces) {
    if (/virtual|vbox|vmware|hyper-v/i.test(name)) continue;
    for (const info of interfaces[name]) {
      if (info.family === 'IPv4' && !info.internal && info.address !== '192.168.56.1') {
        return info.address;
      }
    }
  }
  return '127.0.0.1';
}

const nodeEnv = readEnv('NODE_ENV', { defaultValue: 'development' });
const isProduction = nodeEnv === 'production';

const detectedIp = getNetworkIp();
const rawHost = readEnv('HOST_IP', { defaultValue: 'auto' });
const host = (rawHost === 'auto' || !rawHost) ? '0.0.0.0' : rawHost;
const displayHost = (rawHost === 'auto' || !rawHost) ? detectedIp : rawHost;

const rawMongoUri = readEnv('MONGO_URI', { required: true });
const mongoUri = rawMongoUri.replace('AUTO_IP', displayHost);

const env = {
  NODE_ENV: nodeEnv,
  IS_PRODUCTION: isProduction,
  PORT: toNumber(readEnv('PORT', { defaultValue: '5000' }), 5000),
  HOST: host,
  DISPLAY_HOST: displayHost,
  MONGO_URI: mongoUri,

  JWT_SECRET: readEnv('JWT_SECRET', { required: true }),
  JWT_EXPIRES_IN: readEnv('JWT_EXPIRES_IN', { defaultValue: '1d' }),
  JWT_ISSUER: readEnv('JWT_ISSUER', { defaultValue: 'ii2-backend' }),

  BCRYPT_SALT_ROUNDS: toNumber(readEnv('BCRYPT_SALT_ROUNDS', { defaultValue: '12' }), 12),
  DEFAULT_IMPORTED_USER_PASSWORD: readEnv('DEFAULT_IMPORTED_USER_PASSWORD', { defaultValue: '' }),
  UNIVERSITY_EMAIL_DOMAIN: toEmailDomain(
    readEnv('UNIVERSITY_EMAIL_DOMAIN', { defaultValue: '@adityauniversity.in' })
  ),
  UNIVERSITY_EMAIL_DOMAINS: toEmailDomains(
    readEnv('UNIVERSITY_EMAIL_DOMAINS', { defaultValue: '' })
  ),

  CORS_ORIGINS: [
    ...toList(readEnv('CORS_ORIGINS', { defaultValue: readEnv('CORS_ORIGIN', { defaultValue: '' }) })),
    `http://${displayHost}:5173`,
    `http://${displayHost}:5000`,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
  ],

  RATE_LIMIT_WINDOW_MS: toNumber(readEnv('RATE_LIMIT_WINDOW_MS', { defaultValue: String(15 * 60 * 1000) }), 15 * 60 * 1000),
  RATE_LIMIT_MAX: toNumber(readEnv('RATE_LIMIT_MAX', { defaultValue: '1000' }), 1000),

  SMTP_HOST: readEnv('SMTP_HOST', { defaultValue: 'smtp.gmail.com' }),
  SMTP_PORT: toNumber(readEnv('SMTP_PORT', { defaultValue: '587' }), 587),
  SMTP_SECURE: toBoolean(readEnv('SMTP_SECURE', { defaultValue: 'false' }), false),
  SMTP_USER: readEnv('SMTP_USER', { defaultValue: readEnv('EMAIL_USER', { defaultValue: '' }) }),
  SMTP_PASS: readEnv('SMTP_PASS', { defaultValue: readEnv('EMAIL_PASS', { defaultValue: '' }) }),
  SMTP_FROM: readEnv('SMTP_FROM', { defaultValue: '' }),

  OTP_TTL_MINUTES: toNumber(readEnv('OTP_TTL_MINUTES', { defaultValue: '10' }), 10),
  REQUIRE_REGISTRATION_OTP: toBoolean(readEnv('REQUIRE_REGISTRATION_OTP', { defaultValue: 'true' }), true),
  FRONTEND_URL: readEnv('FRONTEND_URL', { defaultValue: `http://${displayHost}:5173` })
};

if (env.JWT_SECRET.length < 16) {
  console.warn('JWT_SECRET is shorter than recommended minimum length (16).');
}

module.exports = Object.freeze(env);
