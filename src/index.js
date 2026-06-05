const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ override: true });
/** @type {any} */
const helmet = require('helmet');
/** @type {any} */
const hpp = require('hpp');
const { apiLimiter, authLimiter, bookingLimiter, chatbotLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database
const initializeDatabase = require('./initDb');
initializeDatabase();

// CORS MUST come first — before helmet and rate limiters
// so that preflight OPTIONS requests get proper headers
app.use(cors({
  origin: true, // reflect the requesting origin
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10kb' }));

// Security Middleware
app.use(helmet()); // Set security HTTP headers
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Data sanitization against XSS (Express 5 compatible)
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
  if (req.body) {
    req.body = sanitize(req.body);
  }
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

// Rate Limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/update-password', authLimiter);
app.use('/api/appointments', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return bookingLimiter(req, res, next);
  }
  next();
});
app.use('/api/chatbot', chatbotLimiter);
app.use('/api/', apiLimiter);

// Global Request Logging
const scrubBody = (body) => {
  if (!body) return '';
  const scrubbed = { ...body };
  const sensitiveKeys = [
    'password', 'currentPassword', 'newPassword', 'otp', 
    'otpToken', 'resetOtpToken', 'captchaAnswer', 'token'
  ];
  sensitiveKeys.forEach(key => {
    if (key in scrubbed) {
      scrubbed[key] = '[REDACTED]';
    }
  });
  return JSON.stringify(scrubbed);
};

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms | Body: ${scrubBody(req.body)}\n`;
    const logFile = path.join(__dirname, '../logs/request.log');
    
    // Ensure logs directory exists
    const logsDir = path.dirname(logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    try {
      fs.appendFileSync(logFile, log);
    } catch (err) {
      console.error('Failed to write to request log:', err.message);
    }
  });
  next();
});

// Routes
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

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Basic Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Nova Eye Care Backend API' });
});

// Health check route
app.get('/health', async (req, res) => {
  try {
    const db = require('./config/db');
    /** @type {any} */
    const result = await db.query('SELECT NOW()');
    res.json({ 
      status: 'UP', 
      database: 'Connected', 
      timestamp: result.rows[0].now 
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'DOWN', 
      database: 'Error', 
      message: err.message 
    });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  const errorLog = `[${new Date().toISOString()}] Error in ${req.method} ${req.originalUrl}:\n${err.stack}\n\n`;
  const errorFile = path.join(__dirname, '../logs/error.log');
  fs.appendFileSync(errorFile, errorLog);
  
  console.error('SERVER ERROR:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

server.on('error', (err) => {
  console.error('Server socket error:', err.message);
});


  
