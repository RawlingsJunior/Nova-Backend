const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendSMS } = require('../services/smsService');
const { sendEmail } = require('../services/emailService');
const { notifyAdmins } = require('../services/adminNotificationService');

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
    // Get user and their role
    const userQuery = `
      SELECT u.id, u.email, u.password_hash, r.role, p.full_name, p.phone
      FROM users u
      LEFT JOIN user_roles r ON u.id = r.user_id
      LEFT JOIN profiles p ON u.id = p.id
      WHERE u.email = $1`;
    
    /** @type {any} */
    const user = await db.query(userQuery, [email]);
    
    if (user.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const payload = {
      id: user.rows[0].id,
      role: user.rows[0].role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

    // Admin Notification for user login
    // We do this asynchronously, don't await to avoid slowing down login
    notifyAdmins(
      'User Login',
      `${user.rows[0].full_name || email} has logged in.`,
      'user_activity'
    );

    res.json({
      token,
      user: {
        id: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role,
        fullName: user.rows[0].full_name,
        phone: user.rows[0].phone
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

    // 6. Assign role
    const assignedRole = role || 'user';
    await client.query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
      [userId, assignedRole]
    );

    await client.query('COMMIT');

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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

    res.json({ message: 'Password reset successfully' });
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
  console.log(`[OTP] Generated OTP for ${email}/${phone || 'no-phone'} (Channel: ${channel || 'email'}): ${otp}`);

  // 4. Send OTP
  let sentViaSMS = false;
  let sentViaEmail = false;
  let smsError = null;
  let emailError = null;

  const targetChannel = channel || 'email';

  if (targetChannel === 'sms') {
    // Send via SMS
    try {
      const message = `Your Nova Eye Care registration OTP is: ${otp}. It is valid for 10 minutes.`;
      const smsResult = await sendSMS(phone, message);
      if (smsResult.success) {
        sentViaSMS = true;
      } else {
        smsError = smsResult.error || 'Failed to send SMS';
      }
    } catch (err) {
      smsError = err.message;
      console.error('Send OTP SMS error:', err);
    }
  } else {
    // Send via Email
    try {
      const emailResult = await sendEmail({
        to: email,
        subject: 'Your Nova Eye Care OTP Verification Code',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
            <h2 style="color: #0070f3; text-align: center;">Nova Eye Care Portal</h2>
            <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
            <p>Hello,</p>
            <p>Thank you for choosing Nova Eye Care. To complete your account registration, please verify your email address using the One-Time Password (OTP) below:</p>
            <div style="background-color: #f0f7ff; border: 1px dashed #0070f3; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #0070f3; margin: 20px 0; border-radius: 4px;">
              ${otp}
            </div>
            <p style="font-size: 13px; color: #666;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `
      });
      console.log('[OTP] Send OTP Email result:', JSON.stringify(emailResult, null, 2));
      sentViaEmail = true;
    } catch (err) {
      emailError = err.message;
      console.error('Send OTP Email error:', err);
    }
  }

  // If the chosen channel failed to deliver, return error (only strict in production)
  if (targetChannel === 'sms' && !sentViaSMS) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ 
        message: 'Failed to deliver OTP verification code via SMS',
        errors: { sms: smsError }
      });
    } else {
      console.warn(`[SMS] Development Mode Bypass: SMS delivery failed (${smsError}), but returning devOtp for testing.`);
    }
  }

  if (targetChannel === 'email' && !sentViaEmail) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ 
        message: 'Failed to deliver OTP verification code via Email',
        errors: { email: emailError }
      });
    } else {
      console.warn(`[EMAIL] Development Mode Bypass: Email delivery failed (${emailError}), but returning devOtp for testing.`);
    }
  }

  // 5. Create signed OTP token
  const otpToken = jwt.sign(
    { email, phone, otp },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '10m' }
  );

  const responsePayload = {
    message: 'OTP sent successfully',
    otpToken,
    sentViaEmail,
    sentViaSMS
  };

  // For testing ease in dev
  const hasEmailConfig = (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key') || 
                         (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key');
  if (process.env.NODE_ENV !== 'production' || !hasEmailConfig) {
    responsePayload.devOtp = otp;
  }

  res.json(responsePayload);
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

    if (!sentViaEmail && !sentViaSMS && process.env.NODE_ENV === 'production') {
      return res.status(500).json({ 
        message: 'Failed to deliver OTP verification code',
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

    const hasEmailConfig = (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key') || 
                           (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key');
    if (process.env.NODE_ENV !== 'production' || !hasEmailConfig) {
      responsePayload.devOtp = otp;
    }

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
  resetPassword
};
