/** @type {any} */
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.SMSONLINEGH_API_KEY || process.env.ARKESEL_API_KEY;
const senderId = process.env.SMSONLINEGH_SENDER_ID || process.env.ARKESEL_SENDER_ID || 'NovaCare';
const testRecipient = process.argv[2] || '233552945333';

console.log('--- Testing SMSOnlineGH v5 SMS ---');
console.log('Sender ID:', senderId);
console.log('Recipient:', testRecipient);
console.log('API Key configured:', apiKey ? `${apiKey.substring(0, 6)}...` : 'NONE');

if (!apiKey) {
  console.error('Error: Please configure SMSONLINEGH_API_KEY in backend/.env');
  process.exit(1);
}

const testSMS = async () => {
  try {
    let cleanNumber = testRecipient.replace(/\D/g, '');
    if (cleanNumber.startsWith('0') && cleanNumber.length === 10) {
      cleanNumber = '233' + cleanNumber.slice(1);
    }
    if (cleanNumber.length === 9 && !cleanNumber.startsWith('0')) {
      cleanNumber = '233' + cleanNumber;
    }

    const response = await axios.post(
      'https://api.smsonlinegh.com/v5/message/sms/send',
      {
        sender: senderId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 11),
        message: 'Test SMS from Nova Eye Care via SMSOnlineGH',
        recipients: [cleanNumber]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `key ${apiKey}`
        },
        timeout: 15000
      }
    );

    console.log('HTTP Status:', response.status);
    console.log('Response Body:', JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('Request failed:');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    } else {
      console.error(err.message);
    }
  }
};

testSMS();
