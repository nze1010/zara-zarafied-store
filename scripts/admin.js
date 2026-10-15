/**
 * ZARA — ZARAFIED STORE
 * Admin Dashboard Controller (ES Modules)
 *
 * Full Centralized Content Management System:
 * - Tab 1: Products Catalogue (CRUD, publish/unpublish, Cloudinary compressed upload)
 * - Tab 2: Media Library (System & custom assets, role tracking, usage detection, quick assignments)
 * - Tab 3: Website Settings (Hero, About, Welcome Card, Brand Logo, Contact info)
 * - Tab 4: Gallery Settings (Signature Creations slideshow interval & max slides)
 * - Firebase Auth integration (Email/Password + custom claim admin == true)
 * - Browser-side image compression (compressor.js targeting < 4.5 MB)
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
import {
  getSettingsDoc,
  saveSettingsDoc,
  SETTINGS_DEFAULTS,
  SYSTEM_ASSETS,
  getMediaLibraryAssets,
  addCustomMediaAsset,
  deleteCustomMediaAsset
} from './settings-service.js';

let currentUser = null;
let isVerifiedAdmin = false;
let currentProducts = [];
let currentMediaAssets = [];
let activeMediaFilter = 'all';

// Product form state
let pendingMainImage = null; // { secure_url, url, public_id, format, alt }
let activeDeleteTarget = null; // { type: 'product'|'media', id: string, title: string, usage: string }

// Settings-panel pending images
let pendingHeroImage = null;
let pendingAboutImage = null;
let pendingWelcomeImage = null;
let pendingLogoImage = null;

// Media-upload modal pending image
let pendingLibraryUpload = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initFirebase();
  const auth = getAuth();
  if (!auth) {
    showLoginError('Firebase Authentication could not be initialized.');
    return;
  }

  const {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    getIdTokenResult
  } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      try {
        const tokenResult = await getIdTokenResult(user, true);
        isVerifiedAdmin = tokenResult.claims?.admin === true;
        showDashboard(user);
        setupTabNavigation();
        await loadAllDashboardData();
      } catch (err) {
        console.error('[ZARA Admin]: Error verifying claims.', err);
        showDashboard(user);
        setupTabNavigation();
      }
    } else {
      isVerifiedAdmin = false;
      showLogin();
    }
  });

  setupAuthHandlers(signInWithEmailAndPassword, signOut);
  setupProductFormHandlers();
  setupProductImageDropzone();
  setupDeleteModalHandlers();
  setupSettingsHandlers();
  setupGallerySettingsHandlers();
  setupMediaLibraryHandlers();
});

async function loadAllDashboardData() {
  await loadAdminProducts();
  await loadMediaLibraryData();
  await loadSettingsPanelData();
  await loadGalleryPanelData();
}

// =============================================================================
// TAB NAVIGATION
// =============================================================================

function setupTabNavigation() {
  const tabs = document.querySelectorAll('.admin-tab');
  const panels = document.querySelectorAll('.admin-tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach(p => { p.style.display = 'none'; });

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const targetPanelId = tab.getAttribute('aria-controls');
      const panel = document.getElementById(targetPanelId);
      if (panel) panel.style.display = 'block';

      // Refresh data if switching to media or gallery
      if (targetPanelId === 'panel-media') {
        renderMediaLibrary();
      } else if (targetPanelId === 'panel-gallery') {
        loadGalleryPanelData();
      }
    });
  });

  // Link from uncatalogued banner
  document.getElementById('btn-view-uncatalogued')?.addEventListener('click', () => {
    const mediaTab = document.getElementById('tab-media');
    if (mediaTab) mediaTab.click();
  });
}

// =============================================================================
// AUTH HANDLERS
// =============================================================================

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

function showDashboard(user) {
  document.getElementById('admin-login-view').style.display = 'none';
  const dashboard = document.getElementById('admin-dashboard-view');
  dashboard.classList.add('is-active');

  const display = document.getElementById('admin-user-display');
  if (display) display.textContent = user.email || 'Admin';

  const roleWarning = document.getElementById('admin-role-warning');
  if (roleWarning) roleWarning.style.display = isVerifiedAdmin ? 'none' : 'block';
}

function showLogin() {
  document.getElementById('admin-login-view').style.display = 'flex';
  const dashboard = document.getElementById('admin-dashboard-view');
  dashboard.classList.remove('is-active');
  hideLoginError();
}

function showLoginError(msg) {
  const alert = document.getElementById('login-error-alert');
  if (alert) { alert.textContent = msg; alert.style.display = 'block'; }
}

function hideLoginError() {
  const alert = document.getElementById('login-error-alert');
  if (alert) alert.style.display = 'none';
}

// =============================================================================
// PRODUCTS TAB
// =============================================================================

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
    currentProducts = await getAllProductsAdmin();
    updateStats();
    renderProductsTable(currentProducts);
    checkUncataloguedAssets();
  } catch (err) {
    console.error('[Admin] Error loading products:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #D32F2F;">
          Could not load products: ${escapeHtml(err.message)}
        </td>
      </tr>
    `;
  }
}

function updateStats() {
  const total = currentProducts.length;
  const published = currentProducts.filter(p => p.status === 'published').length;
  const drafts = currentProducts.filter(p => p.status === 'draft').length;

  const totalEl = document.getElementById('stat-total-products');
  const pubEl = document.getElementById('stat-published-products');
  const draftEl = document.getElementById('stat-draft-products');

  if (totalEl) totalEl.textContent = total;
  if (pubEl) pubEl.textContent = published;
  if (draftEl) draftEl.textContent = drafts;
}

function renderProductsTable(products) {
  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--color-muted-text);">
          No outfits in catalogue yet. Click <strong>+ Add New Outfit</strong> to create your first product.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = products.map(product => {
    const isPublished = product.status === 'published';
    const statusBadge = isPublished
      ? `<span class="badge badge-published">✓ Published</span>`
      : `<span class="badge badge-draft">Draft</span>`;

    const imgUrl = product.mainImage?.secure_url || product.mainImage?.url || './ZARA_ASSETS/fashion/signature-fashion-01-ankara.png';
    const priceText = formatCurrency(product.price);
    const catLabel = formatCategory(product.category);

    return `
      <tr data-id="${escapeHtml(product.id)}">
        <td>
          <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(product.title)}" class="admin-table-thumb" loading="lazy">
        </td>
        <td>
          <strong>${escapeHtml(product.title)}</strong>
          ${product.featured ? '<span class="badge badge-gold" style="font-size:0.65rem; margin-left:6px;">Featured</span>' : ''}
        </td>
        <td><span class="badge badge-coral">${escapeHtml(catLabel)}</span></td>
        <td><strong>${priceText}</strong></td>
        <td>${escapeHtml(product.availability || 'in_stock')}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="admin-actions-cell">
            <button type="button" class="btn btn-outline-sm btn-edit-product" data-id="${escapeHtml(product.id)}">Edit</button>
            <button type="button" class="btn btn-outline-sm btn-toggle-publish" data-id="${escapeHtml(product.id)}" data-status="${escapeHtml(product.status)}">
              ${isPublished ? 'Unpublish' : 'Publish'}
            </button>
            <button type="button" class="btn btn-outline-sm btn-delete-product" data-id="${escapeHtml(product.id)}" data-title="${escapeHtml(product.title)}" title="Delete Outfit" style="color:#C62828;">&times;</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Wire buttons
  tbody.querySelectorAll('.btn-edit-product').forEach(btn => {
    btn.addEventListener('click', () => openEditProductModal(btn.dataset.id));
  });

  tbody.querySelectorAll('.btn-toggle-publish').forEach(btn => {
    btn.addEventListener('click', () => handleTogglePublish(btn.dataset.id, btn.dataset.status));
  });

  tbody.querySelectorAll('.btn-delete-product').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal('product', btn.dataset.id, btn.dataset.title));
  });
}

function checkUncataloguedAssets() {
  const banner = document.getElementById('uncatalogued-banner');
  if (!banner) return;
  // If there are fewer than 3 products in catalogue, show notice
  if (currentProducts.length < 3) {
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function formatCategory(cat) {
  const map = {
    'ready-to-wear': 'Ready-to-Wear',
    'two-piece': 'Two-Piece Set',
    'gowns': 'Gowns & Dresses',
    'bespoke': 'Custom / Bespoke'
  };
  return map[cat] || cat || 'General';
}

// =============================================================================
// PRODUCT ADD / EDIT MODAL & FORM
// =============================================================================

function setupProductFormHandlers() {
  const addBtn = document.getElementById('btn-add-product');
  const closeBtn = document.getElementById('modal-form-close');
  const cancelBtn = document.getElementById('btn-cancel-modal');
  const saveBtn = document.getElementById('btn-save-product');
  const modal = document.getElementById('product-modal');

  addBtn?.addEventListener('click', () => openAddProductModal());
  closeBtn?.addEventListener('click', () => closeProductModal());
  cancelBtn?.addEventListener('click', () => closeProductModal());

  saveBtn?.addEventListener('click', async () => {
    await handleSaveProduct();
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeProductModal();
  });
}

function openAddProductModal(prefillImage = null) {
  document.getElementById('modal-form-title').textContent = 'Add New Outfit';
  document.getElementById('product-form').reset();
  document.getElementById('form-product-id').value = '';

  resetProductImageDropzone();
  if (prefillImage) {
    pendingMainImage = prefillImage;
    showProductImagePreview(prefillImage.secure_url || prefillImage.url);
  } else {
    pendingMainImage = null;
  }

  showModal('product-modal');
}

function openEditProductModal(productId) {
  const product = currentProducts.find(p => p.id === productId);
  if (!product) return;

  document.getElementById('modal-form-title').textContent = 'Edit Outfit';
  document.getElementById('form-product-id').value = product.id;
  document.getElementById('form-title').value = product.title || '';
  document.getElementById('form-description').value = product.description || '';
  document.getElementById('form-price').value = product.price || '';
  document.getElementById('form-category').value = product.category || 'ready-to-wear';
  document.getElementById('form-availability').value = product.availability || 'in_stock';
  document.getElementById('form-status').value = product.status || 'draft';

  // Check sizes
  const sizes = product.availableSizes || [];
  document.querySelectorAll('#sizes-checkbox-group input[name="sizes"]').forEach(cb => {
    cb.checked = sizes.includes(cb.value);
  });

  resetProductImageDropzone();
  if (product.mainImage) {
    pendingMainImage = product.mainImage;
    showProductImagePreview(product.mainImage.secure_url || product.mainImage.url);
  } else {
    pendingMainImage = null;
  }

  showModal('product-modal');
}

function closeProductModal() {
  hideModal('product-modal');
}

async function handleSaveProduct() {
  const title = document.getElementById('form-title').value.trim();
  const price = Number(document.getElementById('form-price').value);
  const category = document.getElementById('form-category').value;
  const description = document.getElementById('form-description').value.trim();
  const availability = document.getElementById('form-availability').value;
  const status = document.getElementById('form-status').value;
  const productId = document.getElementById('form-product-id').value;

  if (!title) { alert('Please enter an outfit title.'); return; }
  if (isNaN(price) || price < 0) { alert('Please enter a valid price in NGN.'); return; }
  if (!pendingMainImage) { alert('Please select or upload a primary outfit photograph.'); return; }

  const selectedSizes = Array.from(document.querySelectorAll('#sizes-checkbox-group input[name="sizes"]:checked'))
    .map(cb => cb.value);

  const payload = {
    title,
    price,
    category,
    description,
    availability,
    status,
    availableSizes: selectedSizes,
    mainImage: pendingMainImage
  };

  const saveBtn = document.getElementById('btn-save-product');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    if (productId) {
      await updateProduct(productId, payload);
      showAdminSuccessToast('Outfit updated successfully!');
    } else {
      await createProduct(payload);
      showAdminSuccessToast('New outfit created successfully!');
    }
    closeProductModal();
    await loadAdminProducts();
    await loadMediaLibraryData();
  } catch (err) {
    console.error('Error saving product:', err);
    alert('Failed to save product: ' + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Outfit';
  }
}

async function handleTogglePublish(productId, currentStatus) {
  try {
    await toggleProductPublishStatus(productId, currentStatus);
    showAdminSuccessToast(`Status updated to ${currentStatus === 'published' ? 'Draft' : 'Published'}`);
    await loadAdminProducts();
  } catch (err) {
    console.error('Toggle status error:', err);
    alert('Failed to update status: ' + err.message);
  }
}

// =============================================================================
// PRODUCT IMAGE UPLOAD & DROPZONE
// =============================================================================

function setupProductImageDropzone() {
  const dropzone = document.getElementById('image-dropzone');
  const input = document.getElementById('form-image-input');
  if (!dropzone || !input) return;

  dropzone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') input.click();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    if (e.dataTransfer.files?.length) {
      processProductImageFile(e.dataTransfer.files[0]);
    }
  });

  input.addEventListener('change', () => {
    if (input.files?.length) {
      processProductImageFile(input.files[0]);
    }
  });
}

async function processProductImageFile(file) {
  const errorBox = document.getElementById('upload-error-box');
  const statusText = document.getElementById('upload-status-text');
  const progressBar = document.getElementById('upload-progress');
  const progressFill = document.getElementById('upload-progress-fill');
  const badge = document.getElementById('upload-compression-badge');

  errorBox.style.display = 'none';
  statusText.style.display = 'block';
  statusText.textContent = `Processing ${file.name} (${formatBytes(file.size)})...`;

  const validation = validateInputFile(file);
  if (!validation.valid) {
    statusText.style.display = 'none';
    errorBox.textContent = validation.error;
    errorBox.style.display = 'block';
    return;
  }

  try {
    statusText.textContent = 'Compressing image in browser...';
    const compResult = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, targetMaxBytes: 4.5 * 1024 * 1024 });

    badge.style.display = 'block';
    badge.innerHTML = `
      <span>⚡ Optimized: <strong>${formatBytes(compResult.originalSize)}</strong> &rarr; <strong>${formatBytes(compResult.compressedSize)}</strong> (${compResult.compressionRatio}% smaller)</span>
    `;

    statusText.textContent = 'Uploading to Cloudinary (zara/products)...';
    progressBar.style.display = 'block';
    progressFill.style.width = '30%';

    const uploadRes = await uploadImageToCloudinary(compResult.file, {
      folder: 'zara/products',
      onProgress: (pct) => {
        progressFill.style.width = `${Math.min(95, 30 + Math.round(pct * 0.65))}%`;
      }
    });

    progressFill.style.width = '100%';
    statusText.textContent = '✅ Image ready!';

    pendingMainImage = {
      secure_url: uploadRes.secure_url,
      url: uploadRes.url,
      public_id: uploadRes.public_id,
      format: uploadRes.format,
      bytes: uploadRes.bytes,
      alt: 'ZARAFIED Fashion Outfit'
    };

    showProductImagePreview(uploadRes.secure_url);
  } catch (err) {
    console.error('Image upload failed:', err);
    progressBar.style.display = 'none';
    statusText.style.display = 'none';
    errorBox.textContent = 'Upload failed: ' + err.message;
    errorBox.style.display = 'block';
  }
}

function showProductImagePreview(url) {
  const container = document.getElementById('upload-preview-container');
  const img = document.getElementById('upload-preview-img');
  if (container && img) {
    img.src = url;
    container.style.display = 'block';
  }
}

function resetProductImageDropzone() {
  const errorBox = document.getElementById('upload-error-box');
  const statusText = document.getElementById('upload-status-text');
  const progressBar = document.getElementById('upload-progress');
  const badge = document.getElementById('upload-compression-badge');
  const container = document.getElementById('upload-preview-container');
  const input = document.getElementById('form-image-input');

  if (errorBox) errorBox.style.display = 'none';
  if (statusText) statusText.style.display = 'none';
  if (progressBar) progressBar.style.display = 'none';
  if (badge) badge.style.display = 'none';
  if (container) container.style.display = 'none';
  if (input) input.value = '';
}

// =============================================================================
// MEDIA LIBRARY TAB
// =============================================================================

async function loadMediaLibraryData() {
  try {
    currentMediaAssets = await getMediaLibraryAssets();
    const countEl = document.getElementById('stat-total-media');
    const pillCount = document.getElementById('media-count-all');
    const totalCount = currentMediaAssets.length + currentProducts.filter(p => p.mainImage).length;
    if (countEl) countEl.textContent = totalCount;
    if (pillCount) pillCount.textContent = totalCount;
    renderMediaLibrary();
  } catch (err) {
    console.warn('[Admin] Could not load media assets:', err);
  }
}

function setupMediaLibraryHandlers() {
  // Filter pills
  document.querySelectorAll('.media-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.media-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeMediaFilter = pill.dataset.role;
      renderMediaLibrary();
    });
  });

  // Open Upload Modal
  document.getElementById('btn-open-media-upload')?.addEventListener('click', () => {
    document.getElementById('media-upload-title').value = '';
    document.getElementById('media-quick-assign').value = 'none';
    resetMediaUploadDropzone();
    pendingLibraryUpload = null;
    showModal('media-upload-modal');
  });

  document.getElementById('modal-media-close')?.addEventListener('click', () => hideModal('media-upload-modal'));
  document.getElementById('btn-cancel-media-upload')?.addEventListener('click', () => hideModal('media-upload-modal'));

  // Setup media upload dropzone
  setupMediaUploadDropzone();

  // Save to Library button
  document.getElementById('btn-save-media-asset')?.addEventListener('click', async () => {
    const title = document.getElementById('media-upload-title')?.value.trim();
    if (!title) { alert('Please enter an asset name or label.'); return; }
    if (!pendingLibraryUpload) { alert('Please select and upload an image.'); return; }

    const roles = Array.from(document.querySelectorAll('#media-upload-roles input[name="media-roles"]:checked'))
      .map(cb => cb.value);
    if (roles.length === 0) roles.push('general');

    const quickAssign = document.getElementById('media-quick-assign')?.value;
    const btn = document.getElementById('btn-save-media-asset');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      // 1. Add to custom assets in siteSettings/mediaLibrary
      const newAsset = await addCustomMediaAsset({
        title,
        url: pendingLibraryUpload.secure_url,
        public_id: pendingLibraryUpload.public_id,
        roles,
        usage: quickAssign !== 'none' ? `Assigned to ${quickAssign}` : 'Media Library'
      });

      // 2. Immediate placement if requested
      if (quickAssign === 'hero') {
        await saveSettingsDoc('hero', { imageUrl: pendingLibraryUpload.secure_url, imageAlt: title });
      } else if (quickAssign === 'welcome') {
        await saveSettingsDoc('welcomeCard', { imageUrl: pendingLibraryUpload.secure_url, imageAlt: title });
      } else if (quickAssign === 'about') {
        await saveSettingsDoc('about', { imageUrl: pendingLibraryUpload.secure_url, imageAlt: title });
      } else if (quickAssign === 'brand') {
        await saveSettingsDoc('brand', { logoUrl: pendingLibraryUpload.secure_url, faviconUrl: pendingLibraryUpload.secure_url });
      }

      hideModal('media-upload-modal');
      showAdminSuccessToast('Asset saved to Media Library!');
      await loadMediaLibraryData();
      await loadSettingsPanelData();
    } catch (err) {
      alert('Failed to save asset: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save to Library';
    }
  });
}

function renderMediaLibrary() {
  const grid = document.getElementById('media-library-grid');
  if (!grid) return;

  // Build unified list: product images + library assets
  const productAssets = currentProducts
    .filter(p => p.mainImage?.secure_url || p.mainImage?.url)
    .map(p => ({
      id: 'prod-' + p.id,
      title: p.title,
      url: p.mainImage.secure_url || p.mainImage.url,
      roles: ['product', 'gallery'],
      type: 'product',
      usage: `Linked to Product: ${p.title} (${formatCategory(p.category)})`,
      productId: p.id
    }));

  const allAssets = [...currentMediaAssets, ...productAssets];

  // Filter
  const filtered = activeMediaFilter === 'all'
    ? allAssets
    : allAssets.filter(a => a.roles && a.roles.includes(activeMediaFilter));

  if (filtered.length === 0) {
    grid.innerHTML = `
      <p style="color: var(--color-muted-text); padding: 40px; text-align: center; grid-column: 1 / -1;">
        No assets found in category: <strong>${escapeHtml(activeMediaFilter)}</strong>.
      </p>
    `;
    return;
  }

  grid.innerHTML = filtered.map(asset => {
    const rolesHtml = (asset.roles || ['general']).map(r =>
      `<span class="media-role-badge media-role-${escapeHtml(r)}">${escapeHtml(r)}</span>`
    ).join(' ');

    const isLocal = asset.type === 'local';
    const isProduct = asset.type === 'product';
    const isCustom = asset.type === 'cloudinary';

    let actionButtonsHtml = '';

    if (isProduct) {
      actionButtonsHtml = `
        <button type="button" class="media-action-btn btn-media-edit-product" data-product-id="${escapeHtml(asset.productId)}">
          Edit Product
        </button>
      `;
    } else if (asset.id === 'asset-fashion-02' || asset.id === 'asset-fashion-03') {
      // Uncatalogued lookbook image! Provide the exact workflow requested
      actionButtonsHtml = `
        <button type="button" class="media-action-btn btn-media-catalogue" data-img-url="${escapeHtml(asset.url)}" data-img-title="${escapeHtml(asset.title)}" style="background:var(--color-berry); color:#fff; border-color:var(--color-berry);">
          ✨ Catalogue as Outfit
        </button>
      `;
    } else {
      actionButtonsHtml = `
        <button type="button" class="media-action-btn btn-assign-hero" data-url="${escapeHtml(asset.url)}" data-title="${escapeHtml(asset.title)}" title="Use as Hero Portrait">Hero</button>
        <button type="button" class="media-action-btn btn-assign-welcome" data-url="${escapeHtml(asset.url)}" data-title="${escapeHtml(asset.title)}" title="Use in Welcome Card">Welcome</button>
        <button type="button" class="media-action-btn btn-assign-about" data-url="${escapeHtml(asset.url)}" data-title="${escapeHtml(asset.title)}" title="Use in About Section">About</button>
        ${isCustom ? `
          <button type="button" class="media-action-btn media-action-danger btn-delete-media" data-id="${escapeHtml(asset.id)}" data-title="${escapeHtml(asset.title)}" data-usage="${escapeHtml(asset.usage || '')}">
            Delete
          </button>
        ` : ''}
      `;
    }

    return `
      <article class="media-card" data-id="${escapeHtml(asset.id)}">
        <div class="media-card-img-wrap">
          <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.title)}" class="media-card-img" loading="lazy">
        </div>
        <div class="media-card-body">
          <h4 class="media-card-title">${escapeHtml(asset.title)}</h4>
          <div class="media-card-meta">${isLocal ? 'Built-in Asset' : isProduct ? 'Product Photograph' : 'Cloudinary Asset'}</div>
          <div class="media-roles-list">${rolesHtml}</div>
          <div class="media-usage-note"><strong>Usage:</strong> ${escapeHtml(asset.usage || 'Media Library')}</div>
          <div class="media-card-actions">
            ${actionButtonsHtml}
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Wire actions
  grid.querySelectorAll('.btn-media-edit-product').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('tab-products')?.click();
      openEditProductModal(btn.dataset.productId);
    });
  });

  grid.querySelectorAll('.btn-media-catalogue').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('tab-products')?.click();
      openAddProductModal({
        secure_url: btn.dataset.imgUrl,
        url: btn.dataset.imgUrl,
        public_id: 'local/' + btn.dataset.imgTitle.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        format: 'png',
        alt: btn.dataset.imgTitle
      });
      document.getElementById('form-title').value = btn.dataset.imgTitle;
    });
  });

  grid.querySelectorAll('.btn-assign-hero').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm(`Set "${btn.dataset.title}" as the Homepage Hero portrait?`)) {
        await saveSettingsDoc('hero', { imageUrl: btn.dataset.url, imageAlt: btn.dataset.title });
        showAdminSuccessToast('Hero image updated!');
        await loadSettingsPanelData();
      }
    });
  });

  grid.querySelectorAll('.btn-assign-welcome').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm(`Set "${btn.dataset.title}" as the Welcome Card portrait?`)) {
        await saveSettingsDoc('welcomeCard', { imageUrl: btn.dataset.url, imageAlt: btn.dataset.title });
        showAdminSuccessToast('Welcome Card portrait updated!');
        await loadSettingsPanelData();
      }
    });
  });

  grid.querySelectorAll('.btn-assign-about').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm(`Set "${btn.dataset.title}" as the About section image?`)) {
        await saveSettingsDoc('about', { imageUrl: btn.dataset.url, imageAlt: btn.dataset.title });
        showAdminSuccessToast('About section image updated!');
        await loadSettingsPanelData();
      }
    });
  });

  grid.querySelectorAll('.btn-delete-media').forEach(btn => {
    btn.addEventListener('click', () => {
      openDeleteModal('media', btn.dataset.id, btn.dataset.title, btn.dataset.usage);
    });
  });
}

function setupMediaUploadDropzone() {
  const dropzone = document.getElementById('media-library-dropzone');
  const input = document.getElementById('media-file-input');
  if (!dropzone || !input) return;

  dropzone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') input.click();
  });

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    if (e.dataTransfer.files?.length) processMediaUploadFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => {
    if (input.files?.length) processMediaUploadFile(input.files[0]);
  });
}

async function processMediaUploadFile(file) {
  const statusText = document.getElementById('media-upload-status');
  const progressBar = document.getElementById('media-upload-progress');
  const progressFill = document.getElementById('media-upload-progress-fill');
  const badge = document.getElementById('media-compression-badge');
  const previewContainer = document.getElementById('media-preview-container');
  const previewImg = document.getElementById('media-preview-img');

  const validation = validateInputFile(file);
  if (!validation.valid) { alert(validation.error); return; }

  statusText.style.display = 'block';
  statusText.textContent = 'Compressing image in browser...';

  try {
    const compResult = await compressImage(file, { maxWidth: 1800, maxHeight: 1800, targetMaxBytes: 4.5 * 1024 * 1024 });
    badge.style.display = 'block';
    badge.innerHTML = `<span>⚡ Optimized: ${formatBytes(compResult.originalSize)} &rarr; ${formatBytes(compResult.compressedSize)} (${compResult.compressionRatio}% saved)</span>`;

    statusText.textContent = 'Uploading to Cloudinary (zara/media)...';
    progressBar.style.display = 'block';
    progressFill.style.width = '30%';

    const uploadRes = await uploadImageToCloudinary(compResult.file, {
      folder: 'zara/media',
      onProgress: (pct) => {
        progressFill.style.width = `${Math.min(95, 30 + Math.round(pct * 0.65))}%`;
      }
    });

    progressFill.style.width = '100%';
    statusText.textContent = '✅ Image ready to save!';
    pendingLibraryUpload = uploadRes;

    previewImg.src = uploadRes.secure_url;
    previewContainer.style.display = 'block';

    // Auto-fill title if empty
    const titleInput = document.getElementById('media-upload-title');
    if (titleInput && !titleInput.value) {
      titleInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    }
  } catch (err) {
    statusText.textContent = 'Upload failed: ' + err.message;
  }
}

function resetMediaUploadDropzone() {
  const statusText = document.getElementById('media-upload-status');
  const progressBar = document.getElementById('media-upload-progress');
  const badge = document.getElementById('media-compression-badge');
  const previewContainer = document.getElementById('media-preview-container');
  const input = document.getElementById('media-file-input');

  if (statusText) statusText.style.display = 'none';
  if (progressBar) progressBar.style.display = 'none';
  if (badge) badge.style.display = 'none';
  if (previewContainer) previewContainer.style.display = 'none';
  if (input) input.value = '';
}

// =============================================================================
// WEBSITE SETTINGS PANEL
// =============================================================================

async function loadSettingsPanelData() {
  try {
    // 1. Hero
    const heroSettings = await getSettingsDoc('hero') || SETTINGS_DEFAULTS.hero;
    const heroThumb = document.getElementById('hero-preview-thumb');
    const heroLabel = document.getElementById('hero-current-label');
    const heroHeadline = document.getElementById('hero-headline-input');
    const heroDesc = document.getElementById('hero-desc-input');

    if (heroThumb && heroSettings.imageUrl) { heroThumb.src = heroSettings.imageUrl; heroThumb.style.display = 'block'; }
    if (heroLabel) heroLabel.textContent = heroSettings.imageUrl ? heroSettings.imageUrl.split('/').pop() : 'Default';
    if (heroHeadline && heroSettings.headline) heroHeadline.value = heroSettings.headline;
    if (heroDesc && heroSettings.description) heroDesc.value = heroSettings.description;

    // 2. About
    const aboutSettings = await getSettingsDoc('about') || SETTINGS_DEFAULTS.about;
    const aboutThumb = document.getElementById('about-preview-thumb');
    const aboutLabel = document.getElementById('about-current-label');
    const aboutHeading = document.getElementById('about-heading-input');
    const aboutP1 = document.getElementById('about-p1-input');
    const aboutP2 = document.getElementById('about-p2-input');

    if (aboutThumb && aboutSettings.imageUrl) { aboutThumb.src = aboutSettings.imageUrl; aboutThumb.style.display = 'block'; }
    if (aboutLabel) aboutLabel.textContent = aboutSettings.imageUrl ? aboutSettings.imageUrl.split('/').pop() : 'Default';
    if (aboutHeading && aboutSettings.heading) aboutHeading.value = aboutSettings.heading;
    if (aboutP1 && aboutSettings.paragraph1) aboutP1.value = aboutSettings.paragraph1;
    if (aboutP2 && aboutSettings.paragraph2) aboutP2.value = aboutSettings.paragraph2;

    // 3. Welcome Card
    const wcSettings = await getSettingsDoc('welcomeCard') || SETTINGS_DEFAULTS.welcomeCard;
    const wcThumb = document.getElementById('welcome-preview-thumb');
    const wcHeading = document.getElementById('welcome-heading-input');
    const wcBody = document.getElementById('welcome-body-input');
    const wcLink = document.getElementById('welcome-linklabel-input');
    const wcEnabled = document.getElementById('welcome-enabled-input');

    if (wcThumb && wcSettings.imageUrl) { wcThumb.src = wcSettings.imageUrl; wcThumb.style.display = 'block'; }
    if (wcHeading && wcSettings.heading) wcHeading.value = wcSettings.heading;
    if (wcBody && wcSettings.body) wcBody.value = wcSettings.body;
    if (wcLink && wcSettings.linkLabel) wcLink.value = wcSettings.linkLabel;
    if (wcEnabled) wcEnabled.checked = wcSettings.enabled !== false;

    // 4. Brand Logo
    const brandSettings = await getSettingsDoc('brand') || SETTINGS_DEFAULTS.brand;
    const logoThumb = document.getElementById('logo-preview-thumb');
    if (logoThumb && brandSettings.logoUrl) logoThumb.src = brandSettings.logoUrl;

    // 5. Contact Info
    const contactSettings = await getSettingsDoc('contact') || SETTINGS_DEFAULTS.contact;
    const waInput = document.getElementById('contact-whatsapp-input');
    const emailInput = document.getElementById('contact-email-input');
    const addrInput = document.getElementById('contact-address-input');

    if (waInput && contactSettings.whatsappNumber) waInput.value = contactSettings.whatsappNumber;
    if (emailInput && contactSettings.email) emailInput.value = contactSettings.email;
    if (addrInput && contactSettings.address) addrInput.value = contactSettings.address;

  } catch (err) {
    console.warn('[Admin] Could not load all settings:', err);
  }
}

function setupSettingsHandlers() {
  // Generic single-image dropzone creator
  function createSettingsUploader({ dropzoneId, fileInputId, statusId, progressBarId, progressFillId, thumbId, folder, onComplete }) {
    const dropzone = document.getElementById(dropzoneId);
    const input = document.getElementById(fileInputId);
    if (!dropzone || !input) return;

    dropzone.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT') input.click(); });
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      if (e.dataTransfer.files?.length) handleFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', () => { if (input.files?.length) handleFile(input.files[0]); });

    async function handleFile(file) {
      const statusEl = document.getElementById(statusId);
      const progressEl = document.getElementById(progressBarId);
      const fillEl = document.getElementById(progressFillId);
      const thumbEl = document.getElementById(thumbId);

      const val = validateInputFile(file);
      if (!val.valid) { alert(val.error); return; }

      statusEl.style.display = 'block';
      statusEl.textContent = 'Compressing in browser...';

      try {
        const comp = await compressImage(file, { maxWidth: 1800, maxHeight: 1800, targetMaxBytes: 4.5 * 1024 * 1024 });
        statusEl.textContent = 'Uploading to Cloudinary...';
        progressEl.style.display = 'block';
        fillEl.style.width = '30%';

        const res = await uploadImageToCloudinary(comp.file, {
          folder,
          onProgress: (pct) => { fillEl.style.width = `${Math.min(95, 30 + Math.round(pct * 0.65))}%`; }
        });

        fillEl.style.width = '100%';
        statusEl.textContent = '✅ Image uploaded!';
        if (thumbEl) { thumbEl.src = res.secure_url; thumbEl.style.display = 'block'; }

        onComplete({ imageUrl: res.secure_url, imagePublicId: res.public_id });
      } catch (err) {
        statusEl.textContent = 'Upload failed: ' + err.message;
      }
    }
  }

  // 1. Hero Image Uploader
  createSettingsUploader({
    dropzoneId: 'hero-dropzone',
    fileInputId: 'hero-image-input',
    statusId: 'hero-upload-status',
    progressBarId: 'hero-upload-progress',
    progressFillId: 'hero-upload-progress-fill',
    thumbId: 'hero-preview-thumb',
    folder: 'zara/settings',
    onComplete: (data) => { pendingHeroImage = data; }
  });

  // Save Hero Content Button
  document.getElementById('btn-save-hero-settings')?.addEventListener('click', async () => {
    const headline = document.getElementById('hero-headline-input')?.value.trim();
    const description = document.getElementById('hero-desc-input')?.value.trim();
    const btn = document.getElementById('btn-save-hero-settings');
    const successEl = document.getElementById('hero-settings-success');

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const data = { headline, description };
      if (pendingHeroImage) {
        data.imageUrl = pendingHeroImage.imageUrl;
        data.imagePublicId = pendingHeroImage.imagePublicId;
      }
      await saveSettingsDoc('hero', data);
      if (successEl) { successEl.style.display = 'block'; setTimeout(() => { successEl.style.display = 'none'; }, 3000); }
      showAdminSuccessToast('Hero content saved!');
      pendingHeroImage = null;
      await loadSettingsPanelData();
    } catch (err) {
      alert('Failed to save hero settings: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Hero Content';
    }
  });

  // 2. About Image Uploader
  createSettingsUploader({
    dropzoneId: 'about-dropzone',
    fileInputId: 'about-image-input',
    statusId: 'about-upload-status',
    progressBarId: 'about-upload-progress',
    progressFillId: 'about-upload-progress-fill',
    thumbId: 'about-preview-thumb',
    folder: 'zara/settings',
    onComplete: (data) => { pendingAboutImage = data; }
  });

  // Save About Section Button
  document.getElementById('btn-save-about-settings')?.addEventListener('click', async () => {
    const heading = document.getElementById('about-heading-input')?.value.trim();
    const paragraph1 = document.getElementById('about-p1-input')?.value.trim();
    const paragraph2 = document.getElementById('about-p2-input')?.value.trim();
    const btn = document.getElementById('btn-save-about-settings');
    const successEl = document.getElementById('about-settings-success');

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const data = { heading, paragraph1, paragraph2 };
      if (pendingAboutImage) {
        data.imageUrl = pendingAboutImage.imageUrl;
        data.imagePublicId = pendingAboutImage.imagePublicId;
      }
      await saveSettingsDoc('about', data);
      if (successEl) { successEl.style.display = 'block'; setTimeout(() => { successEl.style.display = 'none'; }, 3000); }
      showAdminSuccessToast('About section saved!');
      pendingAboutImage = null;
      await loadSettingsPanelData();
    } catch (err) {
      alert('Failed to save about section: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save About Section';
    }
  });

  // 3. Welcome Card Uploader
  createSettingsUploader({
    dropzoneId: 'welcome-dropzone',
    fileInputId: 'welcome-image-input',
    statusId: 'welcome-upload-status',
    progressBarId: 'welcome-upload-progress',
    progressFillId: 'welcome-upload-progress-fill',
    thumbId: 'welcome-preview-thumb',
    folder: 'zara/settings',
    onComplete: (data) => { pendingWelcomeImage = data; }
  });

  // Save Welcome Card Button
  document.getElementById('btn-save-welcome-settings')?.addEventListener('click', async () => {
    const heading = document.getElementById('welcome-heading-input')?.value.trim();
    const body = document.getElementById('welcome-body-input')?.value.trim();
    const linkLabel = document.getElementById('welcome-linklabel-input')?.value.trim();
    const enabled = document.getElementById('welcome-enabled-input')?.checked;
    const btn = document.getElementById('btn-save-welcome-settings');
    const successEl = document.getElementById('welcome-settings-success');

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const data = { heading, body, linkLabel, enabled };
      if (pendingWelcomeImage) {
        data.imageUrl = pendingWelcomeImage.imageUrl;
        data.imagePublicId = pendingWelcomeImage.imagePublicId;
        data.imageAlt = 'Creative Director of ZARAFIED';
      }
      await saveSettingsDoc('welcomeCard', data);
      if (successEl) { successEl.style.display = 'block'; setTimeout(() => { successEl.style.display = 'none'; }, 3000); }
      showAdminSuccessToast('Welcome card settings saved!');
      pendingWelcomeImage = null;
      await loadSettingsPanelData();
    } catch (err) {
      alert('Failed to save welcome card settings: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Welcome Card';
    }
  });

  // 4. Brand Logo Uploader
  createSettingsUploader({
    dropzoneId: 'logo-dropzone',
    fileInputId: 'logo-image-input',
    statusId: 'logo-upload-status',
    progressBarId: 'logo-upload-progress',
    progressFillId: 'logo-upload-progress-fill',
    thumbId: 'logo-preview-thumb',
    folder: 'zara/brand',
    onComplete: (data) => { pendingLogoImage = data; }
  });

  // Save Brand Logo Button
  document.getElementById('btn-save-brand-settings')?.addEventListener('click', async () => {
    if (!pendingLogoImage) { alert('Please upload a new brand logo first.'); return; }
    const btn = document.getElementById('btn-save-brand-settings');
    const successEl = document.getElementById('brand-settings-success');

    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
      await saveSettingsDoc('brand', {
        logoUrl: pendingLogoImage.imageUrl,
        logoPublicId: pendingLogoImage.imagePublicId,
        faviconUrl: pendingLogoImage.imageUrl
      });
      if (successEl) { successEl.style.display = 'block'; setTimeout(() => { successEl.style.display = 'none'; }, 3000); }
      showAdminSuccessToast('Brand logo updated across the website!');
      pendingLogoImage = null;
      await loadSettingsPanelData();
      await loadMediaLibraryData();
    } catch (err) {
      alert('Failed to update brand logo: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Brand Logo';
    }
  });

  // 5. Contact Info Button
  document.getElementById('btn-save-contact-settings')?.addEventListener('click', async () => {
    const whatsappNumber = document.getElementById('contact-whatsapp-input')?.value.trim();
    const email = document.getElementById('contact-email-input')?.value.trim();
    const address = document.getElementById('contact-address-input')?.value.trim();
    const btn = document.getElementById('btn-save-contact-settings');
    const successEl = document.getElementById('contact-settings-success');

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      await saveSettingsDoc('contact', { whatsappNumber, email, address });
      if (successEl) { successEl.style.display = 'block'; setTimeout(() => { successEl.style.display = 'none'; }, 3000); }
      showAdminSuccessToast('Contact details saved!');
    } catch (err) {
      alert('Failed to save contact info: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Contact Info';
    }
  });
}

// =============================================================================
// GALLERY SETTINGS PANEL
// =============================================================================

async function loadGalleryPanelData() {
  try {
    const gallerySettings = await getSettingsDoc('gallery') || SETTINGS_DEFAULTS.gallery;
    const intervalInput = document.getElementById('gallery-interval-input');
    const maxInput = document.getElementById('gallery-max-slides-input');
    if (intervalInput) intervalInput.value = gallerySettings.intervalSeconds || 3;
    if (maxInput) maxInput.value = gallerySettings.maxSlides || 20;
  } catch (_) {}

  const listContainer = document.getElementById('gallery-product-list');
  if (!listContainer) return;

  try {
    const products = currentProducts.length > 0 ? currentProducts : await getAllProductsAdmin();
    const published = products.filter(p => p.status === 'published' && (p.mainImage?.secure_url || p.mainImage?.url));

    if (published.length === 0) {
      listContainer.innerHTML = `<p style="color: var(--color-muted-text);">No published products with images yet. Published products will automatically appear in the slideshow.</p>`;
      return;
    }

    listContainer.innerHTML = `
      <p style="color: var(--color-muted-text); font-size:var(--text-sm); margin-bottom: var(--space-md);">
        ${published.length} published product${published.length !== 1 ? 's' : ''} eligible for the Signature Creations slideshow:
      </p>
      <div class="gallery-product-thumbs">
        ${published.slice(0, 20).map(p => `
          <div class="gallery-thumb-item" title="${escapeHtml(p.title)}">
            <img src="${p.mainImage.secure_url || p.mainImage.url}" alt="${escapeHtml(p.title)}" class="gallery-thumb-img" loading="lazy">
            <span class="gallery-thumb-label">${escapeHtml(p.title)}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    listContainer.innerHTML = `<p style="color:#D32F2F;">Could not load products: ${escapeHtml(err.message)}</p>`;
  }
}

function setupGallerySettingsHandlers() {
  document.getElementById('btn-save-gallery-settings')?.addEventListener('click', async () => {
    const intervalVal = Number(document.getElementById('gallery-interval-input')?.value) || 3;
    const maxVal = Number(document.getElementById('gallery-max-slides-input')?.value) || 20;
    const btn = document.getElementById('btn-save-gallery-settings');
    const successEl = document.getElementById('gallery-settings-success');

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      await saveSettingsDoc('gallery', {
        intervalSeconds: Math.max(1, Math.round(intervalVal)),
        maxSlides: Math.min(50, Math.max(1, Math.round(maxVal))),
        source: 'products'
      });
      if (successEl) { successEl.style.display = 'block'; setTimeout(() => { successEl.style.display = 'none'; }, 3000); }
      showAdminSuccessToast('Gallery settings saved!');
    } catch (err) {
      alert('Failed to save gallery settings: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Gallery Settings';
    }
  });
}

// =============================================================================
// DELETE MODAL (Product or Media Asset)
// =============================================================================

function setupDeleteModalHandlers() {
  const modal = document.getElementById('delete-modal');
  const closeBtn = document.getElementById('modal-delete-close');
  const cancelBtn = document.getElementById('btn-cancel-delete');
  const confirmBtn = document.getElementById('btn-confirm-delete');

  closeBtn?.addEventListener('click', () => hideModal('delete-modal'));
  cancelBtn?.addEventListener('click', () => hideModal('delete-modal'));

  confirmBtn?.addEventListener('click', async () => {
    if (!activeDeleteTarget) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';

    try {
      if (activeDeleteTarget.type === 'product') {
        await deleteProduct(activeDeleteTarget.id);
        showAdminSuccessToast('Outfit removed from catalogue.');
        await loadAdminProducts();
        await loadMediaLibraryData();
      } else if (activeDeleteTarget.type === 'media') {
        await deleteCustomMediaAsset(activeDeleteTarget.id);
        showAdminSuccessToast('Asset removed from Media Library.');
        await loadMediaLibraryData();
      }
      hideModal('delete-modal');
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Delete';
      activeDeleteTarget = null;
    }
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) hideModal('delete-modal');
  });
}

function openDeleteModal(type, id, title, usage = '') {
  activeDeleteTarget = { type, id, title, usage };
  document.getElementById('delete-product-title').textContent = title || id;

  const warningNote = document.getElementById('delete-warning-note');
  if (warningNote) {
    if (usage && usage !== 'Media Library') {
      warningNote.innerHTML = `⚠️ <strong>Active Usage Warning:</strong> This asset is recorded as: <em>${escapeHtml(usage)}</em>. Deleting it will leave the section using its default asset.`;
      warningNote.style.display = 'block';
    } else {
      warningNote.style.display = 'none';
    }
  }

  showModal('delete-modal');
}

// =============================================================================
// MODAL & TOAST UTILITIES
// =============================================================================

function showModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function hideModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function showAdminSuccessToast(message) {
  let toast = document.getElementById('admin-success-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'admin-success-toast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: #2E7D32; color: #fff; padding: 12px 20px;
      border-radius: 8px; font-size: 0.9rem; font-weight: 600;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      animation: fadeInUp 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 4000);
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
