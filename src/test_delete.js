const db = require('./config/db');

async function testDelete() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    const id = 'b709abf3-b2db-4349-a083-cf80938ffb32'; // Asomani Rawlings Junior
    
    console.log('Updating cms_content...');
    await client.query('UPDATE cms_content SET updated_by = NULL WHERE updated_by = $1', [id]);
    
    console.log('Updating eye_screenings...');
    await client.query('UPDATE eye_screenings SET screened_by = NULL WHERE screened_by = $1', [id]);
    
    console.log('Deleting from users...');
    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    console.log('Result:', result.rows);
    
    console.log('Rolling back...');
    await client.query('ROLLBACK');
    console.log('Test completed successfully (transaction rolled back).');
  } catch (err) {
    console.error('Test failed:', err);
    try {
      await client.query('ROLLBACK');
    } catch (e) {}
  } finally {
    client.release();
    process.exit();
  }
}

testDelete();
