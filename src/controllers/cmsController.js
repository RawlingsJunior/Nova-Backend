const db = require('../config/db');

// GET all CMS content
const getAllCMS = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM cms_content ORDER BY section_key');
    res.json(result.rows);
  } catch (err) {
    console.error('getAllCMS error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET a specific CMS section by section_key
const getCMSSection = async (req, res) => {
  const { section } = req.params;
  try {
    /** @type {any} */
    const result = await db.query(
      'SELECT * FROM cms_content WHERE section_key = $1',
      [section]
    );
    if (result.rows.length === 0) {
      // Return empty content rather than 404 — the frontend handles defaults
      return res.json({ section_key: section, content_json: {} });
    }
    // Return the content_json directly so frontend gets the data it expects
    res.json(result.rows[0].content_json || {});
  } catch (err) {
    console.error('getCMSSection error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT update a specific CMS section
const updateCMSSection = async (req, res) => {
  const { section } = req.params;
  const { contentJson } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO cms_content (section_key, content_json, updated_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (section_key) 
       DO UPDATE SET content_json = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [section, contentJson]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateCMSSection error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAllCMS, getCMSSection, updateCMSSection };
