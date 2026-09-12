const db = require('../config/db');
const { cache } = require('../lib/cache');
const logger = require('../lib/logger');

const getServices = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM services WHERE is_active = TRUE ORDER BY display_order ASC, name ASC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching active services', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not load services' });
  }
};

const getAllServices = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM services ORDER BY display_order ASC, name ASC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching all services', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not load services' });
  }
};

const createService = async (req, res) => {
  const { 
    name, 
    slug, 
    shortDescription, 
    fullDescription, 
    price, 
    durationMinutes, 
    imageUrl, 
    isActive, 
    displayOrder 
  } = req.body;

  try {
    /** @type {any} */
    const result = await db.query(
      'INSERT INTO services (name, slug, short_description, full_description, price, duration_minutes, image_url, is_active, display_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [
        name, 
        slug || name.toLowerCase().replace(/\s+/g, '-'), 
        shortDescription, 
        fullDescription, 
        price, 
        durationMinutes, 
        imageUrl, 
        isActive ?? true, 
        displayOrder ?? 0
      ]
    );

    // Invalidate cached services
    cache.delPrefix('services:');
    logger.audit('CREATE_SERVICE', { adminId: req.user?.id, serviceId: result.rows[0].id, name });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to create service', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create service' });
  }
};

const updateService = async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    slug, 
    shortDescription, 
    fullDescription, 
    price, 
    durationMinutes, 
    imageUrl, 
    isActive, 
    displayOrder 
  } = req.body;

  try {
    const result = await db.query(
      'UPDATE services SET name = $1, slug = $2, short_description = $3, full_description = $4, price = $5, duration_minutes = $6, image_url = $7, is_active = $8, display_order = $9 WHERE id = $10 RETURNING *',
      [
        name, 
        slug, 
        shortDescription, 
        fullDescription, 
        price, 
        durationMinutes, 
        imageUrl, 
        isActive, 
        displayOrder, 
        id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Invalidate cached services
    cache.delPrefix('services:');
    logger.audit('UPDATE_SERVICE', { adminId: req.user?.id, serviceId: id, name });
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to update service', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update service' });
  }
};

const deleteService = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM services WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Invalidate cached services
    cache.delPrefix('services:');
    logger.audit('DELETE_SERVICE', { adminId: req.user?.id, serviceId: id });

    res.json({ message: 'Service deleted successfully' });
  } catch (err) {
    logger.error('Failed to delete service', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete service' });
  }
};

const reorderServices = async (req, res) => {
  const { services } = req.body;
  try {
    await db.query('BEGIN');
    for (const service of services) {
      await db.query('UPDATE services SET display_order = $1 WHERE id = $2', [service.displayOrder, service.id]);
    }
    await db.query('COMMIT');

    cache.delPrefix('services:');
    logger.audit('REORDER_SERVICES', { adminId: req.user?.id, count: services?.length });

    res.json({ message: 'Services reordered successfully' });
  } catch (err) {
    await db.query('ROLLBACK');
    logger.error('Failed to reorder services', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to reorder services' });
  }
};

module.exports = { 
  getServices, 
  getAllServices, 
  createService, 
  updateService, 
  deleteService, 
  reorderServices 
};
