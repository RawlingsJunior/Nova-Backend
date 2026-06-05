const express = require('express');
const router = express.Router();
const { getMyPrescriptions, getPrescriptionsByPatient, createPrescription } = require('../controllers/prescriptionController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/mine', authMiddleware, getMyPrescriptions);
router.get('/patient/:patientId', authMiddleware, adminMiddleware, getPrescriptionsByPatient);
router.post('/', authMiddleware, adminMiddleware, createPrescription);

module.exports = router;
