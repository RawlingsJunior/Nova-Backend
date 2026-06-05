const { rateLimit } = require('express-rate-limit');

// Default API Rate Limiter (for general app navigation, queries, profiles, settings, etc.)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict Rate Limiter for Authentication & Security endpoints (login, register, reset, update password)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 login/register attempts per 15 minutes
  message: {
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes to protect your account security.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate Rate Limiter for Appointment Bookings (prevents spamming or DDoS on booking database)
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 appointment actions per 15 minutes
  message: {
    message: 'Too many appointment booking requests. Please check your dashboard or try again in a few minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Chatbot Rate Limiter (prevents scraping or excessive AI model token usage costs)
const chatbotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 chatbot queries per 15 minutes
  message: {
    message: 'You have reached the chatbot query rate limit. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  bookingLimiter,
  chatbotLimiter
};
