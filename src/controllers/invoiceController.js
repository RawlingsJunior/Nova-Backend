const db = require('../config/db');

const getMyInvoices = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM invoices WHERE patient_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const getInvoicesByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await db.query(
      'SELECT * FROM invoices WHERE patient_id = $1 ORDER BY created_at DESC',
      [patientId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const createInvoice = async (req, res) => {
  const { patientId, amount, description } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO invoices (patient_id, amount, description) VALUES ($1, $2, $3) RETURNING *',
      [patientId, amount, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

module.exports = { getMyInvoices, getInvoicesByPatient, createInvoice };
