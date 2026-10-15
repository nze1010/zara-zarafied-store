/**
 * ZARA — ZARAFIED STORE
 * Dedicated Firebase Modular SDK Initialization Module (Layer 2 Foundation)
 * 
 * Features:
 * - Isolated, modular architecture
 * - Dynamic loading with graceful fallback when unconfigured or offline
 * - Zero homepage disruption: homepage renders 100% reliably even without Firebase credentials
 * - Prepares getters for Firestore (db), Storage (storage), and Authentication (auth)
 */

let app = null;
let db = null;
let storage = null;
let auth = null;
let isConfigured = false;
let initError = null;

// Default configuration placeholder
const placeholderConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "zara-zarafied-store",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

/**
 * Attempt to load local environment configuration if provided
 */
async function loadConfig() {
  // Check window global first
  if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__?.apiKey) {
    return window.__FIREBASE_CONFIG__;
  }

  // Attempt dynamic import of local gitignored env file
  try {
    const envModule = await import('./firebase-env.js');
    if (envModule?.firebaseEnvConfig?.apiKey) {
      return envModule.firebaseEnvConfig;
    }
  } catch (e) {
    // env file is optional during development and Layer 2 foundation
  }

  return placeholderConfig;
}

/**
 * Initialize Firebase services safely
 */
export async function initFirebase() {
  if (app) {
    return { app, db, storage, auth, isConfigured: true };
  }

  try {
    const config = await loadConfig();

    // If no valid API key is present, remain in graceful standby mode
    if (!config.apiKey || config.apiKey.includes('YOUR_API_KEY')) {
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
    // Log helpful diagnostic without breaking UI
    console.info('[ZARAFIED Firebase Standby]: Firebase is not yet active or currently unconfigured. Running in local static mode.');
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
