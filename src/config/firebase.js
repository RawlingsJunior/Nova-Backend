const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');
require('dotenv').config({ override: true });

let isConfigured = false;
/** @type {any} */
let defaultApp = null;

function initFirebase() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    isConfigured = true;
    defaultApp = existingApps[0];
    return defaultApp;
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

      defaultApp = initializeApp({
        credential: cert(serviceAccount)
      });
      isConfigured = true;
      console.log('[Firebase Admin] Initialized successfully with FIREBASE_SERVICE_ACCOUNT');
      return defaultApp;
    }

    // 2. Check for individual environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      // Normalize private key newline formatting from .env
      privateKey = privateKey.replace(/\\n/g, '\n');

      defaultApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      isConfigured = true;
      console.log('[Firebase Admin] Initialized successfully with project:', projectId);
      return defaultApp;
    }

    // 3. Fallback: Google Application Default Credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      defaultApp = initializeApp({
        credential: applicationDefault()
      });
      isConfigured = true;
      console.log('[Firebase Admin] Initialized with GOOGLE_APPLICATION_CREDENTIALS');
      return defaultApp;
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
  getApp: () => defaultApp || (getApps().length > 0 ? getApps()[0] : null),
  getAuth: () => {
    try {
      const app = defaultApp || (getApps().length > 0 ? getApps()[0] : null);
      return app ? getAuth(app) : null;
    } catch {
      return null;
    }
  },
  getMessaging: () => {
    try {
      const app = defaultApp || (getApps().length > 0 ? getApps()[0] : null);
      return app ? getMessaging(app) : null;
    } catch {
      return null;
    }
  },
  isConfigured: () => isConfigured
};
