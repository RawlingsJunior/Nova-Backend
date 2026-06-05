const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const apiKey = 'YkpRaGlnUW1BQW5iTEFPVWhOaHQ';
const senderId = 'NovaCare'; // 8 chars

console.log('Testing Arkesel SMS V2 with Key:', apiKey);

const testSMS = async () => {
  try {
    const response = await axios.post('https://sms.arkesel.com/api/v2/sms/send', {
      recipients: ['233552945333'],
      sender: senderId,
      message: 'Test SMS V2'
    }, {
      headers: { 'api-key': apiKey },
      timeout: 10000
    });
    console.log('Response Status:', response.status);
    console.log('Response Data:', response.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
};

testSMS();
