/** @type {any} */
const axios = require('axios');
const db = require('../config/db');

const sendSMS = async (phoneNumber, message) => {
  const apiKey = process.env.SMSONLINEGH_API_KEY || process.env.ARKESEL_API_KEY;
  const senderId = process.env.SMSONLINEGH_SENDER_ID || process.env.ARKESEL_SENDER_ID || 'NovaCare';

  if (!apiKey || apiKey === 'your_smsonlinegh_api_key' || apiKey === 'your_arkesel_api_key') {
    console.warn('[SMS] SMSOnlineGH API key not configured. SMS not sent.');
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
    let finalSenderId = senderId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 11);
    if (!finalSenderId) finalSenderId = 'NovaCare';

    console.log(`[SMS] Attempting to send to ${cleanNumber} via SMSOnlineGH v5 (Sender: ${finalSenderId})...`);

    const response = await axios.post(
      'https://api.smsonlinegh.com/v5/message/sms/send',
      {
        sender: finalSenderId,
        text: message,
        type: 0,
        destinations: [cleanNumber],
        to: [cleanNumber],
        recipients: [cleanNumber]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `key ${apiKey}`
        },
        timeout: 30000 
      }
    );

    console.log(`[SMS] SMSOnlineGH Response:`, JSON.stringify(response.data));

    // SMSOnlineGH v5 returns { handshake: { id: 0, label: "HSHK_OK" }, data: { destinations: [...] } }
    const handshakeSuccess = response.data?.handshake ? response.data.handshake.id === 0 : true;
    const dest = response.data?.data?.destinations?.[0];
    const destStatus = dest?.status;
    const isDestRejected = destStatus && destStatus.label && destStatus.label.startsWith('DS_REJECTED');

    if (!handshakeSuccess || isDestRejected) {
      const errorMsg = isDestRejected 
        ? `${destStatus.label} (${destStatus.id})`
        : (response.data?.handshake?.label || 'SMS dispatch failed');
      
      console.error(`[SMS] SMSOnlineGH rejected message: ${errorMsg}`);

      try {
        await db.query(
          'INSERT INTO sms_logs (phone, message, status, provider_response) VALUES ($1, $2, $3, $4)',
          [cleanNumber, message, 'failed', JSON.stringify(response.data)]
        );
      } catch (dbErr) {
        console.error('[SMS] Failed to log failed SMS to database:', dbErr.message);
      }

      return { success: false, error: errorMsg, data: response.data };
    }

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
    console.error(`[SMS] Error sending via SMSOnlineGH: ${errorMsg}`);

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
