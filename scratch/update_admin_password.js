const db = require('../src/config/db');
const bcrypt = require('bcryptjs');

async function updatePassword() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Password123!', salt);
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [hashedPassword, 'admin@novaeyecare.com']
    );
    console.log('Admin password updated successfully to: Password123!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

updatePassword();
