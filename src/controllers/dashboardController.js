const db = require('../config/db');

const getAdminStats = async (req, res) => {
  const stats = {
    summary: {
      totalUsers: 0,
      totalAppointments: 0,
      pendingAppointments: 0,
      todayAppointments: 0,
      pendingReviews: 0
    },
    recentAppointments: [],
    statusStats: []
  };

  try {
    // Helper to run query and return count or 0
    const getCount = async (query, params = []) => {
      try {
        /** @type {any} */
        const result = await db.query(query, params);
        return parseInt(result.rows[0].count) || 0;
      } catch (err) {
        console.error(`Query failed: ${query}`, err.message);
        return 0;
      }
    };

    stats.summary.totalUsers = await getCount('SELECT COUNT(*) FROM profiles');
    stats.summary.totalAppointments = await getCount('SELECT COUNT(*) FROM appointments');
    stats.summary.pendingAppointments = await getCount("SELECT COUNT(*) FROM appointments WHERE status = 'pending'");
    
    const today = new Date().toISOString().split('T')[0];
    stats.summary.todayAppointments = await getCount('SELECT COUNT(*) FROM appointments WHERE appointment_date = $1', [today]);
    stats.summary.pendingReviews = await getCount('SELECT COUNT(*) FROM reviews WHERE approved = FALSE');
    
    // Recent appointments
    try {
      const recentRes = await db.query(`
        SELECT a.*, p.full_name as patient_name 
        FROM appointments a 
        LEFT JOIN profiles p ON a.user_id = p.id 
        ORDER BY a.created_at DESC LIMIT 5
      `);
      stats.recentAppointments = recentRes.rows;
    } catch (err) {
      console.error('Failed to fetch recent appointments:', err.message);
    }

    // Status breakdown
    try {
      const statusRes = await db.query('SELECT status, COUNT(*) FROM appointments GROUP BY status');
      stats.statusStats = statusRes.rows;
    } catch (err) {
      console.error('Failed to fetch status stats:', err.message);
    }

    // 1. Monthly Booking Trends
    try {
      const trendsRes = await db.query(`
        SELECT TO_CHAR(appointment_date, 'YYYY-MM') as period, COUNT(*)::int as count 
        FROM appointments 
        GROUP BY period 
        ORDER BY period ASC 
        LIMIT 6
      `);
      stats.bookingTrends = trendsRes.rows;
    } catch (err) {
      console.error('Failed to fetch booking trends:', err.message);
    }

    // 2. Service Breakdown
    try {
      const servicesRes = await db.query(`
        SELECT service, COUNT(*)::int as count 
        FROM appointments 
        GROUP BY service 
        ORDER BY count DESC
      `);
      stats.serviceStats = servicesRes.rows;
    } catch (err) {
      console.error('Failed to fetch service stats:', err.message);
    }

    // 3. Monthly Revenue
    try {
      const revenueRes = await db.query(`
        SELECT TO_CHAR(created_at, 'YYYY-MM') as period, SUM(amount)::float as revenue 
        FROM invoices 
        WHERE status = 'paid' 
        GROUP BY period 
        ORDER BY period ASC 
        LIMIT 6
      `);
      stats.revenueTrends = revenueRes.rows;
    } catch (err) {
      console.error('Failed to fetch revenue trends:', err.message);
    }

    // 4. Patient Demographics (Gender)
    try {
      const genderRes = await db.query(`
        SELECT COALESCE(gender, 'Unspecified') as label, COUNT(*)::int as count 
        FROM profiles 
        GROUP BY label
      `);
      stats.genderStats = genderRes.rows;
    } catch (err) {
      console.error('Failed to fetch gender stats:', err.message);
    }

    res.json(stats);
  } catch (err) {
    console.error('Dashboard Stats Error:', err);
    // Return what we have so far instead of crashing
    res.json(stats);
  }
};

const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. User's appointment summary
    /** @type {any} */
    const apptCount = await db.query('SELECT COUNT(*) FROM appointments WHERE user_id = $1', [userId]);
    
    // 2. Next upcoming appointment
    const nextAppt = await db.query(`
      SELECT * FROM appointments 
      WHERE user_id = $1 AND appointment_date >= CURRENT_DATE AND status = 'confirmed'
      ORDER BY appointment_date ASC, appointment_time ASC LIMIT 1
    `, [userId]);

    // 3. Most recent screening
    const recentScreening = await db.query(`
      SELECT * FROM eye_screenings 
      WHERE patient_id = $1 AND is_visible_to_patient = TRUE 
      ORDER BY screening_date DESC LIMIT 1
    `, [userId]);

    // 4. Recent notifications
    const notifications = await db.query(`
      SELECT * FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC LIMIT 5
    `, [userId]);

    res.json({
      totalAppointments: parseInt(apptCount.rows[0].count),
      nextAppointment: nextAppt.rows[0] || null,
      recentScreening: recentScreening.rows[0] || null,
      recentNotifications: notifications.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

module.exports = { getAdminStats, getUserStats };
