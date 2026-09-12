const db = require('./config/db');
const bcrypt = require('bcryptjs');

const DEFAULT_ADMIN_EMAIL = 'admin@novaeyecare.com';
const DEFAULT_ADMIN_PASSWORD = 'admin@novaeyecare';
const DEFAULT_ADMIN_NAME = 'System Admin';

const initializeDatabase = async () => {
  console.log('Initializing database schema extensions...');
  try {
    // Add missing columns to clinic_settings
    await db.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinic_settings' AND column_name='social_instagram') THEN
          ALTER TABLE clinic_settings ADD COLUMN social_instagram TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinic_settings' AND column_name='social_facebook') THEN
          ALTER TABLE clinic_settings ADD COLUMN social_facebook TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinic_settings' AND column_name='social_twitter') THEN
          ALTER TABLE clinic_settings ADD COLUMN social_twitter TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinic_settings' AND column_name='announcement_title') THEN
          ALTER TABLE clinic_settings ADD COLUMN announcement_title TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinic_settings' AND column_name='announcement_body') THEN
          ALTER TABLE clinic_settings ADD COLUMN announcement_body TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinic_settings' AND column_name='show_announcement') THEN
          ALTER TABLE clinic_settings ADD COLUMN show_announcement BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinic_settings' AND column_name='maintenance_mode') THEN
          ALTER TABLE clinic_settings ADD COLUMN maintenance_mode BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinic_settings' AND column_name='chatbot_enabled') THEN
          ALTER TABLE clinic_settings ADD COLUMN chatbot_enabled BOOLEAN DEFAULT TRUE;
        END IF;
      END $$;
    `);

    // Add missing columns to appointments
    await db.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='status') THEN
          ALTER TABLE appointments ADD COLUMN status TEXT DEFAULT 'pending';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='appointment_type') THEN
          ALTER TABLE appointments ADD COLUMN appointment_type TEXT DEFAULT 'in_person';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='doctor_name') THEN
          ALTER TABLE appointments ADD COLUMN doctor_name TEXT;
        END IF;
      END $$;
    `);

    // Seed default team section in cms_content if not exists
    await db.query(`
      INSERT INTO cms_content (section_key, content_json)
      VALUES ('team', '{
        "members": [
          {
            "name": "Dr. Sylvester Kyeremeh",
            "title": "Lead Optometrist & Vision Specialist",
            "bio": "Dr. Sylvester Kyeremeh has extensive clinical optometry experience, specializing in pediatric eye care, advanced vision therapy, and premium ocular diagnostics.",
            "photo": ""
          },
          {
            "name": "Dr. Elizabeth Mana Akpakli",
            "title": "Senior Optometrist & Ocular Health Specialist",
            "bio": "Dr. Elizabeth Mana Akpakli is an expert in ocular disease diagnostics, low vision rehabilitation, and custom contact lens fittings.",
            "photo": ""
          }
        ]
      }')
      ON CONFLICT (section_key) DO NOTHING;
    `);

    // Ensure profiles table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        full_name TEXT,
        email TEXT,
        phone TEXT,
        nationality TEXT,
        gender TEXT,
        date_of_birth DATE,
        address TEXT,
        blood_group TEXT,
        region TEXT,
        medical_history TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        registration_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Alter table to add region if profiles already exists
    await db.query(`
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region TEXT;
    `);

    // Ensure sms_logs table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS sms_logs (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'sent',
        provider_response JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Security & lockout fields for brute-force attack prevention
    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
    `);

    // Audit logs table for tracking security events, role changes, lockouts, and logins
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        details JSONB,
        ip TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure high-performance indexes exist for 5000+ users scale
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(appointment_date, status);
      CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
      CREATE INDEX IF NOT EXISTS idx_profiles_reg_completed ON profiles(registration_completed);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_eye_screenings_patient ON eye_screenings(patient_id, screening_date DESC);
      CREATE INDEX IF NOT EXISTS idx_sms_logs_status_created ON sms_logs(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(approved, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_users_locked ON users(locked_until);
    `);

    // Ensure default Super Admin account exists with seeded credentials
    const adminClient = await db.pool.connect();
    try {
      await adminClient.query('BEGIN');

      /** @type {any} */
      const existingAdmin = await adminClient.query(
        'SELECT id FROM users WHERE email = $1 LIMIT 1',
        [DEFAULT_ADMIN_EMAIL]
      );

      const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      let adminUserId;

      if (existingAdmin.rows.length > 0) {
        adminUserId = existingAdmin.rows[0].id;
        await adminClient.query(
          'UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [passwordHash, adminUserId]
        );
      } else {
        /** @type {any} */
        const insertedAdmin = await adminClient.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
          [DEFAULT_ADMIN_EMAIL, passwordHash]
        );
        adminUserId = insertedAdmin.rows[0].id;
      }

      await adminClient.query(
        `INSERT INTO profiles (id, full_name, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           email = EXCLUDED.email,
           updated_at = CURRENT_TIMESTAMP`,
        [adminUserId, DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_EMAIL]
      );

      // Upgrade/Ensure Super Admin tier for overall boss
      await adminClient.query('DELETE FROM user_roles WHERE user_id = $1', [adminUserId]);
      await adminClient.query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, 'super_admin')`,
        [adminUserId]
      );

      await adminClient.query(
        `INSERT INTO pending_admin_emails (email)
         VALUES ($1)
         ON CONFLICT (email) DO NOTHING`,
        [DEFAULT_ADMIN_EMAIL]
      );

      await adminClient.query('COMMIT');
      console.log(`Default super admin ("overall boss") account seeded: ${DEFAULT_ADMIN_EMAIL}`);
    } catch (seedErr) {
      await adminClient.query('ROLLBACK');
      throw seedErr;
    } finally {
      adminClient.release();
    }

    console.log('Database initialization completed successfully');
  } catch (err) {
    console.error('Database initialization failed:', err.message);
  }
};

module.exports = initializeDatabase;
