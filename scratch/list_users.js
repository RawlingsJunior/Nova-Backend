const db = require('../src/config/db');

async function listUsers() {
  try {
    const res = await db.query(`
      SELECT u.id, u.email, ur.role, p.full_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN profiles p ON u.id = p.id
      ORDER BY ur.role, u.email;
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listUsers();
