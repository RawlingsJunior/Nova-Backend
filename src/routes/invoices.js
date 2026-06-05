const express = require('express');
const router = express.Router();
const { getMyInvoices, getInvoicesByPatient, createInvoice } = require('../controllers/invoiceController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/mine', authMiddleware, getMyInvoices);
router.get('/patient/:patientId', authMiddleware, adminMiddleware, getInvoicesByPatient);
router.post('/', authMiddleware, adminMiddleware, createInvoice);

module.exports = router;
