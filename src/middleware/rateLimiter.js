const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const logger = require('../lib/logger');

function createRateLimitHandler(type, message) {
  return (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    
    logger.warn(`Rate limit triggered [${type}] from IP: ${req.ip}`, {
      ip: req.ip,
      path: req.originalUrl,
      type
    });

    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message,
      retryAfterSeconds: retryAfter
    });
  };
}

/**
 * Key Generator aware of Carrier-Grade NAT (CGNAT) on mobile networks.
 * Authenticated users are tracked by account ID so users on shared cell towers
 * or clinic Wi-Fi do not collide. Unauthenticated visitors fall back to IPv6-safe IP key.
 */
const userOrIpKey = (req) => {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  return ipKeyGenerator(req.ip || '127.0.0.1');
};

// 1. General API Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Scaled for 5,000+ active users
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  validate: {
    xForwardedForHeader: false,
    default: true
  },
  skip: (req) => {
    // Skip health checks and static favicon
    return req.path.startsWith('/health') || req.path === '/favicon.ico';
  },
  handler: createRateLimitHandler('API_GENERAL', 'Too many requests. Please slow down and try again shortly.')
});

// 2. Authentication Rate Limiter (Brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'AUTH_BRUTE_FORCE',
    'Too many login or authentication attempts. For your security, this action is temporarily paused. Please try again in 15 minutes.'
  )
});

// 3. SMS Rate Limiter (Abuse & budget protection)
const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 45, // Max 45 SMS dispatch requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'SMS_THROTTLE',
    'SMS dispatch rate limit reached. Please wait before broadcasting or sending more SMS.'
  )
});

// 4. Public Appointment Booking Limiter (Spam reservation protection)
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 bookings per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !!req.headers.authorization, // Skip verified logged-in administrators
  handler: createRateLimitHandler(
    'BOOKING_SPAM',
    'Too many booking requests from this network. Please review your existing bookings or try again in a few minutes.'
  )
});

// 5. Chatbot Rate Limiter (Token consumption protection)
const chatbotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 messages per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'CHATBOT_RATE_LIMIT',
    'You have reached the chat query limit. Please wait a few moments or call our clinic directly at +233 54 417 2089.'
  )
});

module.exports = {
  apiLimiter,
  authLimiter,
  smsLimiter,
  bookingLimiter,
  chatbotLimiter
};
