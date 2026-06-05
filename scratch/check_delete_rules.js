const db = require('../src/config/db');

async function checkDeleteRules() {
  try {
    const res = await db.query(`
      SELECT 
        tc.table_name,
        rc.constraint_name,
        rc.delete_rule
      FROM 
        information_schema.referential_constraints rc
      JOIN 
        information_schema.table_constraints tc 
        ON rc.constraint_name = tc.constraint_name
      WHERE 
        rc.unique_constraint_name IN (
          SELECT constraint_name 
          FROM information_schema.table_constraints 
          WHERE table_name IN ('users', 'profiles')
        );
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDeleteRules();
