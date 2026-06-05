const db = require('./src/config/db');

async function checkData() {
  try {
    const userId = 'ac14dd32-5e13-457a-9d6f-1b6899bce6c2';
    const profile = await db.query('SELECT * FROM profiles WHERE id = $1', [userId]);
    console.log('Profile:', profile.rows);
    const role = await db.query('SELECT * FROM user_roles WHERE user_id = $1', [userId]);
    console.log('Role:', role.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
