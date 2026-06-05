const db = require('../src/config/db');

async function checkServices() {
  try {
    const result = await db.query('SELECT id, slug, name, image_url FROM services');
    console.log('Services count:', result.rows.length);
    for (const row of result.rows) {
      console.log(`ID: ${row.id} | Slug: ${row.slug} | Name: ${row.name} | ImageUrl: ${row.image_url}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkServices();
