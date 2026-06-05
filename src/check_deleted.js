const db = require('./config/db');

async function run() {
  try {
    const res = await db.query("SELECT * FROM users WHERE email='deletetest@example.com'");
    console.log('User rows matching deletetest@example.com:', res.rows.length);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
