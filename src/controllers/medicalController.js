const db = require('../config/db');

const getScreenings = async (req, res) => {
  try {
    let query;
    let params = [];
    const { patientId } = req.query;

    // Security: Non-admins can only see their own screenings
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      if (patientId && patientId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to view these screenings' });
      }
      
      query = `
        SELECT s.*, doc.full_name as doctor_name
        FROM eye_screenings s
        LEFT JOIN profiles doc ON s.screened_by = doc.id
        WHERE s.patient_id = $1 AND s.is_visible_to_patient = TRUE
        ORDER BY s.screening_date DESC`;
      params = [req.user.id];
    } else {
      // Admin View
      if (patientId) {
        query = `
          SELECT s.*, p.full_name as patient_name, doc.full_name as doctor_name
          FROM eye_screenings s
          JOIN profiles p ON s.patient_id = p.id
          LEFT JOIN profiles doc ON s.screened_by = doc.id
          WHERE s.patient_id = $1
          ORDER BY s.screening_date DESC`;
        params = [patientId];
      } else {
        query = `
          SELECT s.*, p.full_name as patient_name
          FROM eye_screenings s
          JOIN profiles p ON s.patient_id = p.id
          ORDER BY s.screening_date DESC`;
      }
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const createScreening = async (req, res) => {
  const { 
    patientId, appointmentId, vaRight, vaLeft, iopRight, iopLeft, 
    colourVision, contrast, externalExam, diagnosis, followup, isVisible 
  } = req.body;
  
  const screenedBy = req.user.id;

  try {
    const result = await db.query(
      `INSERT INTO eye_screenings 
      (patient_id, appointment_id, screened_by, va_right_eye, va_left_eye, iop_right, iop_left, 
       colour_vision_result, contrast_sensitivity, external_exam_notes, diagnosis, recommended_followup, is_visible_to_patient) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [patientId, appointmentId, screenedBy, vaRight, vaLeft, iopRight, iopLeft, 
       colourVision, contrast, externalExam, diagnosis, followup, isVisible]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const getMedicalHistory = async (req, res) => {
  const patientId = req.params.patientId || req.user.id;

  // Security check
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && patientId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized to view this medical history' });
  }

  try {
    const result = await db.query('SELECT * FROM patient_medical_history WHERE patient_id = $1', [patientId]);
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const updateMedicalHistory = async (req, res) => {
  const patientId = req.params.patientId || req.user.id;
  const { ocularHistory, systemicConditions, currentMedications, familyEyeHistory, allergies } = req.body;

  // Security check
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && patientId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized to update this medical history' });
  }

  try {
    const result = await db.query(
      `INSERT INTO patient_medical_history 
       (patient_id, ocular_history, systemic_conditions, current_medications, family_eye_history, allergies, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (patient_id) 
       DO UPDATE SET 
         ocular_history = $2, 
         systemic_conditions = $3, 
         current_medications = $4, 
         family_eye_history = $5, 
         allergies = $6, 
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [patientId, ocularHistory, systemicConditions, currentMedications, familyEyeHistory, allergies]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const updateScreening = async (req, res) => {
  const { id } = req.params;
  const { 
    patientId, appointmentId, vaRight, vaLeft, iopRight, iopLeft, 
    colourVision, contrast, externalExam, diagnosis, followup, isVisible 
  } = req.body;

  try {
    const result = await db.query(
      `UPDATE eye_screenings 
       SET patient_id = $1, appointment_id = $2, va_right_eye = $3, va_left_eye = $4, 
           iop_right = $5, iop_left = $6, colour_vision_result = $7, contrast_sensitivity = $8, 
           external_exam_notes = $9, diagnosis = $10, recommended_followup = $11, 
           is_visible_to_patient = $12
       WHERE id = $13 RETURNING *`,
      [patientId, appointmentId, vaRight, vaLeft, iopRight, iopLeft, 
       colourVision, contrast, externalExam, diagnosis, followup, isVisible, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Screening record not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

module.exports = { getScreenings, createScreening, updateScreening, getMedicalHistory, updateMedicalHistory };
