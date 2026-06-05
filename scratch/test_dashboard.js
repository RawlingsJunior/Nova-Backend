const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000
});

const { getAdminStats } = require('../src/controllers/dashboardController');

// Mock request / response objects
const req = {};
const res = {
  json: (data) => {
    console.log(JSON.stringify(data, null, 2));
    pool.end();
  },
  status: (code) => ({
    send: (msg) => {
      console.error(`Status ${code}: ${msg}`);
      pool.end();
    },
    json: (msg) => {
      console.error(`Status ${code}:`, msg);
      pool.end();
    }
  })
};

// Bind pool to db object in controller if needed
// Let's check how db is imported: const db = require('../config/db');
// It queries db.query or db.pool.connect
console.log('Fetching dashboard statistics from DB...');
getAdminStats(req, res);
