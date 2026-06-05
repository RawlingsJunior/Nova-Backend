const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config({ override: true });

// Configure Neon to use WebSockets in Node.js (bypasses port 5432 blocking/firewalls)
neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000, // 30s connection timeout (Neon cold-starts can be slow)
  idleTimeoutMillis: 30000,       // 30s idle timeout
  max: 10                          // max pool size
});

pool.on('connect', () => {
  console.log('Successfully connected to the database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

