const db = require('../src/config/db');

async function describeTables() {
  try {
    const tables = ['pending_admin_emails', 'sms_logs'];
    for (const table of tables) {
      const res = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1;
      `, [table]);
      console.log(`Table: ${table}`);
      console.log(res.rows);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

describeTables();
