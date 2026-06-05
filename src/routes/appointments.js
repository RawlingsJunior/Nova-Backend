const express = require('express');
const router = express.Router();
const { 
  createAppointment, getAppointments, getAppointmentById, 
  updateAppointment, updateAppointmentStatus, deleteAppointment,
  getAvailableSlots 
} = require('../controllers/appointmentController');
const { authMiddleware, adminMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { validate, appointmentValidation } = require('../middleware/validation');

// @route   GET api/appointments/available-slots
// @desc    Get available slots for a date
router.get('/available-slots', getAvailableSlots);

// @route   POST api/appointments
// @desc    Book a new appointment (Open or Authenticated)
router.post('/', appointmentValidation, validate, optionalAuthMiddleware, createAppointment);

// @route   GET api/appointments
// @desc    Get all appointments (Admin) or user's appointments (User)
router.get('/', authMiddleware, getAppointments);

// @route   GET api/appointments/:id
// @desc    Get a single appointment
router.get('/:id', authMiddleware, getAppointmentById);

// @route   PUT api/appointments/:id
// @desc    Update an appointment
router.put('/:id', authMiddleware, appointmentValidation, validate, updateAppointment);

// @route   PATCH api/appointments/:id/status
// @desc    Update appointment status (Admin only)
router.patch('/:id/status', authMiddleware, adminMiddleware, updateAppointmentStatus);

// @route   DELETE api/appointments/:id
// @desc    Cancel/Delete an appointment
router.delete('/:id', authMiddleware, deleteAppointment);

module.exports = router;
