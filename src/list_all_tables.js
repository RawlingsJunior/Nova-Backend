const db = require('./config/db');

async function run() {
  try {
    const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log(res.rows.map(r => r.table_name));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
