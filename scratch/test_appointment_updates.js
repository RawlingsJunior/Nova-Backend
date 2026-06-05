const http = require('http');

const API_BASE = 'http://localhost:5000/api';

const makeRequest = (path, method, body, headers = {}) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body || {});
    const url = new URL(`${API_BASE}${path}`);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
};

const runTest = async () => {
  console.log('--- STARTING APPOINTMENT UPDATE & RESCHEDULE NOTIFICATION TEST ---');

  let adminToken = '';
  
  // Step 1: Login as Admin to get JWT token
  console.log('\n1. Logging in as Admin...');
  try {
    const loginRes = await makeRequest('/auth/login', 'POST', {
      email: 'admin@novaeyecare.com',
      password: 'admin@novaeyecare'
    });

    if (loginRes.status !== 200) {
      throw new Error(`Login failed with status: ${loginRes.status}. Check seeded admin credentials.`);
    }

    adminToken = loginRes.body.token;
    console.log('✓ Success: Logged in as Admin.');
  } catch (err) {
    console.error('✗ Login failed:', err.message);
    process.exit(1);
  }

  const authHeaders = { 'Authorization': `Bearer ${adminToken}` };

  // Step 2: Create a test appointment under verified sandbox email
  console.log('\n2. Creating test appointment...');
  let appointmentId = '';
  try {
    const createRes = await makeRequest('/appointments', 'POST', {
      fullName: 'Rawlings Sandbox Test',
      phone: '233552945333',
      email: 'asomanirawlingsjunior5333@gmail.com', // Must be verified email in Resend sandbox
      service: 'Comprehensive Eye Exam',
      appointmentDate: '2026-06-15',
      appointmentTime: '10:00',
      notes: 'Testing pre-update and update status changes.',
      appointmentType: 'in_person',
      doctorName: 'Dr. Arthur'
    }, authHeaders);

    if (createRes.status !== 201) {
      throw new Error(`Appointment creation failed: ${createRes.status}`);
    }

    appointmentId = createRes.body.id;
    console.log(`✓ Success: Created appointment ID: ${appointmentId} (Status: ${createRes.body.status})`);
  } catch (err) {
    console.error('✗ Failed to create appointment:', err.message);
    process.exit(1);
  }

  // Step 3: Update the appointment status to 'confirmed' (triggering welcome/approval notification)
  console.log('\n3. Updating status to "confirmed" (triggers approval notification)...');
  try {
    const updateRes = await makeRequest(`/appointments/${appointmentId}`, 'PUT', {
      appointmentDate: '2026-06-15',
      appointmentTime: '10:00',
      service: 'Comprehensive Eye Exam',
      notes: 'Testing status update.',
      fullName: 'Rawlings Sandbox Test',
      phone: '233552945333',
      email: 'asomanirawlingsjunior5333@gmail.com',
      status: 'confirmed',
      appointmentType: 'in_person',
      doctorName: 'Dr. Arthur'
    }, authHeaders);

    if (updateRes.status !== 200) {
      throw new Error(`Status update failed: ${updateRes.status}`);
    }

    console.log(`✓ Success: Status updated to "${updateRes.body.status}". Check console logs for Resend delivery proof.`);
  } catch (err) {
    console.error('✗ Failed to update status:', err.message);
    process.exit(1);
  }

  // Step 4: Reschedule the appointment (date/time change) while keeping it 'confirmed'
  console.log('\n4. Rescheduling appointment to a new date & time (triggers reschedule notification)...');
  try {
    const rescheduleRes = await makeRequest(`/appointments/${appointmentId}`, 'PUT', {
      appointmentDate: '2026-06-18', // Rescheduled date
      appointmentTime: '14:30', // Rescheduled time
      service: 'Comprehensive Eye Exam',
      notes: 'Rescheduling test.',
      fullName: 'Rawlings Sandbox Test',
      phone: '233552945333',
      email: 'asomanirawlingsjunior5333@gmail.com',
      status: 'confirmed',
      appointmentType: 'in_person',
      doctorName: 'Dr. Arthur'
    }, authHeaders);

    if (rescheduleRes.status !== 200) {
      throw new Error(`Rescheduling failed: ${rescheduleRes.status}`);
    }

    console.log(`✓ Success: Rescheduled to date: ${rescheduleRes.body.appointment_date} at ${rescheduleRes.body.appointment_time}. Check console logs for Resend delivery proof.`);
  } catch (err) {
    console.error('✗ Failed to reschedule:', err.message);
    process.exit(1);
  }

  // Cleanup: Delete the test appointment
  console.log('\n5. Cleaning up test appointment...');
  try {
    const deleteRes = await makeRequest(`/appointments/${appointmentId}`, 'DELETE', {}, authHeaders);
    if (deleteRes.status !== 200) {
      console.warn('⚠ Failed to clean up appointment:', deleteRes.body);
    } else {
      console.log('✓ Success: Cleaned up test appointment.');
    }
  } catch (err) {
    console.warn('⚠ Cleanup warning:', err.message);
  }

  console.log('\n--- ALL APPOINTMENT NOTIFICATION TESTS COMPLETED ---');
};

runTest();
