const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function seedAdmin() {
  const email = 'admin@novaeyecare.com';
  const password = 'admin@novaeyecare';
  
  try {
    // 1. Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    // 2. Insert user
    console.log(`Checking if user ${email} exists...`);
    const userRes = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    
    let userId;
    if (userRes.rows.length === 0) {
      console.log('Creating new admin user...');
      const insertRes = await db.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, hash]
      );
      userId = insertRes.rows[0]['id'];
    } else {
      console.log('User already exists, updating password...');
      userId = userRes.rows[0]['id'];
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
    }
    
    // 3. Ensure profile exists
    const profileRes = await db.query('SELECT id FROM profiles WHERE id = $1', [userId]);
    if (profileRes.rows.length === 0) {
      console.log('Creating profile...');
      await db.query('INSERT INTO profiles (id, email, full_name) VALUES ($1, $2, $3)', [userId, email, 'Nova Administrator']);
    }
    
    // 4. Ensure admin role
    const roleRes = await db.query('SELECT id FROM user_roles WHERE user_id = $1 AND role = $2', [userId, 'admin']);
    if (roleRes.rows.length === 0) {
      console.log('Assigning admin role...');
      await db.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [userId, 'admin']);
    }
    
    console.log('Admin user seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seedAdmin();
