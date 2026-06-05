const db = require('./src/config/db');

async function checkSchema() {
  try {
    const res = await db.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('profiles', 'user_roles', 'services', 'appointments')
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
