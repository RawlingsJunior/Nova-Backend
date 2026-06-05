const db = require('../src/config/db');
const bcrypt = require('bcryptjs');

async function testDelete() {
  const email = `testdelete_${Date.now()}@example.com`;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Password123!', salt);
    
    // Create user
    const newUser = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, hashedPassword]
    );
    const userId = newUser.rows[0].id;
    console.log('Created user with ID:', userId);

    // Create profile
    await client.query(
      'INSERT INTO profiles (id, full_name, email, phone) VALUES ($1, $2, $3, $4)',
      [userId, 'Test Delete User', email, '1234567890']
    );
    console.log('Created profile');

    // Create user role
    await client.query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
      [userId, 'user']
    );
    console.log('Created user role');

    // Create medical history
    await client.query(
      'INSERT INTO patient_medical_history (patient_id, ocular_history) VALUES ($1, $2)',
      [userId, 'None']
    );
    console.log('Created medical history');

    // Create appointment
    const appointmentRes = await client.query(
      `INSERT INTO appointments (user_id, full_name, phone, email, service, appointment_date, appointment_time, status)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, '10:00 AM', 'pending') RETURNING id`,
      [userId, 'Test Delete User', '1234567890', email, 'General Eye Exam']
    );
    const appointmentId = appointmentRes.rows[0].id;
    console.log('Created appointment with ID:', appointmentId);

    // Create eye screening
    await client.query(
      `INSERT INTO eye_screenings (patient_id, appointment_id, va_right_eye, va_left_eye)
       VALUES ($1, $2, '20/20', '20/20')`,
      [userId, appointmentId]
    );
    console.log('Created eye screening');

    // Create notification
    // Let's check what columns notifications table has. Let's try column "user_id" first as seen in find_foreign_keys.
    try {
      await client.query(
        `INSERT INTO notifications (user_id, message) VALUES ($1, $2)`,
        [userId, 'Welcome!']
      );
      console.log('Created notification with user_id');
    } catch (e) {
      console.log('Failed to create notification with user_id, trying patient_id:', e.message);
      await client.query(
        `INSERT INTO notifications (patient_id, message) VALUES ($1, $2)`,
        [userId, 'Welcome!']
      );
      console.log('Created notification with patient_id');
    }

    // Now try to delete this user using the same logic as profileController.deleteProfileAndUser
    console.log('Attempting delete...');
    await client.query('UPDATE cms_content SET updated_by = NULL WHERE updated_by = $1', [userId]);
    await client.query('UPDATE eye_screenings SET screened_by = NULL WHERE screened_by = $1', [userId]);

    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    console.log('Delete result rows:', result.rows);
    
    await client.query('COMMIT');
    console.log('Test completed successfully. User deleted!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Test failed with error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

testDelete();
