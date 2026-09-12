const db = require('../config/db');
const { logAuditEvent } = require('../lib/auditLogger');
const os = require('os');

/**
 * Format bytes to readable megabytes
 */
const toMB = (bytes) => (bytes / (1024 * 1024)).toFixed(2);

/**
 * Format seconds to readable human duration (e.g. 2d 5h 14m)
 */
const formatDuration = (seconds) => {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
};

/**
 * GET /api/system/metrics
 * System, Database, and Security Telemetry
 */
const getMetrics = async (req, res) => {
  try {
    const mem = process.memoryUsage();
    const uptimeSec = process.uptime();

    // 1. Measure PostgreSQL DB query latency
    const dbStart = Date.now();
    await db.query('SELECT 1');
    const dbPingMs = Date.now() - dbStart;

    // 2. Query DB version
    let pgVersion = 'PostgreSQL';
    try {
      /** @type {any} */
      const versionRes = await db.query('SELECT version()');
      if (versionRes.rows.length > 0) {
        pgVersion = versionRes.rows[0].version.split(' ')[0] + ' ' + (versionRes.rows[0].version.split(' ')[1] || '');
      }
    } catch (e) {
      // Fallback
    }

    // 3. Security Metrics: Locked accounts, failed attempts
    /** @type {any} */
    const lockedRes = await db.query(`
      SELECT COUNT(*)::int as count 
      FROM users 
      WHERE locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP
    `);
    const lockedAccountsCount = lockedRes.rows[0]?.count || 0;

    /** @type {any} */
    const failedLogins24hRes = await db.query(`
      SELECT COUNT(*)::int as count 
      FROM audit_logs 
      WHERE action IN ('LOGIN_FAILED', 'LOGIN_FAILED_UNKNOWN_USER', 'ACCOUNT_LOCKED', 'LOGIN_BLOCKED_LOCKED')
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `);
    const failedLogins24h = failedLogins24hRes.rows[0]?.count || 0;

    // 4. Counts of core entities
    /** @type {[any, any, any]} */
    const [usersCount, apptsCount, auditLogsCount] = await Promise.all([
      db.query('SELECT COUNT(*)::int as count FROM users'),
      db.query('SELECT COUNT(*)::int as count FROM appointments'),
      db.query('SELECT COUNT(*)::int as count FROM audit_logs')
    ]);

    // 5. Providers configuration status
    const providers = {
      database: {
        status: dbPingMs < 200 ? 'healthy' : dbPingMs < 800 ? 'degraded' : 'slow',
        latencyMs: dbPingMs,
        provider: 'Neon Serverless PostgreSQL',
        version: pgVersion,
        pool: {
          total: db.pool.totalCount,
          idle: db.pool.idleCount,
          waiting: db.pool.waitingCount
        }
      },
      sms: {
        status: Boolean(process.env.ARKESEL_API_KEY) ? 'configured' : 'fallback_simulation',
        provider: 'Arkesel SMS Gateway',
        senderId: process.env.ARKESEL_SENDER_ID || 'NovaEyeCare'
      },
      email: {
        status: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS) ? 'configured' : 'fallback_simulation',
        provider: 'SMTP / Nodemailer'
      }
    };

    // 6. Security alert synthesis
    const securityAlerts = [];
    if (lockedAccountsCount > 0) {
      securityAlerts.push({
        level: 'warning',
        message: `${lockedAccountsCount} user account(s) currently locked out due to failed attempts.`
      });
    }
    if (failedLogins24h > 20) {
      securityAlerts.push({
        level: 'warning',
        message: `High volume of failed login attempts detected in last 24h (${failedLogins24h} attempts).`
      });
    }

    res.json({
      timestamp: new Date().toISOString(),
      system: {
        uptimeSeconds: Math.floor(uptimeSec),
        uptimeFormatted: formatDuration(uptimeSec),
        nodeVersion: process.version,
        platform: `${os.platform()} (${os.arch()})`,
        cpus: os.cpus().length,
        memory: {
          rssMB: toMB(mem.rss),
          heapTotalMB: toMB(mem.heapTotal),
          heapUsedMB: toMB(mem.heapUsed),
          heapUtilizationPercent: ((mem.heapUsed / mem.heapTotal) * 100).toFixed(1)
        }
      },
      database: providers.database,
      providers,
      security: {
        lockedAccountsCount,
        failedLogins24h,
        totalUsers: usersCount.rows[0]?.count || 0,
        totalAppointments: apptsCount.rows[0]?.count || 0,
        totalAuditLogs: auditLogsCount.rows[0]?.count || 0,
        alerts: securityAlerts
      }
    });
  } catch (err) {
    console.error('getMetrics error:', err);
    res.status(500).json({ message: 'Error collecting system metrics', error: err.message });
  }
};

/**
 * GET /api/system/audit-logs
 * Filterable live audit log feed with user, action, category, and text search
 */
const getAuditLogs = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const action = req.query.action;
  const userId = req.query.userId;
  const search = req.query.search;
  const category = req.query.category;

  try {
    let query = `
      SELECT 
        a.id, 
        a.user_id as "userId", 
        a.action, 
        a.details, 
        a.ip, 
        a.created_at as "createdAt",
        u.email,
        p.full_name as "fullName",
        ur.role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles p ON a.user_id = p.id
      LEFT JOIN user_roles ur ON a.user_id = ur.user_id
      WHERE 1=1
    `;

    const params = [];

    if (userId) {
      params.push(userId);
      query += ` AND a.user_id = $${params.length}`;
    }

    if (action && action !== 'all') {
      params.push(action);
      query += ` AND a.action = $${params.length}`;
    }

    if (category && category !== 'all') {
      if (category === 'auth') {
        query += ` AND (a.action LIKE 'LOGIN_%' OR a.action LIKE 'REGISTER%' OR a.action LIKE 'ACCOUNT_%' OR a.action LIKE 'PASSWORD%')`;
      } else if (category === 'appointments') {
        query += ` AND a.action LIKE 'APPOINTMENT_%'`;
      } else if (category === 'clinical') {
        query += ` AND (a.action LIKE 'EYE_SCREENING_%' OR a.action LIKE 'MEDICAL_HISTORY_%')`;
      } else if (category === 'reviews') {
        query += ` AND a.action LIKE 'REVIEW_%'`;
      } else if (category === 'sms') {
        query += ` AND a.action LIKE 'SMS_%'`;
      } else if (category === 'admin') {
        query += ` AND (a.action LIKE 'ROLE_%' OR a.action LIKE 'UPDATE_CMS_%' OR a.action LIKE 'SETTINGS_%' OR a.action LIKE 'ADMIN_%')`;
      } else if (category === 'portal') {
        query += ` AND (a.action LIKE 'PAGE_VIEW%' OR a.action LIKE 'PORTAL_%')`;
      }
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      const sIndex = params.length;
      query += ` AND (
        LOWER(a.action) LIKE $${sIndex} OR 
        LOWER(COALESCE(u.email, '')) LIKE $${sIndex} OR 
        LOWER(COALESCE(p.full_name, '')) LIKE $${sIndex} OR 
        LOWER(COALESCE(a.ip, '')) LIKE $${sIndex} OR 
        LOWER(a.details::text) LIKE $${sIndex}
      )`;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('getAuditLogs error:', err);
    res.status(500).json({ message: 'Error retrieving audit logs', error: err.message });
  }
};

/**
 * POST /api/system/activity
 * Log client-side user interactions / navigation
 */
const logClientActivity = async (req, res) => {
  const { action = 'PAGE_VIEW', details = {} } = req.body;
  const userId = req.user ? req.user.id : null;

  try {
    await logAuditEvent({
      userId,
      action: action.toUpperCase().replace(/\s+/g, '_'),
      details,
      req
    });
    res.json({ success: true });
  } catch (err) {
    console.error('logClientActivity error:', err);
    res.status(500).json({ error: 'Failed to record activity' });
  }
};

/**
 * GET /api/system/locked-users
 * List all users currently locked or having active failed attempts
 */
const getLockedUsers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id, 
        u.email, 
        u.failed_login_attempts as "failedAttempts", 
        u.locked_until as "lockedUntil", 
        p.full_name as "fullName",
        p.phone,
        ur.role
      FROM users u
      LEFT JOIN profiles p ON u.id = p.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      WHERE (u.locked_until IS NOT NULL AND u.locked_until > CURRENT_TIMESTAMP)
         OR (u.failed_login_attempts > 0)
      ORDER BY u.locked_until DESC NULLS LAST, u.failed_login_attempts DESC
      LIMIT 100
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('getLockedUsers error:', err);
    res.status(500).json({ message: 'Error retrieving locked accounts', error: err.message });
  }
};

/**
 * POST /api/system/unlock-user
 * Manually unlock an account and reset failed attempts counter
 */
const unlockUser = async (req, res) => {
  const { userId, email } = req.body;

  if (!userId && !email) {
    return res.status(400).json({ message: 'userId or email is required' });
  }

  try {
    /** @type {any} */
    let targetUser;
    if (userId) {
      /** @type {any} */
      const u = await db.query('SELECT id, email FROM users WHERE id = $1', [userId]);
      targetUser = u.rows[0];
    } else {
      /** @type {any} */
      const u = await db.query('SELECT id, email FROM users WHERE email = $1', [email]);
      targetUser = u.rows[0];
    }

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    await db.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [targetUser.id]
    );

    logAuditEvent({
      userId: req.user.id,
      action: 'ACCOUNT_UNLOCKED',
      details: { targetUserId: targetUser.id, targetEmail: targetUser.email },
      req
    });

    res.json({
      message: `Account for ${targetUser.email} has been successfully unlocked and reset.`,
      user: targetUser
    });
  } catch (err) {
    console.error('unlockUser error:', err);
    res.status(500).json({ message: 'Error unlocking account', error: err.message });
  }
};

module.exports = {
  getMetrics,
  getAuditLogs,
  logClientActivity,
  getLockedUsers,
  unlockUser
};
