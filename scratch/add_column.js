const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

neonConfig.webSocketConstructor = ws;

console.log('Altering appointments table to add column appointment_type...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000
});

async function run() {
  try {
    const client = await pool.connect();
    console.log('Connected!');

    await client.query(`
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_type TEXT DEFAULT 'in_person'
    `);
    console.log('Column appointment_type verified/added successfully!');

    // Read columns to verify
    const columnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'appointments'
    `);
    console.log('\nColumns of appointments:');
    columnsRes.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));

    client.release();
  } catch (err) {
    console.error('Failed to run query:', err);
  } finally {
    await pool.end();
  }
}

run();
