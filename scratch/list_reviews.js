const db = require('../src/config/db');

async function run() {
  try {
    const res = await db.query('SELECT * FROM reviews');
    console.log('Reviews:', res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
