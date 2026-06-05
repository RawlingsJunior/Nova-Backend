const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, getAllUsers } = require('../controllers/userController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.get('/', authMiddleware, adminMiddleware, getAllUsers);

module.exports = router;
