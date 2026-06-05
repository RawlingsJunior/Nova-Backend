const db = require('../src/config/db');
async function check() {
  try {
    const res = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications'");
    console.log('Notifications columns:', res.rows.map((/** @type {any} */ r) => r.column_name));
    
    const res2 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles'");
    console.log('Profiles columns:', res2.rows.map((/** @type {any} */ r) => r.column_name));

    const res3 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log('Users columns:', res3.rows.map((/** @type {any} */ r) => r.column_name));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
