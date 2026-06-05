const db = require('../src/config/db');
async function check() {
  try {
    const r = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
check();
