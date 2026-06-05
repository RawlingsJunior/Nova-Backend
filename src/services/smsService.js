/** @type {any} */
const axios = require('axios');
const db = require('../config/db');

const sendSMS = async (phoneNumber, message) => {
  const apiKey = process.env.ARKESEL_API_KEY;
  const senderId = process.env.ARKESEL_SENDER_ID || 'NovaCare';

  if (!apiKey || apiKey === 'your_arkesel_api_key' || !apiKey) {
    console.warn('[SMS] Arkesel API key not configured. SMS not sent.');
    return { success: false, message: 'API key missing' };
  }

  // 1. Clean and format phone number
  let cleanNumber = phoneNumber.replace(/\D/g, '');
  if (cleanNumber.startsWith('0') && cleanNumber.length === 10) {
    cleanNumber = '233' + cleanNumber.slice(1);
  }
  if (cleanNumber.length === 9 && !cleanNumber.startsWith('0')) {
    cleanNumber = '233' + cleanNumber;
  }

  try {
    // 2. Ensure Sender ID is alphanumeric and max 11 characters
    // Arkesel and most providers fail if there are spaces or special characters
    let finalSenderId = senderId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 11);
    if (!finalSenderId) finalSenderId = 'NovaCare';

    console.log(`[SMS] Attempting to send to ${cleanNumber} via Arkesel V2 (Sender: ${finalSenderId})...`);

    const response = await axios.post('https://sms.arkesel.com/api/v2/sms/send', {
      recipients: [cleanNumber],
      sender: finalSenderId,
      message: message,
    }, {
      headers: {
        'api-key': apiKey
      },
      timeout: 30000 
    });

    console.log(`[SMS] Arkesel Response:`, response.data);

    // Log to database
    try {
      await db.query(
        'INSERT INTO sms_logs (phone, message, status, provider_response) VALUES ($1, $2, $3, $4)',
        [cleanNumber, message, 'sent', JSON.stringify(response.data)]
      );
    } catch (dbErr) {
      console.error('[SMS] Failed to log SMS to database:', dbErr.message);
    }

    return { success: true, data: response.data };
  } catch (err) {
    const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error(`[SMS] Error sending via Arkesel: ${errorMsg}`);

    // Log failure to database
    try {
      await db.query(
        'INSERT INTO sms_logs (phone, message, status, provider_response) VALUES ($1, $2, $3, $4)',
        [cleanNumber, message, 'failed', JSON.stringify({ error: errorMsg })]
      );
    } catch (dbErr) {
      console.error('[SMS] Failed to log failed SMS to database:', dbErr.message);
    }

    return { success: false, error: errorMsg };
  }
};

module.exports = { sendSMS };
