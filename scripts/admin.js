/**
 * ZARA — ZARAFIED STORE
 * Admin Dashboard Controller (ES Modules)
 * 
 * Features:
 * - Firebase Auth integration (Email/Password)
 * - Cryptographic Custom Claim Verification: request.auth.token.admin == true
 * - Cloudinary image upload with 5MB validation and progress bar
 * - Full Firestore Product CRUD (create, read, edit, toggle publish, delete)
 * - Error logging and accessible responsive design
 */

import { initFirebase, getAuth } from './firebase-config.js';
import { 
  getAllProductsAdmin, 
  createProduct, 
  updateProduct, 
  deleteProduct, 
  toggleProductPublishStatus, 
  formatCurrency 
} from './products-service.js';
import { uploadImageToCloudinary } from './cloudinary.js';
import { compressImage, formatBytes, validateInputFile } from './compressor.js';

let currentUser = null;
let isVerifiedAdmin = false;
let currentProducts = [];
let pendingMainImage = null; // { secure_url, url, public_id, format, alt }
let activeDeleteId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initFirebase();
  const auth = getAuth();
  if (!auth) {
    showLoginError('Firebase Authentication could not be initialized.');
    return;
  }

  // Load Auth modular SDK dynamically
  const { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    getIdTokenResult 
  } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');

  // Monitor Authentication State
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      try {
        // Inspect token custom claims
        const tokenResult = await getIdTokenResult(user, true);
        isVerifiedAdmin = tokenResult.claims?.admin === true;

        showDashboard(user);
        await loadAdminProducts();
      } catch (err) {
        console.error('[ZARA Admin]: Error verifying claims.', err);
        showDashboard(user);
      }
    } else {
      isVerifiedAdmin = false;
      showLogin();
    }
  });

  // Setup UI Event Handlers
  setupAuthHandlers(signInWithEmailAndPassword, signOut);
  setupProductFormHandlers();
  setupImageDropzone();
  setupDeleteModalHandlers();
});

/**
 * Setup Sign-in and Sign-out event listeners
 */
function setupAuthHandlers(signInWithEmailAndPassword, signOut) {
  const loginForm = document.getElementById('admin-login-form');
  const logoutBtn = document.getElementById('btn-admin-logout');
  const submitBtn = document.getElementById('btn-login-submit');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideLoginError();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showLoginError('Please enter both email and password.');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';

      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error('[ZARA Admin Login Error]:', err.code, err.message);
      let msg = 'Failed to sign in. Please verify your credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password. Please verify and try again.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Access temporarily disabled due to multiple failed login attempts. Try again later.';
      }
      showLoginError(msg);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In to Dashboard';
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
}

/**
 * Switch view to Dashboard
 * @param {Object} user 
 */
function showDashboard(user) {
  document.getElementById('admin-login-view').style.display = 'none';
  const dashboard = document.getElementById('admin-dashboard-view');
  dashboard.classList.add('is-active');

  const display = document.getElementById('admin-user-display');
  if (display) display.textContent = user.email || 'Admin';

  const roleWarning = document.getElementById('admin-role-warning');
  if (roleWarning) {
    roleWarning.style.display = isVerifiedAdmin ? 'none' : 'block';
  }
}

/**
 * Switch view to Login
 */
function showLogin() {
  document.getElementById('admin-login-view').style.display = 'flex';
  const dashboard = document.getElementById('admin-dashboard-view');
  dashboard.classList.remove('is-active');
  hideLoginError();
}

function showLoginError(msg) {
  const alert = document.getElementById('login-error-alert');
  if (alert) {
    alert.textContent = msg;
    alert.style.display = 'block';
  }
}

function hideLoginError() {
  const alert = document.getElementById('login-error-alert');
  if (alert) alert.style.display = 'none';
}

/**
 * Load all products from Firestore and render table
 */
async function loadAdminProducts() {
  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 40px; color: var(--color-muted-text);">
        Fetching product catalogue from Firestore...
      </td>
    </tr>
  `;

  try {
    const products = await getAllProductsAdmin();
    currentProducts = products;
    updateStats(products);

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--color-muted-text);">
            No outfits in the catalogue yet. Click <strong>+ Add New Outfit</strong> to create your first product.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = products.map((p) => renderTableRow(p)).join('');

    // Attach table action listeners
    attachTableActionListeners();
  } catch (err) {
    console.error('Failed to load admin products:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #D32F2F;">
          Error loading products: ${escapeHtml(err.message)}
        </td>
      </tr>
    `;
  }
}

/**
 * Render single product table row
 * @param {Object} p 
 * @returns {string}
 */
function renderTableRow(p) {
  const imgUrl = p.mainImage?.secure_url || p.mainImage?.url || './ZARA_ASSETS/fashion/signature-fashion-01-ankara.png';
  const isPublished = p.status === 'published';
  const statusBadge = isPublished
    ? `<span class="admin-status-badge published">&#10003; Published</span>`
    : `<span class="admin-status-badge draft">&#9998; Draft</span>`;

  return `
    <tr data-id="${p.id}">
      <td>
        <img src="${imgUrl}" alt="${escapeHtml(p.title)}" class="admin-product-thumb" loading="lazy">
      </td>
      <td>
        <strong>${escapeHtml(p.title)}</strong>
        ${p.featured ? '<span style="font-size: 10px; color: var(--color-gold); margin-left: 6px;">&#9733; Featured</span>' : ''}
      </td>
      <td><span class="badge badge-coral">${escapeHtml(p.category)}</span></td>
      <td><strong>${formatCurrency(p.price)}</strong></td>
      <td>${escapeHtml(p.availability || 'in_stock')}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="admin-actions-cell">
          <button type="button" class="btn-icon-action btn-edit-product" data-id="${p.id}" title="Edit product details">
            Edit
          </button>
          <button type="button" class="btn-icon-action btn-toggle-publish" data-id="${p.id}" data-status="${p.status}" title="${isPublished ? 'Unpublish' : 'Publish'}">
            ${isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button type="button" class="btn-icon-action delete btn-delete-product" data-id="${p.id}" data-title="${escapeHtml(p.title)}" title="Delete product">
            &times;
          </button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Attach action handlers to edit, toggle, and delete buttons
 */
function attachTableActionListeners() {
  document.querySelectorAll('.btn-edit-product').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  document.querySelectorAll('.btn-toggle-publish').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const status = btn.dataset.status;
      btn.disabled = true;
      btn.textContent = 'Updating...';

      try {
        await toggleProductPublishStatus(id, status);
        await loadAdminProducts();
      } catch (err) {
        alert('Failed to update publication status: ' + err.message);
        btn.disabled = false;
        btn.textContent = status === 'published' ? 'Unpublish' : 'Publish';
      }
    });
  });

  document.querySelectorAll('.btn-delete-product').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeDeleteId = btn.dataset.id;
      document.getElementById('delete-product-title').textContent = btn.dataset.title || 'this outfit';
      openDeleteModal();
    });
  });
}

/**
 * Update stats numbers
 * @param {Array} products 
 */
function updateStats(products) {
  const total = products.length;
  const published = products.filter((p) => p.status === 'published').length;
  const drafts = total - published;

  document.getElementById('stat-total-products').textContent = total;
  document.getElementById('stat-published-products').textContent = published;
  document.getElementById('stat-draft-products').textContent = drafts;
}

/**
 * Setup Add/Edit Product Modal and Form
 */
function setupProductFormHandlers() {
  const modal = document.getElementById('product-modal');
  const addBtn = document.getElementById('btn-add-product');
  const closeBtn = document.getElementById('modal-form-close');
  const cancelBtn = document.getElementById('btn-cancel-modal');
  const saveBtn = document.getElementById('btn-save-product');
  const form = document.getElementById('product-form');

  addBtn?.addEventListener('click', () => openCreateModal());
  closeBtn?.addEventListener('click', closeProductModal);
  cancelBtn?.addEventListener('click', closeProductModal);

  saveBtn?.addEventListener('click', async () => {
    const id = document.getElementById('form-product-id').value;
    const title = document.getElementById('form-title').value.trim();
    const description = document.getElementById('form-description').value.trim();
    const price = document.getElementById('form-price').value;
    const category = document.getElementById('form-category').value;
    const availability = document.getElementById('form-availability').value;
    const status = document.getElementById('form-status').value;

    if (!title) {
      alert('Please enter an outfit title.');
      document.getElementById('form-title').focus();
      return;
    }

    if (!price || isNaN(Number(price))) {
      alert('Please enter a valid numeric price in NGN.');
      document.getElementById('form-price').focus();
      return;
    }

    // Collect checked sizes
    const sizeCheckboxes = document.querySelectorAll('#sizes-checkbox-group input[name="sizes"]:checked');
    const availableSizes = Array.from(sizeCheckboxes).map(cb => cb.value);

    // Require primary image on new product
    if (!id && !pendingMainImage) {
      alert('Please upload a primary outfit photograph.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving to Firestore...';

    try {
      const payload = {
        title,
        description,
        price: Number(price),
        category,
        availability,
        status,
        availableSizes,
        ...(pendingMainImage ? { mainImage: pendingMainImage } : {})
      };

      if (id) {
        await updateProduct(id, payload);
      } else {
        await createProduct(payload);
      }

      closeProductModal();
      await loadAdminProducts();
    } catch (err) {
      alert('Error saving product: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Outfit';
    }
  });
}

function openCreateModal() {
  document.getElementById('modal-form-title').textContent = 'Add New Outfit';
  document.getElementById('form-product-id').value = '';
  document.getElementById('product-form').reset();
  pendingMainImage = null;

  document.getElementById('upload-preview-container').style.display = 'none';
  document.getElementById('upload-progress').style.display = 'none';
  resetUploadFeedback();

  const modal = document.getElementById('product-modal');
  modal.classList.add('is-open');
}

function openEditModal(productId) {
  const product = currentProducts.find((p) => p.id === productId);
  if (!product) return;

  document.getElementById('modal-form-title').textContent = 'Edit Outfit: ' + product.title;
  document.getElementById('form-product-id').value = product.id;
  document.getElementById('form-title').value = product.title || '';
  document.getElementById('form-description').value = product.description || '';
  document.getElementById('form-price').value = product.price || '';
  document.getElementById('form-category').value = product.category || 'ready-to-wear';
  document.getElementById('form-availability').value = product.availability || 'in_stock';
  document.getElementById('form-status').value = product.status || 'published';

  // Check sizes
  const sizes = product.availableSizes || [];
  document.querySelectorAll('#sizes-checkbox-group input[name="sizes"]').forEach((cb) => {
    cb.checked = sizes.includes(cb.value);
  });

  // Display existing image preview
  pendingMainImage = null;
  const previewContainer = document.getElementById('upload-preview-container');
  const previewImg = document.getElementById('upload-preview-img');
  const existingUrl = product.mainImage?.secure_url || product.mainImage?.url;

  if (existingUrl) {
    previewImg.src = existingUrl;
    previewContainer.style.display = 'block';
  } else {
    previewContainer.style.display = 'none';
  }

  document.getElementById('upload-progress').style.display = 'none';
  resetUploadFeedback();
  document.getElementById('product-modal').classList.add('is-open');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('is-open');
  resetUploadFeedback();
}

function resetUploadFeedback() {
  const statusText = document.getElementById('upload-status-text');
  const statsBadge = document.getElementById('upload-compression-badge');
  const errorBox = document.getElementById('upload-error-box');
  if (statusText) {
    statusText.textContent = '';
    statusText.style.display = 'none';
  }
  if (statsBadge) {
    statsBadge.textContent = '';
    statsBadge.style.display = 'none';
  }
  if (errorBox) {
    errorBox.textContent = '';
    errorBox.style.display = 'none';
  }
}

/**
 * Setup Image Dropzone and Cloudinary upload
 */
function setupImageDropzone() {
  const dropzone = document.getElementById('image-dropzone');
  const fileInput = document.getElementById('form-image-input');
  const progressBar = document.getElementById('upload-progress');
  const progressFill = document.getElementById('upload-progress-fill');
  const previewContainer = document.getElementById('upload-preview-container');
  const previewImg = document.getElementById('upload-preview-img');

  dropzone?.addEventListener('click', () => fileInput?.click());

  // Drag and drop visual cues
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone?.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleImageUpload(files[0]);
    }
  });

  fileInput?.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleImageUpload(fileInput.files[0]);
    }
  });

  let activeObjectUrl = null;

  async function handleImageUpload(file) {
    const statusText = document.getElementById('upload-status-text');
    const statsBadge = document.getElementById('upload-compression-badge');
    const errorBox = document.getElementById('upload-error-box');
    const saveBtn = document.getElementById('btn-save-product');

    // Reset feedback states
    resetUploadFeedback();

    // Step 1: Validate original file format and size
    const validation = validateInputFile(file);
    if (!validation.valid) {
      showUploadError(validation.error);
      return;
    }

    // Revoke previous object URL if any
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }

    // Step 2: Show initial preview & visible compression indicator
    activeObjectUrl = URL.createObjectURL(file);
    previewImg.src = activeObjectUrl;
    previewContainer.style.display = 'block';

    if (statusText) {
      statusText.textContent = `Analyzing & optimizing ${formatBytes(file.size)} image...`;
      statusText.style.display = 'block';
    }
    progressBar.style.display = 'block';
    progressFill.style.width = '15%';
    if (saveBtn) saveBtn.disabled = true;

    try {
      // Step 3: Compress locally in browser (adaptive progressive compression)
      const compressed = await compressImage(file, (status) => {
        if (statusText) statusText.textContent = status.message;
      });

      // Update preview to optimized file
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = URL.createObjectURL(compressed.optimizedFile);
      previewImg.src = activeObjectUrl;

      // Step 4: Show user feedback
      // Example: Original: 7.2 MB → Optimized: 1.4 MB (80.6% smaller)
      if (statsBadge) {
        statsBadge.textContent = `Original: ${formatBytes(compressed.originalSize)} → Optimized: ${formatBytes(compressed.optimizedSize)} (${compressed.reductionText})`;
        statsBadge.style.display = 'inline-block';
      }

      // Step 5: Upload ONLY the optimized file to Cloudinary
      if (statusText) {
        statusText.textContent = `Uploading optimized image (${formatBytes(compressed.optimizedSize)}) to Cloudinary...`;
      }
      progressFill.style.width = '35%';

      const uploadResult = await uploadImageToCloudinary(compressed.optimizedFile, (percent) => {
        // Map upload progress from 35% to 100%
        const mapped = Math.round(35 + (percent * 0.65));
        progressFill.style.width = `${mapped}%`;
        if (statusText) {
          statusText.textContent = `Uploading to Cloudinary (${percent}%)...`;
        }
      });

      progressFill.style.width = '100%';
      if (statusText) {
        statusText.textContent = 'Upload complete! Image saved.';
      }

      // Step 6: Save returned secure URL and asset ID
      pendingMainImage = {
        secure_url: uploadResult.secure_url,
        url: uploadResult.url,
        public_id: uploadResult.public_id,
        asset_id: uploadResult.asset_id,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        original_bytes: compressed.originalSize,
        width: uploadResult.width || compressed.dimensions.width,
        height: uploadResult.height || compressed.dimensions.height,
        alt: document.getElementById('form-title').value.trim() || 'ZARAFIED Fashion Outfit'
      };

      setTimeout(() => {
        progressBar.style.display = 'none';
      }, 700);
    } catch (err) {
      console.error('[ZARA Admin Image Processing Error]:', err);
      // DO NOT upload original file as fallback
      pendingMainImage = null;
      progressBar.style.display = 'none';
      if (statusText) statusText.style.display = 'none';
      showUploadError(err.message || 'Image optimization or upload failed.');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
      if (fileInput) fileInput.value = '';
    }
  }

  function showUploadError(msg) {
    const errorBox = document.getElementById('upload-error-box');
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    } else {
      alert(msg);
    }
  }
}

/**
 * Setup Delete Confirmation Modal
 */
function setupDeleteModalHandlers() {
  const modal = document.getElementById('delete-modal');
  const closeBtn = document.getElementById('modal-delete-close');
  const cancelBtn = document.getElementById('btn-cancel-delete');
  const confirmBtn = document.getElementById('btn-confirm-delete');

  const close = () => {
    modal.classList.remove('is-open');
    activeDeleteId = null;
  };

  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);

  confirmBtn?.addEventListener('click', async () => {
    if (!activeDeleteId) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';

    try {
      await deleteProduct(activeDeleteId);
      close();
      await loadAdminProducts();
    } catch (err) {
      alert('Error deleting product: ' + err.message);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Delete';
    }
  });
}

function openDeleteModal() {
  document.getElementById('delete-modal').classList.add('is-open');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
