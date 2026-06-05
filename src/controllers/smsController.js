const db = require('../config/db');
const { sendSMS } = require('../services/smsService');

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

// Send bulk SMS
const sendBulkSMS = async (req, res) => {
  const { message, recipients } = req.body; // recipients: 'all' or array of phone numbers

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    let phoneNumbers = [];

    if (recipients === 'all') {
      /** @type {any} */
      const result = await db.query('SELECT phone FROM profiles WHERE phone IS NOT NULL AND phone != \'\'');
      phoneNumbers = result.rows.map(r => r.phone);
    } else if (Array.isArray(recipients)) {
      phoneNumbers = recipients;
    } else {
      return res.status(400).json({ message: 'Invalid recipients' });
    }

    if (phoneNumbers.length === 0) {
      return res.status(400).json({ message: 'No recipients found' });
    }

    // Send SMS asynchronously to avoid blocking the response
    // In a production app, this should be a background job
    const sendPromises = phoneNumbers.map(phone => sendSMS(phone, message));
    
    // We don't await all of them if there are thousands, but for small lists it's fine
    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;

    res.json({ 
      message: `SMS batch processed. ${successCount}/${phoneNumbers.length} sent successfully.`,
      details: { total: phoneNumbers.length, success: successCount, failed: phoneNumbers.length - successCount }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
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

module.exports = { getSMSLogs, sendBulkSMS, getSMSStats };
