/**
 * ZARA — ZARAFIED STORE
 * Cloud Firestore Product Catalogue Service
 * Collection: 'products'
 * 
 * Features:
 * - Clean abstraction over Firestore modular SDK
 * - Strict field validation for price, title, category, and Cloudinary media
 * - Supports public querying of published items and administrative management
 * - Preserves existing document structure without destructive migrations
 */

import { initFirebase, getDb } from './firebase-config.js';

const COLLECTION_NAME = 'products';

/**
 * Ensure database instance is initialized and returns firestore helpers
 */
async function getFirestoreContext() {
  await initFirebase();
  const db = getDb();
  if (!db) {
    throw new Error('Database is not initialized. Running in local standby mode.');
  }

  const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  return { db, firestore: firestoreModule };
}

// In-memory cache & deduplication state
let cachedPublishedProducts = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL
let inFlightProductsPromise = null;
const STORAGE_CACHE_KEY = 'zarafied_products_cache';
const STORAGE_TIME_KEY = 'zarafied_products_cache_time';

/**
 * Invalidate in-memory and session cache (called after admin modifications)
 */
export function invalidateProductsCache() {
  cachedPublishedProducts = null;
  cacheTimestamp = 0;
  try {
    sessionStorage.removeItem(STORAGE_CACHE_KEY);
    sessionStorage.removeItem(STORAGE_TIME_KEY);
  } catch (_) {}
}

/**
 * Fetch all published products with deduplication, in-memory caching, and instant client filtering.
 * Resolves concurrent calls from slideshow and shop into a single Firestore query.
 *
 * @param {string|null} [categoryFilter=null] - Optional category filter (e.g. 'ready-to-wear')
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh=false] - Bypass cache and re-fetch from Firestore
 * @returns {Promise<Array<Object>>}
 */
export async function getPublishedProducts(categoryFilter = null, options = {}) {
  const { forceRefresh = false } = options;
  const now = Date.now();

  // 1. Try to restore from sessionStorage if memory cache is clean
  if (!cachedPublishedProducts && !forceRefresh) {
    try {
      const stored = sessionStorage.getItem(STORAGE_CACHE_KEY);
      const storedTime = parseInt(sessionStorage.getItem(STORAGE_TIME_KEY), 10);
      if (stored && storedTime && (now - storedTime < CACHE_TTL_MS)) {
        const parsed = JSON.parse(stored);
        cachedPublishedProducts = parsed.map(p => ({
          ...p,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date()
        }));
        cacheTimestamp = storedTime;
      }
    } catch (_) {}
  }

  // 2. Return fresh cached data if within TTL
  if (!forceRefresh && cachedPublishedProducts && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return filterProductsByCategory(cachedPublishedProducts, categoryFilter);
  }

  // 3. Deduplicate concurrent in-flight requests
  if (inFlightProductsPromise) {
    const products = await inFlightProductsPromise;
    return filterProductsByCategory(products, categoryFilter);
  }

  // 4. Execute single Firestore query for published products
  inFlightProductsPromise = (async () => {
    try {
      const { db, firestore } = await getFirestoreContext();
      const { collection, getDocs, query, where } = firestore;

      const productsRef = collection(db, COLLECTION_NAME);
      const q = query(productsRef, where('status', '==', 'published'));
      const snapshot = await getDocs(q);
      const products = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        products.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
        });
      });

      // Sort client-side by date descending
      products.sort((a, b) => b.createdAt - a.createdAt);

      // Save to memory cache
      cachedPublishedProducts = products;
      cacheTimestamp = Date.now();

      // Save to sessionStorage for fast subsequent navigations
      try {
        sessionStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(products));
        sessionStorage.setItem(STORAGE_TIME_KEY, cacheTimestamp.toString());
      } catch (_) {}

      return products;
    } catch (error) {
      console.warn('[ZARAFIED Products Service]: Unable to load live products.', error.message);
      // Return stale cache if available upon network failure
      if (cachedPublishedProducts) {
        return cachedPublishedProducts;
      }
      throw error;
    } finally {
      inFlightProductsPromise = null;
    }
  })();

  const products = await inFlightProductsPromise;
  return filterProductsByCategory(products, categoryFilter);
}

/**
 * Filter an array of products by category in memory (instant 0ms operation)
 */
function filterProductsByCategory(products, categoryFilter) {
  if (!categoryFilter || categoryFilter === 'all') {
    return products;
  }
  return products.filter((p) => p.category === categoryFilter);
}

/**
 * Fetch a single product by ID (checks memory cache first for 0ms lookup)
 * @param {string} productId 
 * @returns {Promise<Object|null>}
 */
export async function getProductById(productId) {
  if (cachedPublishedProducts) {
    const found = cachedPublishedProducts.find((p) => p.id === productId);
    if (found) return found;
  }

  const { db, firestore } = await getFirestoreContext();
  const { doc, getDoc } = firestore;

  const docRef = doc(db, COLLECTION_NAME, productId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
  };
}

/**
 * Fetch all products for authorized administrator (both published and drafts)
 * @returns {Promise<Array<Object>>}
 */
export async function getAllProductsAdmin() {
  const { db, firestore } = await getFirestoreContext();
  const { collection, getDocs } = firestore;

  const productsRef = collection(db, COLLECTION_NAME);
  const snapshot = await getDocs(productsRef);
  const products = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    products.push({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
    });
  });

  products.sort((a, b) => b.createdAt - a.createdAt);
  return products;
}

/**
 * Create a new product in Firestore (Admin Only)
 * @param {Object} productData 
 * @returns {Promise<string>} Document ID of the created product
 */
export async function createProduct(productData) {
  const { db, firestore } = await getFirestoreContext();
  const { collection, addDoc, serverTimestamp } = firestore;

  // Validate required fields
  if (!productData.title || typeof productData.title !== 'string' || !productData.title.trim()) {
    throw new Error('Product title is required.');
  }

  const priceNum = Number(productData.price);
  if (isNaN(priceNum) || priceNum < 0) {
    throw new Error('Valid numeric price in NGN is required.');
  }

  const docData = {
    title: productData.title.trim(),
    description: (productData.description || '').trim(),
    price: priceNum,
    currency: 'NGN',
    category: productData.category || 'ready-to-wear',
    availability: productData.availability || 'in_stock',
    status: productData.status === 'published' ? 'published' : 'draft',
    availableSizes: Array.isArray(productData.availableSizes) ? productData.availableSizes : [],
    mainImage: productData.mainImage || null,
    additionalImages: Array.isArray(productData.additionalImages) ? productData.additionalImages : [],
    featured: Boolean(productData.featured),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const colRef = collection(db, COLLECTION_NAME);
  const docRef = await addDoc(colRef, docData);
  invalidateProductsCache();
  return docRef.id;
}

/**
 * Update an existing product (Admin Only)
 * @param {string} productId 
 * @param {Object} updates 
 * @returns {Promise<void>}
 */
export async function updateProduct(productId, updates) {
  const { db, firestore } = await getFirestoreContext();
  const { doc, updateDoc, serverTimestamp } = firestore;

  const docRef = doc(db, COLLECTION_NAME, productId);
  const cleanedUpdates = {
    ...updates,
    updatedAt: serverTimestamp()
  };

  if (updates.price !== undefined) {
    const p = Number(updates.price);
    if (isNaN(p) || p < 0) throw new Error('Price must be a valid positive number.');
    cleanedUpdates.price = p;
  }

  await updateDoc(docRef, cleanedUpdates);
  invalidateProductsCache();
}

/**
 * Toggle publication status between 'published' and 'draft' (Admin Only)
 * @param {string} productId 
 * @param {string} currentStatus 
 * @returns {Promise<string>} The new status
 */
export async function toggleProductPublishStatus(productId, currentStatus) {
  const newStatus = currentStatus === 'published' ? 'draft' : 'published';
  await updateProduct(productId, { status: newStatus });
  return newStatus;
}

/**
 * Delete a product document (Admin Only)
 * @param {string} productId 
 * @returns {Promise<void>}
 */
export async function deleteProduct(productId) {
  const { db, firestore } = await getFirestoreContext();
  const { doc, deleteDoc } = firestore;

  const docRef = doc(db, COLLECTION_NAME, productId);
  await deleteDoc(docRef);
  invalidateProductsCache();
}

/**
 * Format currency in Nigerian Naira (NGN)
 * @param {number} amount 
 * @returns {string} (e.g. "₦45,000")
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₦0';
  }
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('NGN', '₦').trim();
}
