const db = require('../src/config/db');

async function checkCMS() {
  try {
    const result = await db.query('SELECT * FROM cms_content');
    console.log('CMS Content rows count:', result.rows.length);
    for (const row of result.rows) {
      console.log('Key:', row['section_key']);
      console.log('JSON:', JSON.stringify(row['content_json'], null, 2));
      console.log('---');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCMS();
