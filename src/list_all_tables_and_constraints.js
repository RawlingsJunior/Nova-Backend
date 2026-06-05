require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. List all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    console.log('--- TABLES ---');
    console.log(tablesResult.rows.map(r => r.table_name).join(', '));

    // 2. List all foreign keys targeting users or profiles
    const fksResult = await client.query(`
      SELECT
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column,
        rc.delete_rule AS on_delete_action
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON rc.unique_constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY';
    `);
    
    console.log('\n--- FOREIGN KEYS TARGETING users OR profiles ---');
    console.table(fksResult.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
