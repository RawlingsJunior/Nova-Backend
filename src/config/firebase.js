const admin = require('firebase-admin');
require('dotenv').config({ override: true });

let isConfigured = false;

function initFirebase() {
  if (admin.apps.length > 0) {
    isConfigured = true;
    return admin.apps[0];
  }

  try {
    // 1. Check for complete service account JSON string
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch {
        // Try base64 decoding if not plain JSON
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      isConfigured = true;
      console.log('[Firebase Admin] Initialized successfully with FIREBASE_SERVICE_ACCOUNT');
      return admin.app();
    }

    // 2. Check for individual environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      // Normalize private key newline formatting from .env
      privateKey = privateKey.replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      isConfigured = true;
      console.log('[Firebase Admin] Initialized successfully with project:', projectId);
      return admin.app();
    }

    // 3. Fallback: Google Application Default Credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      isConfigured = true;
      console.log('[Firebase Admin] Initialized with GOOGLE_APPLICATION_CREDENTIALS');
      return admin.app();
    }

    // 4. If credentials not yet supplied, warn gracefully
    console.warn('[Firebase Admin] No service account credentials detected (FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY). Push notifications and Firebase token verification will operate in fallback mode until credentials are provided.');
  } catch (err) {
    console.error('[Firebase Admin] Initialization error:', err.message);
  }

  return null;
}

initFirebase();

module.exports = {
  admin,
  isConfigured: () => isConfigured
};
