/**
 * ZARA — ZARAFIED STORE
 * Dedicated Firebase Modular SDK Initialization Module
 * Project ID: zarastore-17250
 * Web App: zarafiedstore (1:370409615096:web:620bbc0b6277358b02150d)
 * 
 * Features:
 * - Isolated, modular architecture using modern Firebase v10/v11 SDK
 * - Dynamic import from official Google CDN with graceful fallback if offline
 * - Zero homepage disruption: homepage renders reliably even if Firebase is unreachable
 * - Provides accessors for Firestore (db), Storage (storage), and Authentication (auth)
 */

let app = null;
let db = null;
let storage = null;
let auth = null;
let isConfigured = false;
let initError = null;

// Official registered web app configuration for zarastore-17250
const defaultAppConfig = {
  projectId: "zarastore-17250",
  appId: "1:370409615096:web:620bbc0b6277358b02150d",
  storageBucket: "zarastore-17250.firebasestorage.app",
  apiKey: "AIzaSyA3nWHKhOyTMhTlFGtmdytEDcQ0OERUW2A",
  authDomain: "zarastore-17250.firebaseapp.com",
  messagingSenderId: "370409615096",
  measurementId: "G-FZH58SFTX3"
};

/**
 * Load configuration: allows override via window.__FIREBASE_CONFIG__ or local firebase-env.js
 */
async function loadConfig() {
  if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__?.apiKey) {
    return window.__FIREBASE_CONFIG__;
  }

  try {
    const envModule = await import('./firebase-env.js');
    if (envModule?.firebaseEnvConfig?.apiKey) {
      return envModule.firebaseEnvConfig;
    }
  } catch (e) {
    // Falls through to default registered project configuration
  }

  return defaultAppConfig;
}

/**
 * Initialize Firebase services safely without blocking page render
 */
export async function initFirebase() {
  if (app) {
    return { app, db, storage, auth, isConfigured: true };
  }

  try {
    const config = await loadConfig();

    if (!config || !config.apiKey) {
      isConfigured = false;
      return { app: null, db: null, storage: null, auth: null, isConfigured: false };
    }

    // Load Firebase modular SDK dynamically from official Google CDN
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    const { getStorage: getFirebaseStorage } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js');
    const { getAuth: getFirebaseAuth } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');

    app = initializeApp(config);
    db = getFirestore(app);
    storage = getFirebaseStorage(app);
    auth = getFirebaseAuth(app);
    isConfigured = true;

    return { app, db, storage, auth, isConfigured: true };
  } catch (error) {
    initError = error;
    isConfigured = false;
    // Log informative notice without disrupting UX
    console.info('[ZARAFIED Firebase Standby]: Running in local standby mode.', error?.message || error);
    return { app: null, db: null, storage: null, auth: null, isConfigured: false, error };
  }
}

/**
 * Accessor methods
 */
export function getFirebaseApp() {
  return app;
}

export function getDb() {
  return db;
}

export function getStorage() {
  return storage;
}

export function getAuth() {
  return auth;
}

export function isFirebaseReady() {
  return isConfigured && app !== null;
}

export function getInitError() {
  return initError;
}
