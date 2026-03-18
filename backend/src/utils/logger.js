/**
 * Async file logger — non-blocking audit and application logging.
 *
 * Log Rotation (audit log only):
 *   - Max file size: 5 MB
 *   - When the limit is hit, the current file is renamed to
 *     login_audit.log.bak (overwriting the previous backup) and a
 *     fresh login_audit.log is started.
 *   - All I/O is async — zero impact on request handling.
 */

const fs = require('fs');
const path = require('path');

// ── Setup ─────────────────────────────────────────────────────────────────────

const LOG_DIR = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_FILES = {
  audit: path.join(LOG_DIR, 'login_audit.log'),
  app: path.join(LOG_DIR, 'app.log'),
  error: path.join(LOG_DIR, 'error.log')
};

// ── Rotation config ───────────────────────────────────────────────────────────

const AUDIT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

let rotationInProgress = false;

/**
 * Rotates the audit log when it exceeds AUDIT_MAX_BYTES.
 * Renames current file to .bak and starts a fresh log.
 * No-op if a rotation is already happening.
 */
function rotateAuditLogIfNeeded(callback) {
  if (rotationInProgress) return callback();

  fs.stat(LOG_FILES.audit, (statErr, stats) => {
    if (statErr || stats.size < AUDIT_MAX_BYTES) {
      // File doesn't exist yet, or is within limit — nothing to do
      return callback();
    }

    rotationInProgress = true;
    const backupPath = `${LOG_FILES.audit}.bak`;

    fs.rename(LOG_FILES.audit, backupPath, (renameErr) => {
      rotationInProgress = false;
      if (renameErr) {
        // eslint-disable-next-line no-console
        console.error('[logger] Rotation failed:', renameErr.message);
      }
      callback();
    });
  });
}

// ── Core write helpers ────────────────────────────────────────────────────────

/**
 * Writes a line to a log file asynchronously (non-blocking).
 * @param {string} filePath - Absolute path to the log file
 * @param {string} message  - Log message (newline appended automatically)
 */
function writeLine(filePath, message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  fs.appendFile(filePath, line, (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error(`[logger] Failed to write to ${filePath}:`, err.message);
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Logs a login audit event (success or failure).
 * Automatically rotates the audit file when it exceeds 5 MB.
 * @param {'SUCCESS'|'FAIL'|'BLOCKED'} result
 * @param {string} detail  - Human-readable detail (email, reason, etc.)
 */
function auditLogin(result, detail) {
  const line = `${new Date().toISOString()} [${result}] ${detail}\n`;

  rotateAuditLogIfNeeded(() => {
    fs.appendFile(LOG_FILES.audit, line, (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('[logger] Failed to write audit log:', err.message);
      }
    });
  });
}

/**
 * Logs a general application message.
 * @param {string} level   - 'INFO' | 'WARN' | 'ERROR'
 * @param {string} message
 */
function log(level, message) {
  writeLine(LOG_FILES.app, `[${level}] ${message}`);
}

/**
 * Logs an error with optional stack trace.
 * @param {string} context - Where the error occurred
 * @param {Error|string} err
 */
function logError(context, err) {
  const message = err instanceof Error
    ? `${err.message}\n${err.stack}`
    : String(err);
  writeLine(LOG_FILES.error, `[ERROR] ${context}: ${message}`);
}

module.exports = { auditLogin, log, logError };
