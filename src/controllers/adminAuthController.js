const db = require('../config/db');
const { logAuditEvent } = require('../lib/auditLogger');

const getPendingAdmins = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM pending_admin_emails ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const addPendingAdmin = async (req, res) => {
  const { email } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO pending_admin_emails (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING *',
      [email]
    );
    logAuditEvent({
      userId: req.user.id,
      action: 'ADMIN_PENDING_EMAIL_ADDED',
      details: { email },
      req
    });
    res.status(201).json(result.rows[0] || { message: 'Email already in list' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const removePendingAdmin = async (req, res) => {
  const { email } = req.params;
  try {
    await db.query('DELETE FROM pending_admin_emails WHERE email = $1', [email]);
    logAuditEvent({
      userId: req.user.id,
      action: 'ADMIN_PENDING_EMAIL_REMOVED',
      details: { email },
      req
    });
    res.json({ message: 'Email removed from pending admins' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

module.exports = { getPendingAdmins, addPendingAdmin, removePendingAdmin };
