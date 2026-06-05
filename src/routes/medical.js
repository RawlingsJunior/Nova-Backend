const express = require('express');
const router = express.Router();
const { 
  getScreenings, createScreening, updateScreening, getMedicalHistory, updateMedicalHistory 
} = require('../controllers/medicalController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { validate, screeningValidation, medicalHistoryValidation } = require('../middleware/validation');

// Screenings
router.get('/screenings', authMiddleware, getScreenings);
router.get('/screenings/all', authMiddleware, adminMiddleware, getScreenings);
router.post('/screenings', authMiddleware, adminMiddleware, screeningValidation, validate, createScreening);
router.put('/screenings/:id', authMiddleware, adminMiddleware, screeningValidation, validate, updateScreening);

// Medical History
router.get('/history', authMiddleware, getMedicalHistory);
router.get('/history/:patientId', authMiddleware, adminMiddleware, getMedicalHistory);
router.post('/history', authMiddleware, medicalHistoryValidation, validate, updateMedicalHistory);
router.post('/history/:patientId', authMiddleware, adminMiddleware, medicalHistoryValidation, validate, updateMedicalHistory);

module.exports = router;
