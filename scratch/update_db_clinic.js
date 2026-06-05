const db = require('../src/config/db');

const clinicData = {
  name: "NOVA Eye Care Services",
  email: "info@novaeyecareservice.com",
  phone1: "+233544172089",
  phone2: "+233246613184",
  address: "GE20 Dolores St, AH-1192-8485, Kan Royal Filling Station, Abuakwa. GPS address: AH-1192-7988",
  mapQuery: "Kan Royal Filling Station Abuakwa",
  tagline: "See Better! Live Brighter!"
};

const hoursData = {
  "Monday": "8:00 AM",
  "Monday_to": "5:00 PM",
  "Tuesday": "8:00 AM",
  "Tuesday_to": "5:00 PM",
  "Wednesday": "8:00 AM",
  "Wednesday_to": "5:00 PM",
  "Thursday": "8:00 AM",
  "Thursday_to": "5:00 PM",
  "Friday": "8:00 AM",
  "Friday_to": "5:00 PM",
  "Saturday": "9:00 AM",
  "Saturday_to": "2:00 PM",
  "Sunday": "Closed"
};

async function runUpdate() {
  console.log('Connecting to database...');
  try {
    // 1. Seed/Update clinic info in cms_content
    console.log('Seeding clinic info...');
    await db.query(
      `INSERT INTO cms_content (section_key, content_json, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (section_key)
       DO UPDATE SET content_json = EXCLUDED.content_json, updated_at = CURRENT_TIMESTAMP`,
      ['clinic', clinicData]
    );
    console.log('✓ Seeding clinic info completed');

    // 2. Seed/Update working hours in cms_content
    console.log('Seeding working hours...');
    await db.query(
      `INSERT INTO cms_content (section_key, content_json, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (section_key)
       DO UPDATE SET content_json = EXCLUDED.content_json, updated_at = CURRENT_TIMESTAMP`,
      ['hours', hoursData]
    );
    console.log('✓ Seeding working hours completed');

    // 3. Update chatbot knowledge questions mentioning old phone numbers
    console.log('Updating chatbot knowledge phone numbers...');
    await db.query(
      `UPDATE chatbot_knowledge 
       SET answer = 'You can book directly on our website by visiting the Book page, or call us at +233544172089 / +233246613184.' 
       WHERE category = 'booking'`
    );
    console.log('✓ Chatbot knowledge updated');

    console.log('\nAll database updates ran successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Database update failed:', err);
    process.exit(1);
  }
}

runUpdate();
