const db = require('../src/config/db');

async function run() {
  try {
    console.log("Checking columns in appointments table...");
    /** @type {any} */
    const cols = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'appointments'
    `);
    console.log("Columns:", cols.rows.map((r) => `${r.column_name} (${r.data_type})`));

    console.log("\nChecking cms_content table for team section...");
    /** @type {any} */
    const cms = await db.query(`
      SELECT content_json 
      FROM cms_content 
      WHERE section_key = 'team'
    `);
    if (cms.rows.length > 0) {
      console.log("Team CMS Content:", JSON.stringify(cms.rows[0].content_json, null, 2));
    } else {
      console.log("No team section found in cms_content.");
    }
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
