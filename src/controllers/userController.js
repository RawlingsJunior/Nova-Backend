const db = require('../config/db');

const getProfile = async (req, res) => {
  const targetId = req.params.id || req.user.id;

  // Security: Only admins can view other profiles
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && targetId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized to view this profile' });
  }

  try {
    const userQuery = `
      SELECT p.id, p.full_name, p.phone, p.email, r.role, p.created_at
      FROM profiles p
      LEFT JOIN user_roles r ON p.id = r.user_id
      WHERE p.id = $1`;
    
    const user = await db.query(userQuery, [targetId]);
    
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(user.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const updateProfile = async (req, res) => {
  const { fullName, phone } = req.body;
  const targetId = req.params.id || req.user.id;

  // Security: Only admins or the owner can update
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && targetId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized to update this profile' });
  }

  try {
    const result = await db.query(
      `UPDATE profiles 
       SET full_name = $1, phone = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING id, full_name, email, phone`,
      [fullName, phone, targetId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id, p.full_name, p.email, p.phone, r.role, p.created_at,
        (SELECT COUNT(*) FROM appointments WHERE user_id = p.id) as appointment_count
      FROM profiles p
      LEFT JOIN user_roles r ON p.id = r.user_id
      ORDER BY p.created_at DESC`;
    
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

module.exports = { getProfile, updateProfile, getAllUsers };
