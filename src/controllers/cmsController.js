const db = require('../config/db');
const { cache } = require('../lib/cache');
const logger = require('../lib/logger');

// GET all CMS content
const getAllCMS = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM cms_content ORDER BY section_key');
    res.json(result.rows);
  } catch (err) {
    logger.error('getAllCMS error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not load CMS content' });
  }
};

// GET a specific CMS section by section_key
const getCMSSection = async (req, res) => {
  const { section } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM cms_content WHERE section_key = $1',
      [section]
    );
    if (result.rows.length === 0) {
      return res.json({ section_key: section, content_json: {} });
    }
    res.json(result.rows[0].content_json || {});
  } catch (err) {
    logger.error('getCMSSection error', err, { section });
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not load section' });
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

    // Purge cached CMS sections
    cache.delPrefix('cms:');
    logger.audit('UPDATE_CMS_SECTION', { adminId: req.user?.id, section });

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('updateCMSSection error', err, { section });
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not save CMS content' });
  }
};

module.exports = { getAllCMS, getCMSSection, updateCMSSection };
