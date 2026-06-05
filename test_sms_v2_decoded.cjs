const axios = require('axios');

const testSMSV2 = async () => {
  const apiKey = 'UMFBtEtomocDSIWjHplq'; // Decoded from Base64
  const senderId = 'NovaCare';

  console.log('Testing Arkesel SMS V2 (Decoded Key)');

  try {
    const response = await axios.post('https://sms.arkesel.com/api/v2/sms/send', {
      recipients: ['233552945333'],
      sender: senderId,
      message: 'Test SMS V2 Decoded'
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
