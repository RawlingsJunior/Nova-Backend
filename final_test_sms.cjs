const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load env from Backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

const testSMS = async () => {
  const apiKey = process.env.ARKESEL_API_KEY;
  const senderId = process.env.ARKESEL_SENDER_ID;

  console.log('Testing Arkesel SMS V2');
  console.log('API Key (masked):', apiKey ? apiKey.substring(0, 4) + '...' : 'MISSING');
  console.log('Sender ID:', senderId);

  if (!apiKey) {
    console.error('Error: ARKESEL_API_KEY is missing in .env');
    return;
  }

  try {
    const response = await axios.post('https://sms.arkesel.com/api/v2/sms/send', {
      recipients: ['233552945333'],
      sender: senderId,
      message: 'Test SMS from Nova Eye Care after fix'
    }, {
      headers: { 'api-key': apiKey },
      timeout: 30000
    });
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('Error Response:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
};

testSMS();
