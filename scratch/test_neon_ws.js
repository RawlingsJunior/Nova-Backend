const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Configure Neon to use the 'ws' package for Node.js WebSockets
neonConfig.webSocketConstructor = ws;

console.log('Testing connection over WebSockets (port 443)...');
console.log('DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000
});

async function run() {
  const startTime = Date.now();
  try {
    const client = await pool.connect();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Connected successfully over WebSockets in ${duration}s!`);
    
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    client.release();
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`WebSocket connection failed after ${duration}s:`, err.message);
  } finally {
    await pool.end();
  }
}

run();
