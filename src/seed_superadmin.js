const db = require('./config/db');
const bcrypt = require('bcryptjs');

const SUPER_ADMIN_EMAIL = 'superadmin@novaeyecare.com';
const SUPER_ADMIN_PASSWORD = 'novaeyecare';
const SUPER_ADMIN_NAME = 'Super Administrator';

async function seedSuperAdmin() {
  console.log(`Starting super admin seed for ${SUPER_ADMIN_EMAIL}...`);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if user already exists
    const existing = await client.query(
      'SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [SUPER_ADMIN_EMAIL]
    );

    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
    let userId;

    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      await client.query(
        `UPDATE users 
         SET password_hash = $1, 
             failed_login_attempts = 0, 
             locked_until = NULL, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [passwordHash, userId]
      );
      console.log(`Updated existing user ${SUPER_ADMIN_EMAIL} with new password.`);
    } else {
      const inserted = await client.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [SUPER_ADMIN_EMAIL, passwordHash]
      );
      userId = inserted.rows[0].id;
      console.log(`Created new user record for ${SUPER_ADMIN_EMAIL} (ID: ${userId}).`);
    }

    // 2. Ensure Profile exists
    await client.query(
      `INSERT INTO profiles (id, full_name, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         email = EXCLUDED.email,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL]
    );

    // 3. Assign super_admin role
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    await client.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'super_admin')`,
      [userId]
    );

    // 4. Ensure email is in pending_admin_emails whitelist
    await client.query(
      `INSERT INTO pending_admin_emails (email)
       VALUES ($1)
       ON CONFLICT (email) DO NOTHING`,
      [SUPER_ADMIN_EMAIL]
    );

    await client.query('COMMIT');
    console.log(`SUCCESS: ${SUPER_ADMIN_EMAIL} seeded with role 'super_admin' and password '${SUPER_ADMIN_PASSWORD}'!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('FAILED to seed super admin:', err);
  } finally {
    client.release();
    process.exit();
  }
}

seedSuperAdmin();
