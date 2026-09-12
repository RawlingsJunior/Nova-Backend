const db = require('../config/db');
const { sendPushToAdmins } = require('./fcmService');

/**
 * Notifies all users with 'admin' or 'super_admin' roles (in-app + phone push).
 * @param {string} title - The title of the notification.
 * @param {string} message - The content of the notification.
 * @param {string} [type='info'] - The type of notification (e.g., 'info', 'booking', 'user_activity').
 */
const notifyAdmins = async (title, message, type = 'info') => {
  try {
    // 1. Find all users with admin-level roles
    const adminQuery = `
      SELECT user_id 
      FROM user_roles 
      WHERE role IN ('admin', 'super_admin')
    `;
    const admins = await db.query(adminQuery);

    if (admins.rows.length === 0) {
      console.log('No admins found to notify.');
      return;
    }

    // 2. Insert an in-app notification for each admin
    const notificationPromises = admins.rows.map((/** @type {any} */ admin) => {
      return db.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [admin.user_id, title, message, type]
      );
    });

    await Promise.all(notificationPromises);

    // 3. Dispatch FCM Push Notification to all admin phone/web devices
    sendPushToAdmins({
      title,
      body: message,
      data: { type },
      url: '/admin'
    }).catch(pushErr => console.error('[FCM Admin push error]:', pushErr.message));

    console.log(`Successfully notified ${admins.rows.length} admins.`);
  } catch (err) {
    console.error('Error in notifyAdmins service:', err);
  }
};

module.exports = { notifyAdmins };
