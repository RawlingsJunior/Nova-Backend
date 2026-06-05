const db = require('../src/config/db');

async function checkSchema() {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'appointments'
    `);
    console.table(result.rows);
  } catch (err) {
    console.error('Failed to check schema:', err.message);
  } finally {
    process.exit();
  }
}

checkSchema();
