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
  console.log('--- STARTING RATE LIMITING VERIFICATION TEST ---');

  // Step 1: Login as Admin to get JWT token
  console.log('\n1. Logging in as Admin...');
  let adminToken = '';
  try {
    const loginRes = await makeRequest('/auth/login', 'POST', {
      email: 'admin@novaeyecare.com',
      password: 'admin@novaeyecare'
    });

    if (loginRes.status !== 200) {
      throw new Error(`Login failed with status: ${loginRes.status}`);
    }

    adminToken = loginRes.body.token;
    console.log('✓ Success: Logged in as Admin.');
  } catch (err) {
    console.error('✗ Login failed:', err.message);
    process.exit(1);
  }

  const authHeaders = { 'Authorization': `Bearer ${adminToken}` };

  // Step 2: Make 15 consecutive GET requests to /api/appointments
  console.log('\n2. Making 15 consecutive GET requests to /api/appointments...');
  let successCount = 0;
  let tooManyRequestsCount = 0;

  for (let i = 1; i <= 15; i++) {
    try {
      const res = await makeRequest('/appointments', 'GET', null, authHeaders);
      if (res.status === 200) {
        successCount++;
      } else if (res.status === 429) {
        tooManyRequestsCount++;
        console.log(`Request ${i} returned 429 (Too Many Requests)`);
      } else {
        console.log(`Request ${i} returned status ${res.status}:`, res.body || res.raw);
      }
    } catch (err) {
      console.error(`Request ${i} failed:`, err.message);
    }
  }

  console.log(`\nResults:`);
  console.log(`- Success (200 OK): ${successCount}`);
  console.log(`- Rate Limited (429): ${tooManyRequestsCount}`);

  if (tooManyRequestsCount > 0) {
    console.error('✗ Test failed: GET requests are still being throttled by the booking rate limiter.');
    process.exit(1);
  } else {
    console.log('✓ Success: GET requests are no longer throttled by the booking rate limiter!');
  }
};

runTest();
