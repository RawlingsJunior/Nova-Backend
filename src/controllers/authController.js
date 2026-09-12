const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
/** @type {any} */
const axios = require('axios');
const db = require('../config/db');
const { sendSMS } = require('../services/smsService');
const { sendEmail } = require('../services/emailService');
const { notifyAdmins } = require('../services/adminNotificationService');
const { logAuditEvent } = require('../lib/auditLogger');
const { getAuth, isConfigured: isFirebaseConfigured } = require('../config/firebase');

const register = async (req, res) => {
  const { 
    email, password, fullName, phone,
    nationality, gender, dateOfBirth, address, bloodGroup, region, emergencyContactName, emergencyContactPhone,
    ocularHistory, systemicConditions, currentMedications, familyEyeHistory, allergies,
    otp, otpToken
  } = req.body;

  // 0. Verify OTP
  if (!otpToken || !otp) {
    return res.status(400).json({ message: 'OTP verification is required' });
  }

  try {
    /** @type {any} */
    const decoded = jwt.verify(otpToken, process.env.JWT_SECRET || 'secret');
    if (decoded.email !== email) {
      return res.status(400).json({ message: 'OTP email does not match registration email' });
    }
    if (decoded.phone !== phone) {
      return res.status(400).json({ message: 'OTP phone number does not match registration phone number' });
    }
    if (decoded.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }
  } catch (err) {
    return res.status(400).json({ message: 'OTP verification expired or invalid. Please request a new one.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check if user exists
    const userExists = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'User already exists' });
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create user in 'users' table
    /** @type {any} */
    const newUser = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );
    const userId = newUser.rows[0].id;

    // 4. Create profile in 'profiles' table
    await client.query(
      `INSERT INTO profiles (
        id, full_name, email, phone, nationality, gender, date_of_birth, 
        address, blood_group, region, emergency_contact_name, emergency_contact_phone, registration_completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)`,
      [userId, fullName, email, phone, nationality, gender, dateOfBirth, address, bloodGroup, region, emergencyContactName, emergencyContactPhone]
    );

    // 5. Create medical history
    await client.query(
      `INSERT INTO patient_medical_history 
       (patient_id, ocular_history, systemic_conditions, current_medications, family_eye_history, allergies, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [userId, ocularHistory, systemicConditions, currentMedications, familyEyeHistory, allergies]
    );

    // 6. Assign role (Check if admin)
    /** @type {any} */
    const isAdminEmail = await client.query('SELECT * FROM pending_admin_emails WHERE email = $1', [email]);
    let role = 'user';
    if (isAdminEmail.rows.length > 0) {
      role = 'admin';
      await client.query('DELETE FROM pending_admin_emails WHERE email = $1', [email]);
    }

    await client.query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
      [userId, role]
    );

    await client.query('COMMIT');

    // Generate Token for auto-login after registration
    const payload = { id: userId, role: role };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

    // Notification Logic (Async)
    try {
      const message = `Welcome to Nova Eye Care, ${fullName}! Your account has been successfully created.`;
      if (phone) await sendSMS(phone, message);
      
      await sendEmail({
        to: email,
        subject: 'Welcome to Nova Eye Care',
        html: `
          <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px 30px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Welcome to Nova Eye Care!</h1>
              <p style="margin: 8px 0 0 0; font-size: 16px; color: #94a3b8; font-weight: 500;">Your portal to healthier, brighter vision</p>
            </div>
            
            <div style="padding: 40px 30px; color: #334155; line-height: 1.6; font-size: 15px;">
              <p style="margin-top: 0; font-size: 16px;">Hello <strong style="color: #0f172a;">${fullName}</strong>,</p>
              <p>Your account has been successfully created. We are excited to partner with you in managing your eye care and vision wellness.</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700;">Account Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 120px;">Email Address</td>
                    <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${email}</td>
                  </tr>
                </table>
              </div>

              <div style="margin: 32px 0;">
                <h3 style="margin: 0 0 16px 0; font-size: 15px; color: #0f172a; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; font-weight: 700;">What you can do next:</h3>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                  <tr>
                    <td style="vertical-align: top; width: 50px; padding-right: 14px;">
                      <div style="background-color: #eff6ff; color: #2563eb; border-radius: 8px; padding: 6px 0; width: 32px; height: 32px; text-align: center; font-weight: 800; font-size: 14px;">1</div>
                    </td>
                    <td>
                      <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #0f172a; font-weight: 700;">Book Appointments</h4>
                      <p style="margin: 0; font-size: 13px; color: #64748b;">Schedule comprehensive exams, general consults, or DVLA eye tests.</p>
                    </td>
                  </tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                  <tr>
                    <td style="vertical-align: top; width: 50px; padding-right: 14px;">
                      <div style="background-color: #eff6ff; color: #2563eb; border-radius: 8px; padding: 6px 0; width: 32px; height: 32px; text-align: center; font-weight: 800; font-size: 14px;">2</div>
                    </td>
                    <td>
                      <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #0f172a; font-weight: 700;">View Medical Records</h4>
                      <p style="margin: 0; font-size: 13px; color: #64748b;">Access your diagnostic reports, ocular history, and prescriptions securely.</p>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin: 36px 0 12px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                  Sign In to Patient Portal
                </a>
              </div>
            </div>

            <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 30px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Nova Eye Care Portal</p>
              <p style="margin: 0;">If you have any questions, please contact our support team or reply directly to this email.</p>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: #94a3b8;">&copy; 2026 Nova Eye Care. All rights reserved.</p>
            </div>
          </div>
        `
      });
    } catch (notifyErr) {
      console.error('Registration notification failed:', notifyErr);
    }

    // Admin Notification for new user
    notifyAdmins(
      'New User Registered',
      `${fullName} (${email}) has just created an account.`,
      'user_activity'
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        email: newUser.rows[0].email,
        fullName,
        role: role
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).send('Server error');
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Get user with lockout columns and their role
    const userQuery = `
      SELECT u.id, u.email, u.password_hash, u.failed_login_attempts, u.locked_until, r.role, p.full_name, p.phone
      FROM users u
      LEFT JOIN user_roles r ON u.id = r.user_id
      LEFT JOIN profiles p ON u.id = p.id
      WHERE u.email = $1`;
    
    /** @type {any} */
    const user = await db.query(userQuery, [email]);
    
    if (user.rows.length === 0) {
      logAuditEvent({
        action: 'LOGIN_FAILED_UNKNOWN_USER',
        details: { email },
        req
      });
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const userData = user.rows[0];

    // Check account lockout status
    if (userData.locked_until && new Date(userData.locked_until) > new Date()) {
      const remainingMinutes = Math.max(1, Math.ceil((new Date(userData.locked_until).getTime() - Date.now()) / 60000));
      logAuditEvent({
        userId: userData.id,
        action: 'LOGIN_BLOCKED_LOCKED',
        details: { email, remainingMinutes },
        req
      });
      return res.status(423).json({
        message: `Account is temporarily locked due to excessive failed attempts. Please try again in ${remainingMinutes} minute(s) or contact Nova Eye Care support.`
      });
    }

    const isMatch = await bcrypt.compare(password, userData.password_hash);
    if (!isMatch) {
      const currentAttempts = (userData.failed_login_attempts || 0) + 1;
      
      if (currentAttempts >= 5) {
        // Lock account for 15 minutes
        await db.query(
          `UPDATE users SET failed_login_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2`,
          [currentAttempts, userData.id]
        );
        logAuditEvent({
          userId: userData.id,
          action: 'ACCOUNT_LOCKED',
          details: { email, attempts: currentAttempts, lockDuration: '15 minutes' },
          req
        });
        return res.status(423).json({
          message: 'Account locked for 15 minutes due to 5 consecutive failed login attempts.'
        });
      } else {
        await db.query(
          `UPDATE users SET failed_login_attempts = $1 WHERE id = $2`,
          [currentAttempts, userData.id]
        );
        logAuditEvent({
          userId: userData.id,
          action: 'LOGIN_FAILED',
          details: { email, attempts: currentAttempts, attemptsRemaining: 5 - currentAttempts },
          req
        });
        const remaining = 5 - currentAttempts;
        return res.status(400).json({
          message: `Invalid credentials. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary account lockout)`
        });
      }
    }

    // Reset failed login attempts and unlock upon successful verification
    if (userData.failed_login_attempts > 0 || userData.locked_until) {
      await db.query(
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
        [userData.id]
      );
    }

    logAuditEvent({
      userId: userData.id,
      action: 'LOGIN_SUCCESS',
      details: { email: userData.email, role: userData.role },
      req
    });

    const payload = {
      id: userData.id,
      role: userData.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

    // Admin Notification for user login
    notifyAdmins(
      'User Login',
      `${userData.full_name || email} has logged in.`,
      'user_activity'
    );

    res.json({
      token,
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        fullName: userData.full_name,
        phone: userData.phone
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const getMe = async (req, res) => {
  try {
    const userQuery = `
      SELECT u.id, u.email, r.role, p.full_name, p.phone
      FROM users u
      LEFT JOIN user_roles r ON u.id = r.user_id
      LEFT JOIN profiles p ON u.id = p.id
      WHERE u.id = $1`;
    
    /** @type {any} */
    const user = await db.query(userQuery, [req.user.id]);
    
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.rows[0].id,
      email: user.rows[0].email,
      role: user.rows[0].role,
      fullName: user.rows[0].full_name,
      phone: user.rows[0].phone
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const adminCreateUser = async (req, res) => {
  const { 
    email, password, fullName, phone, role,
    nationality, gender, dateOfBirth, address, bloodGroup, region, emergencyContactName, emergencyContactPhone,
    ocularHistory, systemicConditions, currentMedications, familyEyeHistory, allergies
  } = req.body;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check if user exists
    const userExists = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'User already exists' });
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || '123456', salt);

    // 3. Create user in 'users' table
    /** @type {any} */
    const newUser = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );
    const userId = newUser.rows[0].id;

    // 4. Create profile in 'profiles' table
    await client.query(
      `INSERT INTO profiles (
        id, full_name, email, phone, nationality, gender, date_of_birth, 
        address, blood_group, region, emergency_contact_name, emergency_contact_phone, registration_completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)`,
      [userId, fullName, email, phone, nationality, gender, dateOfBirth, address, bloodGroup, region, emergencyContactName, emergencyContactPhone]
    );

    // 5. Create medical history
    await client.query(
      `INSERT INTO patient_medical_history 
       (patient_id, ocular_history, systemic_conditions, current_medications, family_eye_history, allergies, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [userId, ocularHistory || '', systemicConditions || '', currentMedications || '', familyEyeHistory || '', allergies || '']
    );

    // 6. Assign role with Super Admin privilege protection
    const assignedRole = role || 'user';
    if ((assignedRole === 'admin' || assignedRole === 'super_admin') && req.user.role !== 'super_admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Access denied: Only Super Admin can create administrator accounts.' });
    }

    await client.query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
      [userId, assignedRole]
    );

    await client.query('COMMIT');

    logAuditEvent({
      userId: req.user.id,
      action: 'ADMIN_USER_CREATED',
      details: { targetUserId: userId, email, role: assignedRole },
      req
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: userId,
        email: email,
        fullName,
        role: assignedRole
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).send('Server error');
  } finally {
    client.release();
  }
};

const adminResetPassword = async (req, res) => {
  const { userId, newPassword } = req.body;

  try {
    const userQuery = 'SELECT id FROM users WHERE id = $1';
    const userExists = await db.query(userQuery, [userId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Role protection: Only super_admin can reset super_admin or admin passwords
    /** @type {any} */
    const targetRoleRes = await db.query('SELECT role FROM user_roles WHERE user_id = $1', [userId]);
    const targetRole = targetRoleRes.rows[0]?.role;

    if (targetRole === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied: Only Super Admin can reset Super Admin passwords.' });
    }
    if (targetRole === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied: Only Super Admin can reset Administrator passwords.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear any lockout status
    await db.query(
      'UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, userId]
    );

    logAuditEvent({
      userId: req.user.id,
      action: 'ADMIN_PASSWORD_RESET',
      details: { targetUserId: userId, targetRole },
      req
    });

    res.json({ message: 'Password reset successfully and account unlocked' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;
  if (!newPassword || !passwordRegex.test(newPassword)) {
    return res.status(400).json({ 
      message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character' 
    });
  }

  try {
    const userQuery = 'SELECT password_hash FROM users WHERE id = $1';
    /** @type {any} */
    const user = await db.query(userQuery, [req.user.id]);
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

const getCaptcha = (req, res) => {
  try {
    const num1 = Math.floor(Math.random() * 9) + 1; // 1 to 9
    const num2 = Math.floor(Math.random() * 9) + 1; // 1 to 9
    const answer = num1 + num2;
    
    // Sign the answer, expires in 5 minutes
    const captchaToken = jwt.sign(
      { answer }, 
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '5m' }
    );
    
    res.json({
      question: `What is ${num1} + ${num2}?`,
      captchaToken
    });
  } catch (err) {
    console.error('getCaptcha error:', err);
    res.status(500).json({ message: 'Error generating captcha' });
  }
};

const sendOtp = async (req, res) => {
  const { email, phone, captchaToken, captchaAnswer, channel } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  // 1. Verify captcha bypassed


  // 2. Check if user already exists
  try {
    const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    /** @type {any} */
    const phoneExists = await db.query('SELECT * FROM profiles WHERE phone = $1', [phone]);
    if (phoneExists.rows.length > 0) {
      return res.status(400).json({ message: 'Phone number is already registered' });
    }
  } catch (err) {
    console.error('Check user error:', err);
    return res.status(500).json({ message: 'Server error' });
  }

  // 3. Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`[OTP] Generated OTP for ${phone} (${email}): ${otp}`);

  // 4. Send OTP via SMS alone
  const message = `Your Nova Eye Care OTP verification code is: ${otp}. It is valid for 10 minutes.`;
  const smsResult = await sendSMS(phone, message);

  if (!smsResult.success) {
    console.error('Send OTP SMS error:', smsResult.error || smsResult.message);
    const friendlyError = smsResult.error?.includes('DS_REJECTED_SENDER')
      ? 'SMS Sender ID is awaiting registration/approval on SMSOnlineGH. Please check your SMS provider.'
      : (smsResult.error || smsResult.message || 'Failed to deliver SMS verification code');
    return res.status(400).json({ 
      message: friendlyError,
      error: smsResult.error
    });
  }

  // 5. Create signed OTP token
  const otpToken = jwt.sign(
    { email, phone, otp },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '10m' }
  );

  res.json({
    message: 'OTP sent via SMS successfully',
    otpToken,
    sentViaSMS: true,
    sentViaEmail: false
  });
};

const sendResetOtp = async (req, res) => {
  const { identifier } = req.body;

  if (!identifier) {
    return res.status(400).json({ message: 'Email or phone number is required' });
  }

  try {
    const isEmail = identifier.includes('@');
    let userQuery = '';
    let queryParams = [identifier.trim()];

    if (isEmail) {
      userQuery = `
        SELECT u.id, u.email, p.phone, p.full_name
        FROM users u
        LEFT JOIN profiles p ON u.id = p.id
        WHERE u.email = $1`;
    } else {
      const cleanPhone = identifier.replace(/\D/g, '');
      const shortPhone = cleanPhone.length >= 9 ? cleanPhone.slice(-9) : cleanPhone;
      userQuery = `
        SELECT u.id, u.email, p.phone, p.full_name
        FROM users u
        LEFT JOIN profiles p ON u.id = p.id
        WHERE p.phone LIKE $1 OR p.phone = $2`;
      queryParams = [`%${shortPhone}`, identifier.trim()];
    }

    /** @type {any} */
    const userResult = await db.query(userQuery, queryParams);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'No account found with this email or phone number' });
    }

    const user = userResult.rows[0];
    const email = user.email;
    const phone = user.phone;
    const fullName = user.full_name || 'Nova Eye Care User';

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[Reset OTP] Generated Reset OTP for ${email}/${phone || 'no-phone'}: ${otp}`);

    let sentViaSMS = false;
    let sentViaEmail = false;
    let smsError = null;
    let emailError = null;

    if (phone) {
      try {
        const smsMessage = `Your Nova Eye Care password reset code is: ${otp}. It is valid for 10 minutes.`;
        const smsResult = await sendSMS(phone, smsMessage);
        if (smsResult.success) {
          sentViaSMS = true;
        } else {
          smsError = smsResult.error || 'Failed to send SMS';
        }
      } catch (err) {
        smsError = err.message;
        console.error('[Reset OTP] Send SMS error:', err);
      }
    }

    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: 'Your Nova Eye Care Password Reset Code',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
              <h2 style="color: #0070f3; text-align: center;">Nova Eye Care Portal</h2>
              <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
              <p>Hello <strong>${fullName}</strong>,</p>
              <p>You requested a One-Time Password (OTP) verification code to reset your Nova Eye Care account password.</p>
              <p>Please use the verification code below:</p>
              <div style="background-color: #f0f7ff; border: 1px dashed #0070f3; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #0070f3; margin: 20px 0; border-radius: 4px;">
                ${otp}
              </div>
              <p style="font-size: 13px; color: #666;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
          `
        });
        sentViaEmail = true;
      } catch (err) {
        emailError = err.message;
        console.error('[Reset OTP] Send Email error:', err);
      }
    }

    if (!sentViaEmail && !sentViaSMS) {
      return res.status(500).json({ 
        message: 'Failed to deliver OTP verification code via Email or SMS',
        errors: { sms: smsError, email: emailError }
      });
    }

    const resetOtpToken = jwt.sign(
      { userId: user.id, email, phone, otp },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '10m' }
    );

    const responsePayload = {
      message: 'OTP sent successfully',
      resetOtpToken,
      sentViaEmail,
      sentViaSMS
    };

    res.json(responsePayload);
  } catch (err) {
    console.error('sendResetOtp error:', err);
    res.status(500).json({ message: 'Server error occurred' });
  }
};

const verifyResetOtp = async (req, res) => {
  const { resetOtpToken, otp } = req.body;

  if (!resetOtpToken || !otp) {
    return res.status(400).json({ message: 'Token and OTP are required' });
  }

  try {
    /** @type {any} */
    const decoded = jwt.verify(resetOtpToken, process.env.JWT_SECRET || 'secret');
    if (decoded.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    console.error('verifyResetOtp error:', err);
    res.status(400).json({ message: 'OTP code expired or invalid. Please request a new one.' });
  }
};

const resetPassword = async (req, res) => {
  const { resetOtpToken, otp, newPassword } = req.body;

  if (!resetOtpToken || !otp || !newPassword) {
    return res.status(400).json({ message: 'Token, OTP, and new password are required' });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ 
      message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character' 
    });
  }

  try {
    /** @type {any} */
    const decoded = jwt.verify(resetOtpToken, process.env.JWT_SECRET || 'secret');
    if (decoded.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, decoded.userId]);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(400).json({ message: 'OTP code expired or invalid. Please request a new one.' });
  }
};

const googleLogin = async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ message: 'Google ID token is required' });
  }

  try {
    let email;
    let fullName;

    // 1. Attempt verification via Firebase Admin SDK
    let firebaseVerified = false;
    if (isFirebaseConfigured()) {
      try {
        const auth = getAuth();
        if (auth) {
          const decoded = await auth.verifyIdToken(idToken);
          if (decoded && decoded.email) {
            email = decoded.email.toLowerCase().trim();
            fullName = decoded.name || decoded.displayName || 'Nova Patient';
            firebaseVerified = true;
            console.log(`[Google Auth - Firebase] Verified token for ${email}`);
          }
        }
      } catch (fbErr) {
        console.warn('[Google Auth - Firebase] ID token verify error, falling back to Google tokeninfo:', fbErr.message);
      }
    }

    // 2. Fallback to Google OAuth tokeninfo endpoint
    if (!firebaseVerified) {
      try {
        const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
        const verifyResponse = await axios.get(googleVerifyUrl);
        const payload = verifyResponse.data;

        const expectedClientId = process.env.GOOGLE_CLIENT_ID;
        if (expectedClientId && expectedClientId !== 'your_google_client_id_here' && payload.aud !== expectedClientId) {
          console.warn(`[Google Auth] Audience mismatch: expected ${expectedClientId}, got ${payload.aud}`);
        }

        if (!payload.email) {
          return res.status(400).json({ message: 'Invalid token payload: Email missing' });
        }

        email = payload.email.toLowerCase().trim();
        fullName = payload.name || 'Nova Patient';
      } catch (gErr) {
        console.error('[Google Auth] Verification failed on both Firebase and Google endpoints:', gErr.message);
        return res.status(401).json({ message: 'Google authentication failed or token expired' });
      }
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Check if user exists in the database
      const userQuery = `
        SELECT u.id, u.email, r.role, p.full_name
        FROM users u
        LEFT JOIN user_roles r ON u.id = r.user_id
        LEFT JOIN profiles p ON u.id = p.id
        WHERE u.email = $1`;
      const userResult = await client.query(userQuery, [email]);
      
      let userId;
      let role = 'user';
      let nameToUse = fullName;

      if (userResult.rows.length > 0) {
        // User exists, log them in
        userId = userResult.rows[0].id;
        role = userResult.rows[0].role || 'user';
        nameToUse = userResult.rows[0].full_name || fullName;
      } else {
        // User doesn't exist, create a new patient account automatically!
        // Generate a random password hash since they log in via Google
        const salt = await bcrypt.genSalt(10);
        const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const hashedPassword = await bcrypt.hash(randomPassword, salt);

        // Create user in 'users' table
        const newUser = await client.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
          [email, hashedPassword]
        );
        userId = newUser.rows[0].id;

        // Create profile in 'profiles' table with registration_completed = FALSE, so they complete profile details on dashboard
        await client.query(
          `INSERT INTO profiles (id, full_name, email, registration_completed) 
           VALUES ($1, $2, $3, FALSE)`,
          [userId, fullName, email]
        );

        // Create initial patient medical history
        await client.query(
          `INSERT INTO patient_medical_history (patient_id, ocular_history, systemic_conditions, current_medications, family_eye_history, allergies, updated_at)
           VALUES ($1, '', '', '', '', '', CURRENT_TIMESTAMP)`,
          [userId]
        );

        // Assign role
        const isAdminEmail = await client.query('SELECT * FROM pending_admin_emails WHERE email = $1', [email]);
        if (isAdminEmail.rows.length > 0) {
          role = 'admin';
          await client.query('DELETE FROM pending_admin_emails WHERE email = $1', [email]);
        }

        await client.query(
          'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
          [userId, role]
        );

        // Notify Admins
        notifyAdmins(
          'New Google Registration',
          `${fullName} (${email}) has registered using Google.`,
          'user_activity'
        );
      }

      await client.query('COMMIT');

      // Generate local JWT token for session
      const tokenPayload = { id: userId, role: role };
      const localToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

      // Notify Admins for login
      notifyAdmins(
        'User Login (Google)',
        `${nameToUse} has logged in via Google.`,
        'user_activity'
      );

      res.json({
        token: localToken,
        user: {
          id: userId,
          email: email,
          role: role,
          fullName: nameToUse
        }
      });

    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Google login error:', err.message);
    res.status(401).json({ message: 'Google authentication failed or token expired' });
  }
};

module.exports = { 
  register, 
  login, 
  getMe, 
  adminCreateUser, 
  adminResetPassword, 
  updatePassword,
  getCaptcha,
  sendOtp,
  sendResetOtp,
  verifyResetOtp,
  resetPassword,
  googleLogin
};
