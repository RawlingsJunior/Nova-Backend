const db = require('../config/db');
const { cache } = require('../lib/cache');
const logger = require('../lib/logger');

// GET clinic settings
const getSettings = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM clinic_settings LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({
        id: null,
        clinic_name: 'Nova Eye Care',
        contact_phone: '',
        address: '',
        opening_hours: '',
        maintenance_mode: false,
        show_announcement: false,
        announcement_title: '',
        announcement_body: '',
        chatbot_enabled: true
      });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('getSettings error', err);
    res.json({
      id: null,
      clinic_name: 'Nova Eye Care',
      maintenance_mode: false,
      show_announcement: false,
      chatbot_enabled: true
    });
  }
};

// PUT update clinic settings
const updateSettings = async (req, res) => {
  try {
    /** @type {any} */
    const existing = await db.query('SELECT id, maintenance_mode FROM clinic_settings LIMIT 1');
    /** @type {any} */
    let result;

    const reqMaint = req.body.maintenance_mode !== undefined ? req.body.maintenance_mode : req.body.maintenanceMode;
    if (reqMaint !== undefined && req.user?.role !== 'super_admin') {
      const currentMaint = existing.rows.length > 0 ? existing.rows[0].maintenance_mode : false;
      if (Boolean(reqMaint) !== Boolean(currentMaint)) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Only Super Administrators can toggle System Maintenance Mode.'
        });
      }
    }

    if (existing.rows.length === 0) {
      result = await db.query(
        `INSERT INTO clinic_settings (clinic_name, contact_phone, address, opening_hours,
         social_facebook, social_instagram, social_twitter,
         announcement_title, announcement_body, show_announcement, maintenance_mode, chatbot_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          req.body.clinic_name || req.body.clinicName || 'Nova Eye Care',
          req.body.contact_phone || req.body.contactPhone || '',
          req.body.address || '',
          req.body.opening_hours || req.body.openingHours || '',
          req.body.social_facebook || req.body.socialFacebook || '',
          req.body.social_instagram || req.body.socialInstagram || '',
          req.body.social_twitter || req.body.socialTwitter || '',
          req.body.announcement_title || req.body.announcementTitle || '',
          req.body.announcement_body || req.body.announcementBody || '',
          req.body.show_announcement || req.body.showAnnouncement || false,
          req.body.maintenance_mode || req.body.maintenanceMode || false,
          req.body.chatbot_enabled !== undefined ? req.body.chatbot_enabled : (req.body.chatbotEnabled !== undefined ? req.body.chatbotEnabled : true)
        ]
      );
    } else {
      result = await db.query(
        `UPDATE clinic_settings SET
          clinic_name = COALESCE($1, clinic_name),
          contact_phone = COALESCE($2, contact_phone),
          address = COALESCE($3, address),
          opening_hours = COALESCE($4, opening_hours),
          social_facebook = COALESCE($5, social_facebook),
          social_instagram = COALESCE($6, social_instagram),
          social_twitter = COALESCE($7, social_twitter),
          announcement_title = COALESCE($8, announcement_title),
          announcement_body = COALESCE($9, announcement_body),
          show_announcement = COALESCE($10, show_announcement),
          maintenance_mode = COALESCE($11, maintenance_mode),
          chatbot_enabled = COALESCE($12, chatbot_enabled),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $13
         RETURNING *`,
        [
          req.body.clinic_name || req.body.clinicName,
          req.body.contact_phone || req.body.contactPhone,
          req.body.address,
          req.body.opening_hours || req.body.openingHours,
          req.body.social_facebook || req.body.socialFacebook,
          req.body.social_instagram || req.body.socialInstagram,
          req.body.social_twitter || req.body.socialTwitter,
          req.body.announcement_title || req.body.announcementTitle,
          req.body.announcement_body || req.body.announcementBody,
          req.body.show_announcement !== undefined ? req.body.show_announcement : req.body.showAnnouncement,
          req.body.maintenance_mode !== undefined ? req.body.maintenance_mode : req.body.maintenanceMode,
          req.body.chatbot_enabled !== undefined ? req.body.chatbot_enabled : req.body.chatbotEnabled,
          existing.rows[0].id
        ]
      );
    }

    // Invalidate cached settings
    cache.delPrefix('settings:');
    logger.audit('UPDATE_CLINIC_SETTINGS', { adminId: req.user?.id, maintenanceMode: req.body.maintenance_mode });

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('updateSettings error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update settings' });
  }
};

module.exports = { getSettings, updateSettings };
