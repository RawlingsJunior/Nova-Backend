const express = require('express');
const router = express.Router();
const { 
  getReviews, 
  getApprovedReviews, 
  createReview, 
  approveReview, 
  unapproveReview, 
  updateReviewStatus,
  deleteReview
} = require('../controllers/reviewController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Public: get approved reviews only
router.get('/approved', getApprovedReviews);

// Admin: get all reviews
router.get('/', authMiddleware, adminMiddleware, getReviews);

// Authenticated: create review
router.post('/', authMiddleware, createReview);

// Admin: approve/reject/delete review
router.patch('/:id/approve', authMiddleware, adminMiddleware, approveReview);
router.patch('/:id/unapprove', authMiddleware, adminMiddleware, unapproveReview);
router.put('/:id/status', authMiddleware, adminMiddleware, updateReviewStatus);
router.delete('/:id', authMiddleware, adminMiddleware, deleteReview);

module.exports = router;
