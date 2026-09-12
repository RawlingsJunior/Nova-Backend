const db = require('../config/db');
const { logAuditEvent } = require('../lib/auditLogger');

// Admin: get all reviews
const getReviews = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM reviews ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('getReviews error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public: get approved reviews only
const getApprovedReviews = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM reviews WHERE approved = TRUE ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getApprovedReviews error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const createReview = async (req, res) => {
  const { authorName, rating, content } = req.body;
  const userId = req.user ? req.user.id : null;

  try {
    /** @type {any} */
    const result = await db.query(
      'INSERT INTO reviews (user_id, author_name, rating, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, authorName, rating, content]
    );

    /** @type {any} */
    const newReview = result.rows[0];

    logAuditEvent({
      userId,
      action: 'REVIEW_SUBMITTED',
      details: { reviewId: newReview.id, authorName, rating },
      req
    });

    res.status(201).json(newReview);
  } catch (err) {
    console.error('createReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const approveReview = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const approved = body.approved !== undefined ? body.approved : true;

  try {
    const result = await db.query(
      'UPDATE reviews SET approved = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [approved, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('approveReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const unapproveReview = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const approved = body.approved !== undefined ? body.approved : false;

  try {
    const result = await db.query(
      'UPDATE reviews SET approved = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [approved, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('unapproveReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateReviewStatus = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const approved = body.approved !== undefined ? body.approved : false;

  try {
    const result = await db.query(
      'UPDATE reviews SET approved = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [approved, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    logAuditEvent({
      userId: req.user ? req.user.id : null,
      action: approved ? 'REVIEW_APPROVED' : 'REVIEW_REJECTED',
      details: { reviewId: id, approved },
      req
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateReviewStatus error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteReview = async (req, res) => {
  const { id } = req.params;

  try {
    /** @type {any} */
    const result = await db.query(
      'DELETE FROM reviews WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    /** @type {any} */
    const deletedReview = result.rows[0];

    logAuditEvent({
      userId: req.user ? req.user.id : null,
      action: 'REVIEW_DELETED',
      details: { reviewId: id, author: deletedReview.author_name },
      req
    });

    res.json({ message: 'Review deleted successfully', review: deletedReview });
  } catch (err) {
    console.error('deleteReview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { 
  getReviews, 
  getApprovedReviews, 
  createReview, 
  approveReview, 
  unapproveReview, 
  updateReviewStatus,
  deleteReview
};

