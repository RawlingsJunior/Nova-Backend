const db = require('../config/db');

const getMyPrescriptions = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY issued_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const getPrescriptionsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await db.query(
      'SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY issued_at DESC',
      [patientId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const createPrescription = async (req, res) => {
  const { patientId, doctorName, details } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO prescriptions (patient_id, doctor_name, prescription_details) VALUES ($1, $2, $3) RETURNING *',
      [patientId, doctorName, details]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

module.exports = { getMyPrescriptions, getPrescriptionsByPatient, createPrescription };
