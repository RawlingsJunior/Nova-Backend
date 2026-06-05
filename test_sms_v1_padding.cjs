const axios = require('axios');

const testSMSV1 = async () => {
  const apiKey = 'VW1GQkZ0RW9tb2NEU0lXakhwbHE=';
  const senderId = 'NovaCare';
  const phone = '233552945333';
  const message = 'Test SMS V1 with padding';

  console.log('Testing Arkesel SMS V1 (with padding)');

  try {
    const url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${apiKey}&to=${phone}&from=${senderId}&sms=${encodeURIComponent(message)}`;
    const response = await axios.get(url);
    console.log('Response Status:', response.status);
    console.log('Response Data:', response.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
};

testSMSV1();
