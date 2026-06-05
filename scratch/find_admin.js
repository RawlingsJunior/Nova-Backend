const db = require('../src/config/db');

async function findAdmin() {
  try {
    const res = await db.query(`
      SELECT u.id, u.email, r.role
      FROM users u
      JOIN user_roles r ON u.id = r.user_id
      WHERE r.role = 'admin';
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findAdmin();
