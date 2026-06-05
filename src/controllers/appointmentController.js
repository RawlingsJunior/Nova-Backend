const db = require('../config/db');
const { sendSMS } = require('../services/smsService');
const { sendEmail } = require('../services/emailService');
const { notifyAdmins } = require('../services/adminNotificationService');

const getAppointments = async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      query = `
        SELECT a.*, p.full_name as profile_name 
        FROM appointments a 
        LEFT JOIN profiles p ON a.user_id = p.id 
        ORDER BY a.appointment_date DESC, a.appointment_time DESC`;
    } else {
      query = `
        SELECT * FROM appointments 
        WHERE user_id = $1
        ORDER BY appointment_date DESC, appointment_time DESC`;
      params = [req.user.id];
    }

    /** @type {any} */
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const getAppointmentById = async (req, res) => {
  const { id } = req.params;
  try {
    /** @type {any} */
    const result = await db.query('SELECT * FROM appointments WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Appointment not found' });
    
    // Authorization check
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && result.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const createAppointment = async (req, res) => {
  const { fullName, phone, email, service, appointmentDate, appointmentTime, notes, appointmentType, doctorName } = req.body;
  const userId = req.user ? req.user.id : null;

  try {
    /** @type {any} */
    const newAppointment = await db.query(
      `INSERT INTO appointments 
      (user_id, full_name, phone, email, service, appointment_date, appointment_time, notes, appointment_type, doctor_name) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [userId, fullName, phone, email, service, appointmentDate, appointmentTime, notes, appointmentType || 'in_person', doctorName || null]
    );

    const appointment = newAppointment.rows[0];

    // Initial Confirmation Logic
    try {
      const formattedDate = new Date(appointmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const typeLabel = (appointmentType || 'in_person') === 'virtual' ? 'Virtual (Online Consultation)' : 'In-Person (Clinic Visit)';
      const doctorLabel = doctorName ? ` with ${doctorName}` : '';
      const message = `NOVA EYE CARE: Hello ${fullName}, your ${typeLabel} appointment${doctorLabel} for ${service} is booked for ${formattedDate} at ${appointmentTime}. Thank you for choosing us!`;
      
      // 1. In-App Notification
      if (userId) {
        await db.query(
          'INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)',
          [userId, 'appointment', 'Appointment Booked', message]
        );
      }

      // 2. Send SMS
      if (phone) await sendSMS(phone, message);
      
      // 3. Send Email
      if (email) await sendEmail({
        to: email,
        subject: 'Appointment Confirmation - Nova Eye Care',
        html: `
          <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 36px 30px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Appointment Booked!</h1>
              <p style="margin: 6px 0 0 0; font-size: 15px; color: #bfdbfe; font-weight: 500;">Thank you for scheduling with Nova Eye Care</p>
            </div>
            
            <div style="padding: 40px 30px; color: #334155; line-height: 1.6; font-size: 15px;">
              <p style="margin-top: 0;">Hello <strong style="color: #0f172a;">${fullName}</strong>,</p>
              <p>Your appointment has been successfully scheduled. Below are the details of your visit:</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Visit Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; width: 120px;">Service</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${service}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Date</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${appointmentDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Time</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${appointmentTime}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Type</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-transform: capitalize;">${appointmentType || 'In-Person'}</td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #fef3c7; border-left: 4px solid #d97706; border-radius: 4px; padding: 16px; margin: 24px 0; color: #92400e; font-size: 13px; font-weight: 500;">
                <strong style="display: block; margin-bottom: 4px;">Important Instructions:</strong>
                Please arrive at the clinic 10 minutes prior to your scheduled time. Remember to bring a valid ID and any optical prescriptions or reports.
              </div>

              <div style="text-align: center; margin: 32px 0 12px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none;">
                  Manage Your Bookings
                </a>
              </div>
            </div>

            <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 30px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Nova Eye Care Portal</p>
              <p style="margin: 0;">If you need to reschedule or cancel, please do so at least 24 hours in advance via the dashboard, or call us directly.</p>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: #94a3b8;">&copy; 2026 Nova Eye Care. All rights reserved.</p>
            </div>
          </div>
        `
      });
    } catch (notifyErr) {
      console.error('Notification failed:', notifyErr);
    }

    // Admin Notification for new booking
    notifyAdmins(
      'New Appointment Booking',
      `${fullName} has booked an appointment for ${service} on ${appointmentDate} at ${appointmentTime}.`,
      'booking'
    );

    res.status(201).json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const { appointmentDate, appointmentTime, service, notes, fullName, phone, email, status, appointmentType, doctorName } = req.body;

  try {
    // Retrieve pre-update appointment details
    const oldQuery = 'SELECT * FROM appointments WHERE id = $1';
    /** @type {any} */
    const oldResult = await db.query(oldQuery, [id]);
    if (oldResult.rows.length === 0) return res.status(404).json({ message: 'Appointment not found' });
    const oldAppointment = oldResult.rows[0];

    // Security: Check ownership
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && oldAppointment.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this appointment' });
    }
    
    /** @type {any} */
    const result = await db.query(
      `UPDATE appointments 
       SET appointment_date = $1, 
           appointment_time = $2, 
           service = $3, 
           notes = $4, 
           full_name = COALESCE($5, full_name),
           phone = COALESCE($6, phone),
           email = COALESCE($7, email),
           status = COALESCE($8, status),
           appointment_type = COALESCE($9, appointment_type),
           doctor_name = COALESCE($10, doctor_name),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $11 RETURNING *`,
      [appointmentDate, appointmentTime, service, notes, fullName, phone, email, status, appointmentType, doctorName, id]
    );

    const updatedAppointment = result.rows[0];

    // Notification logic for status updates or rescheduling
    try {
      const statusChanged = oldAppointment.status !== updatedAppointment.status;
      
      const oldDateStr = oldAppointment.appointment_date ? new Date(oldAppointment.appointment_date).toISOString().split('T')[0] : '';
      const newDateStr = updatedAppointment.appointment_date ? new Date(updatedAppointment.appointment_date).toISOString().split('T')[0] : '';
      const dateChanged = oldDateStr !== newDateStr;
      
      const oldTimeStr = oldAppointment.appointment_time ? oldAppointment.appointment_time.substring(0, 5) : '';
      const newTimeStr = updatedAppointment.appointment_time ? updatedAppointment.appointment_time.substring(0, 5) : '';
      const timeChanged = oldTimeStr !== newTimeStr;

      let statusMessage = '';
      const typeLabel = updatedAppointment.appointment_type === 'virtual' ? 'Virtual' : 'In-Person';
      const formattedDate = new Date(updatedAppointment.appointment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      
      let titleText = `Appointment Status Update: ${updatedAppointment.status.toUpperCase()}`;
      let statusColors = { gradient: 'linear-gradient(135deg, #475569 0%, #334155 100%)', title: 'Appointment Update' };

      if (statusChanged) {
        if (updatedAppointment.status === 'confirmed') {
          statusMessage = `Your ${typeLabel} appointment at Nova Eye Care on ${formattedDate} has been CONFIRMED.`;
          statusColors = { gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', title: 'Appointment Confirmed!' };
          titleText = 'Appointment Confirmed - Nova Eye Care';
        } else if (updatedAppointment.status === 'cancelled') {
          statusMessage = `Your ${typeLabel} appointment at Nova Eye Care on ${formattedDate} has been CANCELLED.`;
          statusColors = { gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', title: 'Appointment Cancelled' };
          titleText = 'Appointment Cancelled - Nova Eye Care';
        }
      } else if (updatedAppointment.status === 'confirmed' && (dateChanged || timeChanged)) {
        statusMessage = `Your ${typeLabel} appointment at Nova Eye Care has been rescheduled to ${formattedDate} at ${newTimeStr}.`;
        statusColors = { gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', title: 'Appointment Rescheduled!' };
        titleText = 'Appointment Rescheduled - Nova Eye Care';
      }

      if (statusMessage) {
        // 1. In-App Notification (if user_id exists)
        if (updatedAppointment.user_id) {
          await db.query(
            'INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)',
            [updatedAppointment.user_id, 'appointment', statusColors.title, statusMessage]
          );
        }

        // 2. Send SMS
        if (updatedAppointment.phone) await sendSMS(updatedAppointment.phone, statusMessage);
        
        // 3. Send Email
        if (updatedAppointment.email) await sendEmail({
          to: updatedAppointment.email,
          subject: titleText,
          html: `
            <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
              <div style="background: ${statusColors.gradient}; padding: 36px 30px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${statusColors.title}</h1>
                <p style="margin: 6px 0 0 0; font-size: 15px; opacity: 0.9; font-weight: 500;">Nova Eye Care Patient Portal</p>
              </div>
              
              <div style="padding: 40px 30px; color: #334155; line-height: 1.6; font-size: 15px;">
                <p style="margin-top: 0;">Hello <strong style="color: #0f172a;">${updatedAppointment.full_name || 'Patient'}</strong>,</p>
                <p>We want to inform you of a status update regarding your appointment:</p>
                
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
                  <h3 style="margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Appointment Details</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                      <td style="padding: 8px 0; color: #64748b; width: 120px;">Service</td>
                      <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${updatedAppointment.service}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Date</td>
                      <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${formattedDate}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Time</td>
                      <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${newTimeStr}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Status</td>
                      <td style="padding: 8px 0; font-weight: 700; color: ${updatedAppointment.status === 'confirmed' ? '#059669' : updatedAppointment.status === 'cancelled' ? '#dc2626' : '#475569'}; text-transform: uppercase; font-size: 13px;">${updatedAppointment.status}</td>
                    </tr>
                  </table>
                </div>

                <div style="text-align: center; margin: 32px 0 12px 0;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none;">
                    View Dashboard
                  </a>
                </div>
              </div>

              <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 30px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Nova Eye Care Portal</p>
                <p style="margin: 0;">If you have any questions or need to make further adjustments, please contact our support team or call us directly.</p>
                <p style="margin: 12px 0 0 0; font-size: 11px; color: #94a3b8;">&copy; 2026 Nova Eye Care. All rights reserved.</p>
              </div>
            </div>
          `
        });
      }
    } catch (notifyErr) {
      console.error('Status/Reschedule notification failed:', notifyErr);
    }

    res.json(updatedAppointment);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};


const updateAppointmentStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // pending, confirmed, cancelled, completed

  try {
    /** @type {any} */
    const result = await db.query(
      'UPDATE appointments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'Appointment not found' });
    
    /** @type {any} */
    const appointment = result.rows[0];

    // Status Change Notification Logic
    try {
      let statusMessage = '';
      const typeLabel = appointment.appointment_type === 'virtual' ? 'Virtual' : 'In-Person';
      if (status === 'confirmed') {
        statusMessage = `Your ${typeLabel} appointment at Nova Eye Care on ${appointment.appointment_date} has been CONFIRMED.`;
      } else if (status === 'cancelled') {
        statusMessage = `Your ${typeLabel} appointment at Nova Eye Care on ${appointment.appointment_date} has been CANCELLED.`;
      }

      if (statusMessage) {
        // 1. In-App Notification (if user_id exists)
        if (appointment.user_id) {
          await db.query(
            'INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)',
            [appointment.user_id, 'appointment', `Appointment ${status.toUpperCase()}`, statusMessage]
          );
        }

        // 2. Send SMS
        if (appointment.phone) await sendSMS(appointment.phone, statusMessage);
        
        // 3. Send Email
        const statusColors = status === 'confirmed' 
          ? { gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', title: 'Appointment Confirmed!' }
          : status === 'cancelled'
            ? { gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', title: 'Appointment Cancelled' }
            : { gradient: 'linear-gradient(135deg, #475569 0%, #334155 100%)', title: 'Appointment Update' };

        if (appointment.email) await sendEmail({
          to: appointment.email,
          subject: `Appointment Status Update: ${status.toUpperCase()}`,
          html: `
            <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
              <div style="background: ${statusColors.gradient}; padding: 36px 30px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${statusColors.title}</h1>
                <p style="margin: 6px 0 0 0; font-size: 15px; opacity: 0.9; font-weight: 500;">Nova Eye Care Patient Portal</p>
              </div>
              
              <div style="padding: 40px 30px; color: #334155; line-height: 1.6; font-size: 15px;">
                <p style="margin-top: 0;">Hello <strong style="color: #0f172a;">${appointment.full_name || 'Patient'}</strong>,</p>
                <p>We want to inform you of a status update regarding your appointment:</p>
                
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
                  <h3 style="margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Appointment Details</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                      <td style="padding: 8px 0; color: #64748b; width: 120px;">Service</td>
                      <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${appointment.service}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Date</td>
                      <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${appointment.appointment_date}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Time</td>
                      <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${appointment.appointment_time}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Status</td>
                      <td style="padding: 8px 0; font-weight: 700; color: ${status === 'confirmed' ? '#059669' : status === 'cancelled' ? '#dc2626' : '#475569'}; text-transform: uppercase; font-size: 13px;">${status}</td>
                    </tr>
                  </table>
                </div>

                <div style="text-align: center; margin: 32px 0 12px 0;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none;">
                    View Dashboard
                  </a>
                </div>
              </div>

              <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 30px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Nova Eye Care Portal</p>
                <p style="margin: 0;">If you have any questions or need to make further adjustments, please contact our support team or call us directly.</p>
                <p style="margin: 12px 0 0 0; font-size: 11px; color: #94a3b8;">&copy; 2026 Nova Eye Care. All rights reserved.</p>
              </div>
            </div>
          `
        });
      }
    } catch (notifyErr) {
      console.error('Status notification failed:', notifyErr);
    }

    res.json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const deleteAppointment = async (req, res) => {
  const { id } = req.params;
  try {
    // Security: Check ownership
    const checkQuery = 'SELECT user_id FROM appointments WHERE id = $1';
    /** @type {any} */
    const checkResult = await db.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) return res.status(404).json({ message: 'Appointment not found' });
    
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && checkResult.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this appointment' });
    }

    await db.query('DELETE FROM appointments WHERE id = $1', [id]);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const getAvailableSlots = async (req, res) => {
  const { date } = req.query; // YYYY-MM-DD
  if (!date) return res.status(400).json({ message: 'Date is required' });

  try {
    // Standard working hours: 09:00 to 17:00
    const allSlots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', 
      '15:00', '15:30', '16:00', '16:30'
    ];
    
    /** @type {any} */
    const bookedSlotsResult = await db.query(
      "SELECT appointment_time FROM appointments WHERE appointment_date = $1 AND status NOT IN ('cancelled')",
      [date]
    );

    const bookedSlots = bookedSlotsResult.rows.map((/** @type {any} */ row) => {
      // Normalize time to HH:MM
      return row.appointment_time.substring(0, 5);
    });

    const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

    res.json({ date, availableSlots });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

module.exports = { 
  getAppointments, 
  getAppointmentById, 
  createAppointment, 
  updateAppointment, 
  updateAppointmentStatus, 
  deleteAppointment,
  getAvailableSlots
};
