const db = require('../src/config/db');

async function getAdmins() {
  try {
    const res = await db.query(`
      SELECT * 
      FROM users u
      LEFT JOIN user_roles r ON u.id = r.user_id
      WHERE r.role = 'admin'
      LIMIT 5
    `);
    console.log('Admin users:', res.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

getAdmins();
