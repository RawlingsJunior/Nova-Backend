const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOGS_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Async file write streams for non-blocking disk writes
const errorStream = fs.createWriteStream(path.join(LOGS_DIR, 'error.log'), { flags: 'a' });
const combinedStream = fs.createWriteStream(path.join(LOGS_DIR, 'combined.log'), { flags: 'a' });
const auditStream = fs.createWriteStream(path.join(LOGS_DIR, 'audit.log'), { flags: 'a' });

const SENSITIVE_KEYS = new Set([
  'password', 'currentpassword', 'newpassword', 'confirmpassword',
  'otp', 'otptoken', 'resetotptoken', 'token', 'authorization',
  'secret', 'jwt_secret', 'apikey', 'api_key', 'creditcard', 'cvv'
]);

/**
 * Recursively sanitize objects to prevent leaking secrets into logs
 */
function sanitize(data) {
  if (!data) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitize);

  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Generate or retrieve a correlation request ID
 */
function getRequestId(req) {
  if (!req) return null;
  return req.headers['x-request-id'] || req.id || crypto.randomUUID();
}

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  AUDIT: 1
};

const currentLogLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO 
  : LOG_LEVELS.INFO;

function formatEntry(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const sanitizedMeta = sanitize(meta);
  return {
    timestamp,
    level,
    message,
    ...sanitizedMeta
  };
}

function writeLog(level, entry) {
  if (LOG_LEVELS[level] < currentLogLevel) return;

  const jsonString = JSON.stringify(entry) + '\n';
  
  // Console output formatted for container log aggregators (Render, Docker, AWS CloudWatch)
  if (level === 'ERROR') {
    console.error(`[${entry.timestamp}] [${level}] ${entry.message}`, entry.error || entry);
    errorStream.write(jsonString);
  } else if (level === 'WARN') {
    console.warn(`[${entry.timestamp}] [${level}] ${entry.message}`, entry);
  } else {
    console.log(`[${entry.timestamp}] [${level}] ${entry.message}`);
  }

  combinedStream.write(jsonString);

  if (level === 'AUDIT') {
    auditStream.write(jsonString);
  }
}

const logger = {
  debug(message, meta) {
    writeLog('DEBUG', formatEntry('DEBUG', message, meta));
  },
  info(message, meta) {
    writeLog('INFO', formatEntry('INFO', message, meta));
  },
  warn(message, meta) {
    writeLog('WARN', formatEntry('WARN', message, meta));
  },
  error(message, errorOrMeta, extraMeta = {}) {
    let meta = {};
    if (errorOrMeta instanceof Error) {
      meta = {
        error: {
          name: errorOrMeta.name,
          message: errorOrMeta.message,
          stack: errorOrMeta.stack,
        },
        ...extraMeta
      };
    } else {
      meta = { ...errorOrMeta, ...extraMeta };
    }
    writeLog('ERROR', formatEntry('ERROR', message, meta));
  },
  audit(action, details = {}) {
    writeLog('AUDIT', formatEntry('AUDIT', `AUDIT: ${action}`, details));
  },
  getRequestId,
  sanitize
};

module.exports = logger;
