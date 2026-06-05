/** @type {any} */
const axios = require('axios');
require('dotenv').config({ path: 'Backend/.env' });

const testSMS = async () => {
  const apiKey = 'c295dW13QlBoU29QbURxZ0R4dGk';
  const senderId = 'NovaEye'; // Shorter sender ID
  const phoneNumber = '233544444444'; // Replace with a real number for testing if needed
  const message = 'Test from Nova Eye Care';

  console.log('Using API Key:', apiKey);
  console.log('Using Sender ID:', senderId);

  try {
    const response = await axios.post('https://sms.arkesel.com/api/v2/sms/send', {
      recipients: [phoneNumber],
      sender: senderId,
      message: message,
    }, {
      headers: {
        'api-key': apiKey
      }
    });
    console.log('Response:', response.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
};

testSMS();
