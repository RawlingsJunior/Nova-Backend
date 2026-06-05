const db = require('../src/config/db');

async function testDelete() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Get a user ID to test deleting (excluding the admin)
    const userRes = await client.query(
      `SELECT u.id, u.email, p.full_name 
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN profiles p ON u.id = p.id
       WHERE ur.role IS NULL OR ur.role != 'admin'
       LIMIT 1`
    );

    if (userRes.rows.length === 0) {
      console.log("No non-admin users found to test deletion.");
      await client.query('ROLLBACK');
      client.release();
      process.exit(0);
    }

    const testUser = userRes.rows[0];
    const userId = testUser.id;
    console.log(`Testing deletion of user: ${testUser.full_name} (${testUser.email}) with ID: ${userId}`);

    // Let's run the exact queries that the controller runs
    console.log("Updating cms_content...");
    await client.query('UPDATE cms_content SET updated_by = NULL WHERE updated_by = $1', [userId]);

    console.log("Updating eye_screenings...");
    await client.query('UPDATE eye_screenings SET screened_by = NULL WHERE screened_by = $1', [userId]);

    console.log("Deleting from users...");
    const delRes = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    console.log("Delete query completed. Rows affected:", delRes.rowCount);

    console.log("Success! Deletion would succeed without database errors.");
  } catch (err) {
    console.error("Error during deletion test (rolled back):", err);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    process.exit(0);
  }
}

testDelete();
