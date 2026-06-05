const axios = require('axios');

const testSMSV2 = async () => {
  const apiKey = 'VW1GQkZ0RW9tb2NEU0lXakhwbHE='; // Added padding
  const senderId = 'NovaCare';

  console.log('Testing Arkesel SMS V2 (with padding)');

  try {
    const response = await axios.post('https://sms.arkesel.com/api/v2/sms/send', {
      recipients: ['233552945333'],
      sender: senderId,
      message: 'Test SMS V2 Padding'
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

testSMSV2();
