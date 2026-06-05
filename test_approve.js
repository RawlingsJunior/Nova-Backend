const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PMHgpS8h5WmB@ep-green-recipe-apyb6wiy.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const id = 'e2251695-6657-449e-8476-e6c867816fe4';
  const approved = true;
  try {
    console.log('Running UPDATE reviews...');
    const result = await pool.query(
      'UPDATE reviews SET approved = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [approved, id]
    );
    console.log('Result:', result.rows);
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await pool.end();
  }
}

run();
