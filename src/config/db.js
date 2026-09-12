const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config({ override: true });
const logger = require('../lib/logger');

// Configure Neon to use WebSockets in Node.js (bypasses port 5432 firewall restrictions)
neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000, // 30s connection timeout for cold starts
  idleTimeoutMillis: 30000,       // 30s idle timeout
  max: 25                         // Scaled connection pool size for 5000+ users
});

pool.on('connect', () => {
  logger.debug('Database pool connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected database client error in pool', err);
});

const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENOTFOUND',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004'  // sqlserver_rejected_establishment_of_sqlconnection
]);

/**
 * Execute query with exponential backoff and randomized jitter for transient faults
 */
async function queryWithRetry(text, params, maxRetries = 3) {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    try {
      const start = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries (> 1 second) for performance observability
      if (duration > 1000) {
        logger.warn(`Slow Database Query (${duration}ms)`, {
          query: text.slice(0, 100),
          duration
        });
      }

      return result;
    } catch (err) {
      attempt++;
      lastError = err;

      const isRetryable = RETRYABLE_CODES.has(err.code) || 
        err.message?.includes('Connection terminated') ||
        err.message?.includes('socket') ||
        err.message?.includes('timeout') ||
        err.message?.includes('closed');

      if (isRetryable && attempt < maxRetries) {
        // Backoff: 500ms, 1500ms, 3000ms + random jitter (0-200ms)
        const delay = Math.pow(2, attempt - 1) * 500 + Math.floor(Math.random() * 200);
        logger.warn(`Transient database error, retrying (Attempt ${attempt}/${maxRetries}) in ${delay}ms...`, {
          code: err.code,
          message: err.message
        });
        await new Promise(res => setTimeout(res, delay));
      } else {
        break;
      }
    }
  }

  logger.error('Database query failed after retries', lastError, {
    query: text.slice(0, 150)
  });
  throw lastError;
}

/**
 * Check database connectivity and measure latency
 */
async function healthCheck() {
  const start = Date.now();
  try {
    const res = await pool.query('SELECT 1 AS healthy, NOW() AS server_time');
    const latencyMs = Date.now() - start;
    return {
      healthy: true,
      latencyMs,
      serverTime: res.rows[0].server_time,
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  } catch (err) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: err.message
    };
  }
}

module.exports = {
  query: queryWithRetry,
  pool,
  healthCheck
};
