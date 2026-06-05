const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000
});

async function run() {
  try {
    const client = await pool.connect();
    console.log('Connected!');

    const tables = ['users', 'profiles', 'appointments', 'reviews', 'invoices'];
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`${table}: ${res.rows[0].count}`);
    }

    client.release();
  } catch (err) {
    console.error('Failed to query tables:', err);
  } finally {
    await pool.end();
  }
}

run();
