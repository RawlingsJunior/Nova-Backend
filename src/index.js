const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ override: true });
/** @type {any} */
const helmet = require('helmet');
/** @type {any} */
const hpp = require('hpp');
const compression = require('compression');

const logger = require('./lib/logger');
const db = require('./config/db');
const { 
  apiLimiter, 
  authLimiter, 
  bookingLimiter, 
  chatbotLimiter 
} = require('./middleware/rateLimiter');

const app = express();
app.set('trust proxy', 1); // Enable proxy forwarding for Render/Cloudflare/reverse proxies
const PORT = process.env.PORT || 5000;

// Initialize Database
const initializeDatabase = require('./initDb');
initializeDatabase();

// 1. CORS MUST come first — before helmet and rate limiters
// so that preflight OPTIONS requests receive proper headers
app.use(cors({
  origin: true, // reflect the requesting origin
  credentials: true,
  exposedHeaders: ['X-Request-ID', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After', 'ETag', 'X-Cache']
}));

// 2. Response Compression (Gzip / Deflate for all text & json > 1KB)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// 3. Request Correlation ID Middleware
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  (/** @type {any} */ (req)).id = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
});

// 4. Body parser with reasonable payload limit
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// 5. Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));
app.use(hpp()); // Prevent HTTP Parameter Pollution

// 6. Data sanitization against XSS
const sanitize = (data) => {
  if (typeof data === 'string') {
    return data.replace(/<[^>]*>/g, '');
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitize(item));
  }
  if (typeof data === 'object' && data !== null) {
    const cleanObj = {};
    for (const key in data) {
      cleanObj[key] = sanitize(data[key]);
    }
    return cleanObj;
  }
  return data;
};

app.use((req, res, next) => {
  if (req.body) req.body = sanitize(req.body);
  if (req.query) {
    const cleanedQuery = sanitize(req.query);
    Object.defineProperty(req, 'query', {
      value: cleanedQuery,
      writable: true,
      configurable: true,
      enumerable: true
    });
  }
  if (req.params) {
    const cleanedParams = sanitize(req.params);
    Object.defineProperty(req, 'params', {
      value: cleanedParams,
      writable: true,
      configurable: true,
      enumerable: true
    });
  }
  next();
});

// 7. Non-Blocking Asynchronous Structured Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms`, {
      requestId: (/** @type {any} */ (req)).id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  });
  next();
});

// 8. Rate Limiting Rules
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/update-password', authLimiter);
app.use('/api/appointments', (req, res, next) => {
  if (req.method === 'POST') {
    return bookingLimiter(req, res, next);
  }
  next();
});
app.use('/api/chatbot', chatbotLimiter);
app.use('/api/', apiLimiter);

// 9. API Routes
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/users', require('./routes/users.js'));
app.use('/api/profiles', require('./routes/profiles.js'));
app.use('/api/appointments', require('./routes/appointments.js'));
app.use('/api/services', require('./routes/services.js'));
app.use('/api/medical', require('./routes/medical.js'));
app.use('/api/reviews', require('./routes/reviews.js'));
app.use('/api/cms', require('./routes/cms.js'));
app.use('/api/settings', require('./routes/settings.js'));
app.use('/api/notifications', require('./routes/notifications.js'));
app.use('/api/dashboard', require('./routes/dashboard.js'));
app.use('/api/chatbot', require('./routes/chatbot.js'));
app.use('/api/prescriptions', require('./routes/prescriptions.js'));
app.use('/api/invoices', require('./routes/invoices.js'));
app.use('/api/media', require('./routes/media.js'));
app.use('/api/sms', require('./routes/sms.js'));
app.use('/api/system', require('./routes/system.js'));

// 10. Static Uploads with HTTP Caching Headers (7 days cache)
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '7d',
  etag: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  }
}));

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Basic Route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Nova Eye Care Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production'
  });
});

// 11. Multi-Tier Health Checks for Load Balancers & Monitoring
// Fast Liveness probe: Is the Node process responsive?
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'LIVE', timestamp: new Date().toISOString() });
});

// Readiness probe: Can the application talk to the database?
app.get('/health/ready', async (req, res) => {
  const dbHealth = await db.healthCheck();
  if (dbHealth.healthy) {
    return res.status(200).json({ status: 'READY', database: 'HEALTHY', latencyMs: dbHealth.latencyMs });
  }
  return res.status(503).json({ status: 'NOT_READY', database: 'UNHEALTHY', error: dbHealth.error });
});

// Comprehensive Health & Telemetry Check
app.get('/health', async (req, res) => {
  const dbHealth = await db.healthCheck();
  const memoryUsage = process.memoryUsage();

  const healthData = {
    status: dbHealth.healthy ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      connected: dbHealth.healthy,
      latencyMs: dbHealth.latencyMs,
      pool: {
        total: dbHealth.totalCount,
        idle: dbHealth.idleCount,
        waiting: dbHealth.waitingCount
      }
    },
    system: {
      memoryRssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      nodeVersion: process.version
    }
  };

  const statusCode = dbHealth.healthy ? 200 : 503;
  res.status(statusCode).json(healthData);
});

// 12. 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.originalUrl}` 
  });
});

// 13. Centralized Asynchronous Error Handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled request error in ${req.method} ${req.originalUrl}`, err, {
    requestId: (/** @type {any} */ (req)).id,
    ip: req.ip
  });

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.code || 'INTERNAL_ERROR',
    message: err.message || 'An unexpected error occurred. Please try again.',
    requestId: (/** @type {any} */ (req)).id,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 14. Start Server
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    logger.info(`Server successfully running on port ${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development'
    });
  });

  server.on('error', (err) => {
    logger.error('Server socket error', err);
  });
}

// 15. Graceful Zero-Downtime Shutdown Handler
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const closePool = async () => {
    logger.info('Draining database connection pool...');
    try {
      await db.pool.end();
      logger.info('Database connection pool closed successfully. Exiting process.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during pool shutdown', err);
      process.exit(1);
    }
  };

  // Stop accepting new connections if server running
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed.');
      closePool();
    });
  } else {
    closePool();
  }

  // Force close after 10s if connections refuse to drain
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded (10s). Forcing shutdown.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Process Exception Safety
process.on('uncaughtException', (err) => {
  logger.error('CRITICAL: Uncaught Exception thrown', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('CRITICAL: Unhandled Promise Rejection', reason);
});

module.exports = app;
