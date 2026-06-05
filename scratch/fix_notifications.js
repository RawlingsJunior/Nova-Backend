const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('Starting migration...');
    
    // 1. Fix notifications table
    await pool.query(`
      DO $$ 
      BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'patient_id') THEN
              ALTER TABLE notifications RENAME COLUMN patient_id TO user_id;
              RAISE NOTICE 'Renamed patient_id to user_id';
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'title') THEN
              ALTER TABLE notifications ADD COLUMN title TEXT;
              RAISE NOTICE 'Added title column';
          END IF;
      END $$;
    `);
    
    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
