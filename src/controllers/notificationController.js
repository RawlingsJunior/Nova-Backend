const db = require('../config/db');

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

const createNotification = async (userId, title, message, type = 'info') => {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [userId, title, message, type]
    );
  } catch (err) {
    console.error('Error creating notification:', err);
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
  clearNotifications
};
