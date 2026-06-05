const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

neonConfig.webSocketConstructor = ws;

console.log('Connecting to database via WebSockets to inspect columns...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000
});

async function run() {
  try {
    const client = await pool.connect();
    console.log('Connected!');

    // Check chatbot_knowledge columns
    const columnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chatbot_knowledge'
    `);
    console.log('\nColumns of chatbot_knowledge:');
    columnsRes.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));

    // Check profiles columns
    const profilesRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'profiles'
    `);
    console.log('\nColumns of profiles:');
    profilesRes.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));

    client.release();
  } catch (err) {
    console.error('Failed to query tables:', err);
  } finally {
    await pool.end();
  }
}

run();
