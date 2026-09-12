const jwt = require('jsonwebtoken');
const logger = require('../lib/logger');

const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'users:read', 'users:manage',
    'appointments:read', 'appointments:manage',
    'screenings:read', 'screenings:manage',
    'sms:read', 'sms:send', 'sms:broadcast', 'sms:manage',
    'cms:manage', 'settings:manage',
    'notifications:manage', 'analytics:read'
  ],
  optometrist: [
    'appointments:read', 'appointments:update',
    'screenings:read', 'screenings:manage',
    'medical_history:read', 'medical_history:update',
    'prescriptions:manage'
  ],
  doctor: [
    'appointments:read', 'appointments:update',
    'screenings:read', 'screenings:manage',
    'medical_history:read', 'medical_history:update',
    'prescriptions:manage'
  ],
  staff: [
    'appointments:read', 'appointments:create',
    'users:read', 'notifications:read'
  ],
  patient: [
    'self:read', 'self:update'
  ]
};

/**
 * Standard JWT Authentication Middleware
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ 
      error: 'UNAUTHORIZED',
      message: 'Authentication token required.' 
    });
  }

  try {
    const decoded = /** @type {any} */ (jwt.verify(token, process.env.JWT_SECRET || 'secret'));
    (/** @type {any} */ (req)).user = decoded;
    
    // Assign permissions to request based on role
    const userRole = (decoded.role || 'patient').toLowerCase();
    (/** @type {any} */ (req)).user.role = userRole;
    (/** @type {any} */ (req)).user.permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.patient;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please sign in again.' 
      });
    }
    return res.status(401).json({ 
      error: 'INVALID_TOKEN',
      message: 'Invalid authorization token.' 
    });
  }
};

/**
 * Optional Authentication (continues as guest if token not provided)
 */
const optionalAuthMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return next();
  }

  try {
    const decoded = /** @type {any} */ (jwt.verify(token, process.env.JWT_SECRET || 'secret'));
    (/** @type {any} */ (req)).user = decoded;
    const userRole = (decoded.role || 'patient').toLowerCase();
    (/** @type {any} */ (req)).user.role = userRole;
    (/** @type {any} */ (req)).user.permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.patient;
  } catch (err) {
    // Proceed as unauthenticated guest
    (/** @type {any} */ (req)).user = null;
  }
  next();
};

/**
 * Check if the user has any of the specified roles
 */
const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    const hasRole = allowedRoles.some(r => r.toLowerCase() === req.user.role?.toLowerCase());
    if (hasRole) {
      return next();
    }

    logger.warn(`Forbidden role access attempt: user ${req.user.id} (${req.user.role}) -> ${req.originalUrl}`);
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You do not have permission to access this resource.'
    });
  };
};

/**
 * Legacy Admin Middleware (Backwards compatible)
 */
const adminMiddleware = requireRole(['admin', 'super_admin']);

/**
 * Doctor / Optometrist Middleware
 */
const clinicalStaffMiddleware = requireRole(['admin', 'super_admin', 'optometrist', 'doctor']);

/**
 * Granular Permission Guard
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    const perms = req.user.permissions || [];
    const hasPerm = perms.includes('*') || perms.includes(permission);

    if (hasPerm) {
      return next();
    }

    logger.warn(`Forbidden permission attempt: user ${req.user.id} lacks '${permission}'`);
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: `Required permission '${permission}' not granted.`
    });
  };
};

/**
 * Ownership / IDOR Protection: Patient can only access their own resource or Admin
 */
const requireSelfOrAdmin = (paramKey = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    const targetId = req.params[paramKey] || req.query[paramKey] || req.body[paramKey];
    const isSelf = String(req.user.id) === String(targetId);
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

    if (isSelf || isAdmin) {
      return next();
    }

    logger.warn(`IDOR blocked: User ${req.user.id} attempted to access resource for ${targetId}`);
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You can only access or modify your own records.'
    });
  };
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  adminMiddleware,
  clinicalStaffMiddleware,
  requirePermission,
  requireSelfOrAdmin,
  ROLE_PERMISSIONS
};
