const db = require('../src/config/db');

async function getProfile() {
  try {
    const res = await db.query(`
      SELECT u.id, u.email, p.phone, p.full_name
      FROM users u
      LEFT JOIN profiles p ON u.id = p.id
      WHERE u.email = 'asomanirawlingsjunior5333@gmail.com';
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

getProfile();
