const db = require('../config/db');
const { getMessaging, isConfigured } = require('../config/firebase');

/**
 * Send push notification to a specific user across all their registered phone/web devices
 * @param {string} userId - UUID of user
 * @param {object} payload - { title, body, data, icon, url }
 * @returns {Promise<{ successCount: number, failureCount: number, error?: string }>}
 */
async function sendPushToUser(userId, payload = {}) {
  if (!userId) return { successCount: 0, failureCount: 0 };

  try {
    // 1. Fetch user's active device tokens
    /** @type {any} */
    const res = await db.query(
      'SELECT id, token FROM user_device_tokens WHERE user_id = $1',
      [userId]
    );

    if (!res.rows || res.rows.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    /** @type {string[]} */
    const tokens = res.rows.map((/** @type {any} */ r) => r.token);

    if (!isConfigured()) {
      console.log(`[FCM Push - Dry Run] User ${userId} has ${tokens.length} registered device(s). Notification: "${payload.title}" - ${payload.body}`);
      return { successCount: tokens.length, failureCount: 0 };
    }

    const messaging = getMessaging();
    if (!messaging) {
      console.warn('[FCM Push] Firebase Messaging is not initialized');
      return { successCount: 0, failureCount: 0 };
    }

    // 2. Build Multicast Message
    const multicastMessage = {
      tokens,
      notification: {
        title: payload.title || 'Nova Eye Care Alert',
        body: payload.body || ''
      },
      data: payload.data 
        ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)]))
        : {},
      webpush: {
        notification: {
          icon: payload.icon || '/assets/logo.jpeg',
          badge: '/assets/logo.jpeg',
          vibrate: [200, 100, 200]
        },
        fcmOptions: {
          link: payload.url || '/dashboard'
        }
      }
    };

    // 3. Dispatch multicast
    const response = await messaging.sendEachForMulticast(multicastMessage);

    // 4. Prune invalid or expired tokens
    const deadTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const code = resp.error.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          deadTokens.push(tokens[idx]);
        }
      }
    });

    if (deadTokens.length > 0) {
      await db.query(
        'DELETE FROM user_device_tokens WHERE token = ANY($1)',
        [deadTokens]
      );
      console.log(`[FCM Push] Pruned ${deadTokens.length} expired or invalid device token(s).`);
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (err) {
    console.error(`[FCM Push] Error sending push to user ${userId}:`, err.message);
    return { successCount: 0, failureCount: 0, error: err.message };
  }
}

/**
 * Send push notification to all administrative staff (admin & super_admin)
 * @param {object} payload - { title, body, data, icon, url }
 * @returns {Promise<{ successCount: number, failureCount: number }>}
 */
async function sendPushToAdmins(payload = {}) {
  try {
    const adminQuery = `
      SELECT DISTINCT t.token, t.id
      FROM user_device_tokens t
      JOIN user_roles r ON t.user_id = r.user_id
      WHERE r.role IN ('admin', 'super_admin')
    `;
    /** @type {any} */
    const res = await db.query(adminQuery);

    if (!res.rows || res.rows.length === 0) return { successCount: 0, failureCount: 0 };

    /** @type {string[]} */
    const tokens = res.rows.map((/** @type {any} */ r) => r.token);

    if (!isConfigured()) {
      console.log(`[FCM Admin Push - Dry Run] Sent to ${tokens.length} admin device(s): "${payload.title}" - ${payload.body}`);
      return { successCount: tokens.length, failureCount: 0 };
    }

    const messaging = getMessaging();
    if (!messaging) {
      console.warn('[FCM Admin Push] Firebase Messaging is not initialized');
      return { successCount: 0, failureCount: 0 };
    }

    const multicastMessage = {
      tokens,
      notification: {
        title: payload.title || 'Nova Care Admin Alert',
        body: payload.body || ''
      },
      data: payload.data 
        ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)]))
        : {},
      webpush: {
        notification: {
          icon: payload.icon || '/assets/logo.jpeg',
          badge: '/assets/logo.jpeg'
        },
        fcmOptions: {
          link: payload.url || '/admin'
        }
      }
    };

    const response = await messaging.sendEachForMulticast(multicastMessage);
    return {
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (err) {
    console.error('[FCM Push] Error broadcasting to admins:', err.message);
    return { successCount: 0, failureCount: 0 };
  }
}

/**
 * Broadcast push notification to all active patient and staff devices
 * @param {object} payload - { title, body, data, icon, url }
 * @returns {Promise<{ successCount: number, failureCount: number }>}
 */
async function sendBroadcastPush(payload = {}) {
  try {
    /** @type {any} */
    const res = await db.query('SELECT DISTINCT token FROM user_device_tokens');
    if (!res.rows || res.rows.length === 0) return { successCount: 0, failureCount: 0 };

    /** @type {string[]} */
    const allTokens = res.rows.map((/** @type {any} */ r) => r.token);

    if (!isConfigured()) {
      console.log(`[FCM Broadcast - Dry Run] Sent broadcast to ${allTokens.length} device(s): "${payload.title}"`);
      return { successCount: allTokens.length, failureCount: 0 };
    }

    const messaging = getMessaging();
    if (!messaging) {
      console.warn('[FCM Broadcast] Firebase Messaging is not initialized');
      return { successCount: 0, failureCount: 0 };
    }

    // Process in batches of 500 (FCM limit)
    const BATCH_SIZE = 500;
    let totalSuccess = 0;
    let totalFailure = 0;

    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
      const batchTokens = allTokens.slice(i, i + BATCH_SIZE);
      const multicastMessage = {
        tokens: batchTokens,
        notification: {
          title: payload.title || 'Nova Eye Care Announcement',
          body: payload.body || ''
        },
        data: payload.data 
          ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)]))
          : {},
        webpush: {
          notification: {
            icon: payload.icon || '/assets/logo.jpeg',
            badge: '/assets/logo.jpeg'
          },
          fcmOptions: {
            link: payload.url || '/dashboard'
          }
        }
      };

      const response = await messaging.sendEachForMulticast(multicastMessage);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    }

    return { successCount: totalSuccess, failureCount: totalFailure };
  } catch (err) {
    console.error('[FCM Push] Error in sendBroadcastPush:', err.message);
    return { successCount: 0, failureCount: 0 };
  }
}

module.exports = {
  sendPushToUser,
  sendPushToAdmins,
  sendBroadcastPush
};
