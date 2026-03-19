const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
const auditLogFile = path.join(logDir, 'login_audit.log');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function auditLogin(result, detail) {
  const timestamp = new Date().toISOString();
  const message = `${timestamp} [${result}] ${detail}\n`;
  
  fs.appendFile(auditLogFile, message, (err) => {
    if (err) {
      console.error('Failed to write to audit log:', err);
    }
  });
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [INFO] ${message}`);
}

function logError(message, error) {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp} [ERROR] ${message}`, error);
}

module.exports = { auditLogin, log, logError };
