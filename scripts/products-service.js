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

/**
 * Fetch published products for the public store
 * Strictly queries where status == 'published' to comply with firestore.rules
 * @param {string|null} [categoryFilter] - Optional category filter (e.g. 'ready-to-wear')
 * @returns {Promise<Array<Object>>}
 */
export async function getPublishedProducts(categoryFilter = null) {
  try {
    const { db, firestore } = await getFirestoreContext();
    const { collection, getDocs, query, where, orderBy } = firestore;

    const productsRef = collection(db, COLLECTION_NAME);
    let q;

    if (categoryFilter && categoryFilter !== 'all') {
      q = query(
        productsRef,
        where('status', '==', 'published'),
        where('category', '==', categoryFilter)
      );
    } else {
      q = query(
        productsRef,
        where('status', '==', 'published')
      );
    }

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

    // Client-side sort by date descending to avoid requiring composite Firestore indexes
    products.sort((a, b) => b.createdAt - a.createdAt);

    return products;
  } catch (error) {
    console.warn('[ZARAFIED Products Service]: Unable to load live products.', error.message);
    throw error;
  }
}

/**
 * Fetch a single product by ID
 * @param {string} productId 
 * @returns {Promise<Object|null>}
 */
export async function getProductById(productId) {
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
