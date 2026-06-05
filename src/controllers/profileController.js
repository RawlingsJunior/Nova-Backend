const db = require('../config/db');

// GET own profile
const getMyProfile = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, ur.role, p.full_name as "fullName", p.phone, p.nationality, p.gender, 
              p.date_of_birth as "dateOfBirth", p.address, p.blood_group as "bloodGroup", p.region, 
              p.medical_history as "medicalHistory", p.emergency_contact_name as "emergencyContactName", 
              p.emergency_contact_phone as "emergencyContactPhone", p.registration_completed as "registrationCompleted"
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN profiles p ON u.id = p.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('getMyProfile error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT update own profile
const updateMyProfile = async (req, res) => {
  const full_name = req.body.full_name || req.body.fullName;
  const phone = req.body.phone;
  const nationality = req.body.nationality;
  const gender = req.body.gender;
  const date_of_birth = req.body.date_of_birth || req.body.dateOfBirth;
  const address = req.body.address;
  const blood_group = req.body.blood_group || req.body.bloodGroup;
  const region = req.body.region;
  const emergency_contact_name = req.body.emergency_contact_name || req.body.emergencyContactName;
  const emergency_contact_phone = req.body.emergency_contact_phone || req.body.emergencyContactPhone;
  const registration_completed = req.body.registration_completed !== undefined ? req.body.registration_completed : req.body.registrationCompleted;
  const medical_history = req.body.medical_history || req.body.medicalHistory;
  try {
    const result = await db.query(
      `UPDATE profiles SET 
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        nationality = COALESCE($3, nationality),
        gender = COALESCE($4, gender),
        date_of_birth = COALESCE($5, date_of_birth),
        address = COALESCE($6, address),
        blood_group = COALESCE($7, blood_group),
        region = COALESCE($8, region),
        emergency_contact_name = COALESCE($9, emergency_contact_name),
        emergency_contact_phone = COALESCE($10, emergency_contact_phone),
        registration_completed = COALESCE($11, registration_completed),
        medical_history = COALESCE($12, medical_history),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING *`,
      [full_name, phone, nationality, gender, date_of_birth, address, blood_group, region,
       emergency_contact_name, emergency_contact_phone, registration_completed, medical_history, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateMyProfile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: GET all profiles
const getAllProfiles = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, ur.role, u.email as user_email
       FROM profiles p
       LEFT JOIN user_roles ur ON p.id = ur.user_id
       LEFT JOIN users u ON p.id = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getAllProfiles error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: GET specific profile
const getProfileById = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, ur.role
       FROM profiles p
       LEFT JOIN user_roles ur ON p.id = ur.user_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getProfileById error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: PUT update specific profile
const updateProfileByAdmin = async (req, res) => {
  const full_name = req.body.full_name || req.body.fullName;
  const phone = req.body.phone;
  const nationality = req.body.nationality;
  const gender = req.body.gender;
  const date_of_birth = req.body.date_of_birth || req.body.dateOfBirth;
  const address = req.body.address;
  const blood_group = req.body.blood_group || req.body.bloodGroup;
  const region = req.body.region;
  const emergency_contact_name = req.body.emergency_contact_name || req.body.emergencyContactName;
  const emergency_contact_phone = req.body.emergency_contact_phone || req.body.emergencyContactPhone;
  const registration_completed = req.body.registration_completed !== undefined ? req.body.registration_completed : req.body.registrationCompleted;
  const medical_history = req.body.medical_history || req.body.medicalHistory;
  const role = req.body.role;

  try {
    const result = await db.query(
      `UPDATE profiles SET 
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        nationality = COALESCE($3, nationality),
        gender = COALESCE($4, gender),
        date_of_birth = COALESCE($5, date_of_birth),
        address = COALESCE($6, address),
        blood_group = COALESCE($7, blood_group),
        region = COALESCE($8, region),
        emergency_contact_name = COALESCE($9, emergency_contact_name),
        emergency_contact_phone = COALESCE($10, emergency_contact_phone),
        registration_completed = COALESCE($11, registration_completed),
        medical_history = COALESCE($12, medical_history),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING *`,
      [full_name, phone, nationality, gender, date_of_birth, address, blood_group, region,
       emergency_contact_name, emergency_contact_phone, registration_completed, medical_history, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    if (role) {
      await db.query('DELETE FROM user_roles WHERE user_id = $1', [req.params.id]);
      await db.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [req.params.id, role]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateProfileByAdmin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: DELETE user and profile
const deleteProfileAndUser = async (req, res) => {
  const { id } = req.params;
  try {
    if (id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own admin account.' });
    }

    await db.query('UPDATE cms_content SET updated_by = NULL WHERE updated_by = $1', [id]);
    await db.query('UPDATE eye_screenings SET screened_by = NULL WHERE screened_by = $1', [id]);

    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User and all related records deleted successfully' });
  } catch (err) {
    console.error('deleteProfileAndUser error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getMyProfile, getAllProfiles, getProfileById, updateMyProfile, updateProfileByAdmin, deleteProfileAndUser };
