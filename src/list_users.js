const db = require('./config/db');

async function run() {
  try {
    const usersRes = await db.query(`
      SELECT u.id, u.email, u.created_at, p.full_name, r.role
      FROM users u
      LEFT JOIN profiles p ON u.id = p.id
      LEFT JOIN user_roles r ON u.id = r.user_id
    `);
    console.log(JSON.stringify(usersRes.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
