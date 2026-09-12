const db = require('../config/db');
const { sendSMS } = require('../services/smsService');
const { logAuditEvent } = require('../lib/auditLogger');

// Get SMS logs
const getSMSLogs = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send bulk SMS or targeted SMS
const sendBulkSMS = async (req, res) => {
  const { message, recipients } = req.body; // recipients: 'all' | 'registered' | 'pending_registration' | 'appointments' | array of phone numbers

  if (!message || !message.trim()) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    let phoneNumbers = [];

    if (recipients === 'all') {
      /** @type {any} */
      const result = await db.query("SELECT phone FROM profiles WHERE phone IS NOT NULL AND TRIM(phone) != ''");
      phoneNumbers = result.rows.map(r => r.phone);
    } else if (recipients === 'registered') {
      /** @type {any} */
      const result = await db.query("SELECT phone FROM profiles WHERE phone IS NOT NULL AND TRIM(phone) != '' AND registration_completed = TRUE");
      phoneNumbers = result.rows.map(r => r.phone);
    } else if (recipients === 'pending_registration') {
      /** @type {any} */
      const result = await db.query("SELECT phone FROM profiles WHERE phone IS NOT NULL AND TRIM(phone) != '' AND (registration_completed IS FALSE OR registration_completed IS NULL)");
      phoneNumbers = result.rows.map(r => r.phone);
    } else if (recipients === 'appointments') {
      /** @type {any} */
      const result = await db.query("SELECT DISTINCT phone FROM appointments WHERE phone IS NOT NULL AND TRIM(phone) != ''");
      phoneNumbers = result.rows.map(r => r.phone);
    } else if (Array.isArray(recipients)) {
      phoneNumbers = recipients;
    } else if (typeof recipients === 'string' && recipients.trim()) {
      // Single custom phone or comma-separated string
      phoneNumbers = recipients.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean);
    } else {
      return res.status(400).json({ message: 'Invalid recipients specification' });
    }

    // Clean, format and deduplicate
    phoneNumbers = [...new Set(phoneNumbers.map(p => String(p).trim()).filter(p => p.length >= 8))];

    if (phoneNumbers.length === 0) {
      return res.status(400).json({ message: 'No valid phone numbers found for the selected recipients' });
    }

    // Send SMS in controlled concurrent chunks of 25 to protect network sockets and provider rate limits at 5000+ scale
    const CHUNK_SIZE = 25;
    const results = [];
    for (let i = 0; i < phoneNumbers.length; i += CHUNK_SIZE) {
      const chunk = phoneNumbers.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(chunk.map(phone => sendSMS(phone, message.trim())));
      results.push(...chunkResults);
    }
    
    const successCount = results.filter(r => r.success).length;

    logAuditEvent({
      userId: req.user.id,
      action: 'SMS_BROADCAST',
      details: { total: phoneNumbers.length, success: successCount, recipientsType: typeof recipients === 'string' ? recipients : 'custom_list' },
      req
    });

    res.json({ 
      message: `SMS batch processed. ${successCount}/${phoneNumbers.length} delivered successfully.`,
      details: { total: phoneNumbers.length, success: successCount, failed: phoneNumbers.length - successCount }
    });
  } catch (err) {
    console.error('Error in sendBulkSMS:', err);
    res.status(500).json({ message: 'Server error while sending SMS' });
  }
};

// Get SMS statistics
const getSMSStats = async (req, res) => {
  try {
    /** @type {any} */
    const totalResult = await db.query('SELECT COUNT(*) FROM sms_logs');
    /** @type {any} */
    const sentResult = await db.query('SELECT COUNT(*) FROM sms_logs WHERE status = \'sent\'');
    /** @type {any} */
    const failedResult = await db.query('SELECT COUNT(*) FROM sms_logs WHERE status = \'failed\'');
    
    res.json({
      total: parseInt(totalResult.rows[0].count),
      sent: parseInt(sentResult.rows[0].count),
      failed: parseInt(failedResult.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete single SMS log
const deleteSMSLog = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM sms_logs WHERE id = $1', [id]);
    res.json({ message: 'SMS log deleted successfully' });
  } catch (err) {
    console.error('Error deleting SMS log:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Clear SMS logs (all or by status)
const clearSMSLogs = async (req, res) => {
  const { status } = req.query; // 'failed' | 'sent' | 'all'
  try {
    logAuditEvent({
      userId: req.user.id,
      action: 'SMS_LOGS_CLEARED',
      details: { filterStatus: status || 'all' },
      req
    });

    if (status === 'failed') {
      await db.query("DELETE FROM sms_logs WHERE status = 'failed'");
      return res.json({ message: 'All failed SMS logs cleared successfully' });
    } else if (status === 'sent') {
      await db.query("DELETE FROM sms_logs WHERE status = 'sent'");
      return res.json({ message: 'All delivered SMS logs cleared successfully' });
    } else {
      await db.query('DELETE FROM sms_logs');
      return res.json({ message: 'All SMS logs cleared successfully' });
    }
  } catch (err) {
    console.error('Error clearing SMS logs:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getSMSLogs, sendBulkSMS, getSMSStats, deleteSMSLog, clearSMSLogs };
