const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from the same folder
dotenv.config({ path: path.join(__dirname, '.env') });

// Use the key from the root .env which is also in Supabase functions
const apiKey = 'c295dW13QlBoU29QbURxZ0R4dGk';
const senderId = 'NOVA_EYE';

console.log('Testing Arkesel SMS V1 with Key:', apiKey);
console.log('Sender ID:', senderId);

const testSMS = async () => {
  try {
    const formattedTo = '233552945333';
    const msg = encodeURIComponent('Test SMS from Nova Eye Care system V1');
    const url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${apiKey}&to=${formattedTo}&from=${senderId}&sms=${msg}`;
    
    console.log('Testing URL:', url);
    const response = await axios.get(url);
    console.log('Response Status:', response.status);
    console.log('Response Data:', response.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
};

testSMS();
