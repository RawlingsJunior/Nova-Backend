const db = require('./src/config/db');

async function migrate() {
  try {
    console.log('Starting migration to add missing profile columns...');
    await db.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS nationality TEXT,
      ADD COLUMN IF NOT EXISTS gender TEXT,
      ADD COLUMN IF NOT EXISTS date_of_birth TEXT,
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS blood_group TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
      ADD COLUMN IF NOT EXISTS registration_completed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS medical_history TEXT
    `);
    console.log('Migration successful: Profiles table updated.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
