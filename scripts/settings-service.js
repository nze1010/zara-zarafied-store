/**
 * ZARA — ZARAFIED STORE
 * Site Settings Service — Centralized Content Management
 *
 * Reads and writes to the Firestore `siteSettings` collection.
 * Public documents have isPublic == true and are readable without auth.
 * Only administrators (custom claim admin == true) can write.
 *
 * Document IDs (fixed):
 *   siteSettings/hero          — hero image, headline, description
 *   siteSettings/welcomeCard   — welcome card portrait, heading, body, WA link
 *   siteSettings/about         — about section image, heading, body paragraphs
 *   siteSettings/brand         — logo URL, favicon URL
 *   siteSettings/gallery       — gallery interval, slide order, visible count
 *   siteSettings/contact       — WhatsApp number, email, address (public)
 */

import { initFirebase, getDb } from './firebase-config.js';

async function getFirestoreContext() {
  await initFirebase();
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized.');
  const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  return { db, firestore: firestoreModule };
}

// In-memory caching & deduplication for siteSettings
let cachedPublicSettings = null;
let settingsCacheTimestamp = 0;
const SETTINGS_TTL_MS = 120 * 1000; // 2 minutes
let inFlightSettingsPromise = null;

/**
 * Invalidate settings memory cache (called after admin saves)
 */
export function invalidateSettingsCache() {
  cachedPublicSettings = null;
  settingsCacheTimestamp = 0;
}

/**
 * Fetch a single settings document by ID.
 * Returns null if document doesn't exist.
 * @param {string} docId 
 * @returns {Promise<Object|null>}
 */
export async function getSettingsDoc(docId) {
  // If all public settings are already cached, return from cache
  if (cachedPublicSettings && cachedPublicSettings[docId]) {
    return cachedPublicSettings[docId];
  }

  try {
    const { db, firestore } = await getFirestoreContext();
    const { doc, getDoc } = firestore;
    const ref = doc(db, 'siteSettings', docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    // If not found or permissions error, gracefully return null
    return null;
  }
}

/**
 * Save (merge-write) fields into a siteSettings document.
 * Requires admin authentication — enforced server-side by Firestore rules.
 * @param {string} docId 
 * @param {Object} data 
 * @returns {Promise<void>}
 */
export async function saveSettingsDoc(docId, data) {
  const { db, firestore } = await getFirestoreContext();
  const { doc, setDoc, serverTimestamp } = firestore;
  const ref = doc(db, 'siteSettings', docId);
  await setDoc(ref, {
    ...data,
    isPublic: true,
    updatedAt: serverTimestamp()
  }, { merge: true });

  invalidateSettingsCache();
}

/**
 * Fetch all publicly readable siteSettings documents with memory caching and deduplication.
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Object>} keyed by document ID
 */
export async function getAllPublicSettings(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedPublicSettings && (now - settingsCacheTimestamp < SETTINGS_TTL_MS)) {
    return cachedPublicSettings;
  }

  if (inFlightSettingsPromise) {
    return inFlightSettingsPromise;
  }

  inFlightSettingsPromise = (async () => {
    try {
      const { db, firestore } = await getFirestoreContext();
      const { collection, getDocs, query, where } = firestore;
      const colRef = collection(db, 'siteSettings');
      const q = query(colRef, where('isPublic', '==', true));
      const snap = await getDocs(q);
      const result = {};
      snap.forEach(d => { result[d.id] = { id: d.id, ...d.data() }; });
      cachedPublicSettings = result;
      settingsCacheTimestamp = Date.now();
      return result;
    } catch (err) {
      console.warn('[Settings Service] Could not load site settings.', err.message);
      if (cachedPublicSettings) return cachedPublicSettings;
      return {};
    } finally {
      inFlightSettingsPromise = null;
    }
  })();

  return inFlightSettingsPromise;
}

/**
 * Default fallbacks for each settings document.
 * Used when a document hasn't been written yet.
 */
export const SETTINGS_DEFAULTS = {
  hero: {
    imageUrl: './ZARA_ASSETS/owner/owner-portrait-pink-outfit.jpg',
    imageAlt: 'Creative Director and founder of ZARAFIED STORE in an elegant pink halter outfit',
    headline: 'Wear your <span class="highlight-word">story.</span>',
    description: 'Beautiful outfits, made to express your style. Discover our fashion collections or let us create something special just for you.'
  },
  welcomeCard: {
    imageUrl: './ZARA_ASSETS/owner/owner-portrait-yellow-outfit.jpg',
    imageAlt: 'Creative Director of ZARAFIED in an elegant yellow halter top',
    heading: 'Welcome to ZARAFIED',
    body: 'Looking for ready-to-wear styles or a custom design? Feel free to reach out anytime.',
    whatsappText: 'Hello ZARAFIED, I am reaching out from the website',
    linkLabel: 'Chat on WhatsApp →',
    enabled: true
  },
  about: {
    imageUrl: './ZARA_ASSETS/owner/owner-outfit-reference-collage.png',
    imageAlt: 'Designer and founder styling reference collage',
    heading: 'Meet the Designer',
    paragraph1: 'ZARAFIED was created out of a genuine love for African textiles and modern style. Every piece is designed to help you feel confident, stylish, and truly yourself.',
    paragraph2: 'Whether you choose a ready-to-wear look or request a custom-made outfit, we put care into every detail—from the choice of fabrics to the final fit.'
  },
  brand: {
    logoUrl: './ZARA_ASSETS/brand/zara-logo.png',
    logoAlt: 'ZARA — ZARAFIED STORE Logo',
    faviconUrl: './ZARA_ASSETS/brand/zara-logo.png'
  },
  gallery: {
    intervalSeconds: 3,
    source: 'products', // 'products' = auto from published products
    maxSlides: 20
  },
  contact: {
    whatsappNumber: '2348143049193',
    email: 'Janetzara97@gmail.com',
    address: 'Ogborhill, Aba, Abia State, Nigeria'
  }
};

/**
 * Built-in Core Website Assets Inventory
 * Accounted for centrally with roles and usage indications.
 */
export const SYSTEM_ASSETS = [
  {
    id: 'asset-brand-logo',
    title: 'Official ZARAFIED Brand Logo',
    url: './ZARA_ASSETS/brand/zara-logo.png',
    roles: ['brand'],
    type: 'local',
    usage: 'Header & Footer Logo, Favicon'
  },
  {
    id: 'asset-owner-pink',
    title: 'Founder in Pink Outfit',
    url: './ZARA_ASSETS/owner/owner-portrait-pink-outfit.jpg',
    roles: ['homepage', 'welcome'],
    type: 'local',
    usage: 'Homepage Hero Portrait'
  },
  {
    id: 'asset-owner-yellow',
    title: 'Founder in Yellow Halter Top',
    url: './ZARA_ASSETS/owner/owner-portrait-yellow-outfit.jpg',
    roles: ['welcome', 'homepage'],
    type: 'local',
    usage: 'Welcome Greeting Card'
  },
  {
    id: 'asset-owner-collage',
    title: 'Designer Reference Collage',
    url: './ZARA_ASSETS/owner/owner-outfit-reference-collage.png',
    roles: ['about'],
    type: 'local',
    usage: 'Meet the Designer Section'
  },
  {
    id: 'asset-owner-red',
    title: 'Founder in Red Dress',
    url: './ZARA_ASSETS/owner/owner-portrait-red-dress.png',
    roles: ['general'],
    type: 'local',
    usage: 'Studio Lookbook Archive'
  },
  {
    id: 'asset-fashion-01',
    title: 'Classic Ankara Look',
    url: './ZARA_ASSETS/fashion/signature-fashion-01-ankara.png',
    roles: ['gallery', 'product'],
    type: 'local',
    usage: 'Signature Gallery & Shop Catalogue'
  },
  {
    id: 'asset-fashion-02',
    title: 'Matching Two-Piece Set Look',
    url: './ZARA_ASSETS/fashion/signature-fashion-02-paired-looks.png',
    roles: ['gallery', 'general'],
    type: 'local',
    usage: 'Signature Gallery (Uncatalogued Fashion Asset)'
  },
  {
    id: 'asset-fashion-03',
    title: 'Flowing Statement Dress Look',
    url: './ZARA_ASSETS/fashion/signature-fashion-03-colourful-dress.png',
    roles: ['gallery', 'general'],
    type: 'local',
    usage: 'Signature Gallery (Uncatalogued Fashion Asset)'
  }
];

/**
 * Fetch all media library assets (system assets + custom Cloudinary uploads stored in siteSettings/mediaLibrary)
 * @returns {Promise<Array<Object>>}
 */
export async function getMediaLibraryAssets() {
  const doc = await getSettingsDoc('mediaLibrary');
  const customAssets = doc?.customAssets || [];
  return [...SYSTEM_ASSETS, ...customAssets];
}

/**
 * Save a newly uploaded asset into siteSettings/mediaLibrary
 * @param {Object} asset 
 * @returns {Promise<void>}
 */
export async function addCustomMediaAsset(asset) {
  const current = await getSettingsDoc('mediaLibrary');
  const customAssets = current?.customAssets || [];
  const newAsset = {
    id: 'custom-' + Date.now(),
    title: asset.title || 'Uploaded Asset',
    url: asset.url || asset.secure_url,
    public_id: asset.public_id,
    roles: asset.roles || ['general'],
    type: 'cloudinary',
    usage: asset.usage || 'Media Library',
    createdAt: new Date().toISOString()
  };
  customAssets.unshift(newAsset);
  await saveSettingsDoc('mediaLibrary', { customAssets });
  return newAsset;
}

/**
 * Delete a custom asset from siteSettings/mediaLibrary
 * @param {string} assetId 
 * @returns {Promise<void>}
 */
export async function deleteCustomMediaAsset(assetId) {
  const current = await getSettingsDoc('mediaLibrary');
  const customAssets = (current?.customAssets || []).filter(a => a.id !== assetId);
  await saveSettingsDoc('mediaLibrary', { customAssets });
}

