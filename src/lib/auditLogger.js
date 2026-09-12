const db = require('../config/db');
const logger = require('./logger');

/**
 * Record a security or system event in the audit_logs table
 * Non-blocking: logs errors without crashing the main request flow
 * 
 * @param {Object} params
 * @param {string} [params.userId] - UUID of the user associated with action
 * @param {string} params.action - Event action code (e.g., 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'ROLE_CHANGED')
 * @param {Object|string} [params.details] - Metadata or context for the event
 * @param {string} [params.ip] - IP address of the requester
 * @param {import('express').Request} [params.req] - Express request to extract IP / user from if omitted
 */
const logAuditEvent = async ({ userId, action, details = {}, ip, req } = {}) => {
  try {
    const clientIp = ip || (req ? (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip) : 'unknown');
    const uId = userId || (req?.user?.id ? req.user.id : null);
    const detailsJson = typeof details === 'object' ? JSON.stringify(details) : JSON.stringify({ message: String(details) });

    await db.query(
      `INSERT INTO audit_logs (user_id, action, details, ip) VALUES ($1, $2, $3, $4)`,
      [uId, action, detailsJson, clientIp]
    );
  } catch (err) {
    logger.error('Failed to record audit log:', { error: err.message, action });
  }
};

module.exports = { logAuditEvent };
