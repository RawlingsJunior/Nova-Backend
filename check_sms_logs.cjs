const db = require('./src/config/db');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const checkLogs = async () => {
  try {
    const apiKey = process.env.ARKESEL_API_KEY || 'MISSING';
    console.log('Current API Key in Env:', apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4));
    console.log('Sender ID in Env:', process.env.ARKESEL_SENDER_ID);

    const result = await db.query('SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 5');
    console.log('Last 5 SMS Logs:');
    console.log(JSON.stringify(result.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

checkLogs();
