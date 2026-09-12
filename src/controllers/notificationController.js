const db = require('../config/db');
const { sendPushToUser } = require('../services/fcmService');

const getNotifications = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const markAsRead = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const markAllAsRead = async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all read:', err);
    res.status(500).send('Server error');
  }
};

const getAllNotifications = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const createNotification = async (userId, title, message, type = 'info', url = '/dashboard') => {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [userId, title, message, type]
    );

    // Automatically send phone push notification to all user's registered devices
    sendPushToUser(userId, {
      title,
      body: message,
      data: { type },
      url
    }).catch(err => console.error('[FCM createNotification Push error]:', err.message));
  } catch (err) {
    console.error('Error creating notification:', err);
  }
};

// Register FCM Device Push Token
const registerDeviceToken = async (req, res) => {
  const { token, platform } = req.body;
  const userId = req.user.id;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Valid device token is required' });
  }

  const userAgent = req.headers['user-agent'] || null;
  const devicePlatform = platform || (userAgent && /iphone|ipad|ipod/i.test(userAgent) ? 'ios' : (userAgent && /android/i.test(userAgent) ? 'android' : 'web'));

  try {
    await db.query(
      `INSERT INTO user_device_tokens (user_id, token, platform, user_agent, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, token) 
       DO UPDATE SET platform = EXCLUDED.platform, user_agent = EXCLUDED.user_agent, updated_at = CURRENT_TIMESTAMP`,
      [userId, token.trim(), devicePlatform, userAgent]
    );

    res.json({ message: 'Device registered successfully for push alerts', platform: devicePlatform });
  } catch (err) {
    console.error('Error registering device token:', err);
    res.status(500).json({ message: 'Server error registering device token' });
  }
};

// Unregister FCM Device Push Token
const unregisterDeviceToken = async (req, res) => {
  const { token } = req.body;
  const userId = req.user.id;

  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }

  try {
    await db.query(
      'DELETE FROM user_device_tokens WHERE user_id = $1 AND token = $2',
      [userId, token.trim()]
    );
    res.json({ message: 'Device token removed successfully' });
  } catch (err) {
    console.error('Error unregistering device token:', err);
    res.status(500).json({ message: 'Server error removing device token' });
  }
};

// Send a test push notification to user's device
const sendTestPush = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await sendPushToUser(userId, {
      title: 'Nova Eye Care 👁️',
      body: 'Test Push Alert: Your device is successfully linked to Nova Eye Care phone notifications!',
      data: { type: 'test' },
      url: '/dashboard'
    });

    res.json({ 
      message: 'Test notification sent to your registered device(s)',
      result
    });
  } catch (err) {
    console.error('Error sending test push:', err);
    res.status(500).json({ message: 'Failed to send test notification', error: err.message });
  }
};

const deleteNotification = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM notifications WHERE id = $1', [id]);
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).send('Server error');
  }
};

const clearNotifications = async (req, res) => {
  try {
    await db.query('DELETE FROM notifications');
    res.json({ message: 'All notifications cleared successfully' });
  } catch (err) {
    console.error('Error clearing notifications:', err);
    res.status(500).send('Server error');
  }
};

module.exports = { 
  getNotifications, 
  getAllNotifications, 
  markAsRead, 
  markAllAsRead, 
  createNotification,
  deleteNotification,
  clearNotifications,
  registerDeviceToken,
  unregisterDeviceToken,
  sendTestPush
};
