const db = require('../src/config/db');

async function describeAppointments() {
  try {
    const res = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'appointments';
    `);
    console.log(res.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

describeAppointments();
