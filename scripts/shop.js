/**
 * ZARA — ZARAFIED STORE
 * Public Dynamic Product Catalogue Component
 * 
 * Features:
 * - Dynamic loading of published Firestore products
 * - Category filtering (All, Ready-to-Wear, Two-Piece Sets, Gowns, Bespoke)
 * - Cloudinary image rendering with fallback handling
 * - Responsive product cards with availability badges
 * - Accessible Product Detail Modal with image gallery & WhatsApp ordering
 * - Graceful loading skeletons, empty state, and error recovery
 */

import { getPublishedProducts, formatCurrency } from './products-service.js';

let activeCategory = 'all';
let currentProducts = [];

/**
 * Initialize the Public Shop component
 */
export async function initShop() {
  const container = document.getElementById('shop-catalogue-container');
  if (!container) return;

  renderShopShell(container);
  setupFilterListeners();
  await loadAndRenderProducts();
}

/**
 * Render the HTML shell with filters, grid container, and detail modal
 * @param {HTMLElement} container 
 */
function renderShopShell(container) {
  container.innerHTML = `
    <!-- Category Filter Bar -->
    <div class="shop-filters-bar" role="tablist" aria-label="Product categories">
      <button type="button" class="filter-pill active" data-category="all" role="tab" aria-selected="true">All Outfits</button>
      <button type="button" class="filter-pill" data-category="ready-to-wear" role="tab" aria-selected="false">Ready-to-Wear</button>
      <button type="button" class="filter-pill" data-category="two-piece" role="tab" aria-selected="false">Two-Piece Sets</button>
      <button type="button" class="filter-pill" data-category="gowns" role="tab" aria-selected="false">Gowns & Dresses</button>
      <button type="button" class="filter-pill" data-category="bespoke" role="tab" aria-selected="false">Custom & Bespoke</button>
    </div>

    <!-- Live Product Grid / States -->
    <div class="shop-grid" id="shop-products-grid" aria-live="polite">
      <!-- Loading skeletons rendered initially -->
      ${renderSkeletons(3)}
    </div>
  `;

  // Ensure modal backdrop is mounted directly to document.body so that fixed positioning
  // is never trapped inside CSS transformed parent containers (.reveal-on-scroll)
  let modal = document.getElementById('product-detail-modal');
  if (!modal) {
    const modalEl = document.createElement('div');
    modalEl.className = 'product-modal-backdrop';
    modalEl.id = 'product-detail-modal';
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'modal-product-title');
    modalEl.innerHTML = `
      <div class="product-modal-card">
        <button type="button" class="modal-close-btn" id="modal-close-btn" aria-label="Close product details">&times;</button>
        <div class="modal-body" id="modal-body-content">
          <!-- Populated dynamically upon click -->
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
    modal = modalEl;
  } else if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  // Modal close handlers
  const closeBtn = document.getElementById('modal-close-btn');
  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('is-open')) {
      closeModal();
    }
  });
}

/**
 * Setup category filter button click listeners
 */
function setupFilterListeners() {
  const pills = document.querySelectorAll('.shop-filters-bar .filter-pill');
  pills.forEach((pill) => {
    pill.addEventListener('click', async () => {
      pills.forEach((p) => {
        p.classList.remove('active');
        p.setAttribute('aria-selected', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');

      activeCategory = pill.dataset.category || 'all';
      await loadAndRenderProducts();
    });
  });
}

/**
 * Fetch and render products based on active category
 */
async function loadAndRenderProducts() {
  const grid = document.getElementById('shop-products-grid');
  if (!grid) return;

  grid.innerHTML = renderSkeletons(3);

  try {
    const products = await getPublishedProducts(activeCategory);
    currentProducts = products;

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="shop-empty-state">
          <div class="empty-icon">&#10024;</div>
          <h3 class="empty-title">New Styles Dropping Soon</h3>
          <p class="empty-desc">
            We are currently tailoring new pieces for this collection. Feel free to request a custom design tailored specifically to your measurements.
          </p>
          <a 
            href="https://wa.me/2348143049193?text=Hello%20ZARAFIED,%20I%20would%20like%20to%20enquire%20about%20upcoming%20designs" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn btn-whatsapp btn-sm"
          >
            Chat with Designer
          </a>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map((product) => renderProductCard(product)).join('');

    // Attach card quick-view event listeners on image, title, and button
    grid.querySelectorAll('.product-card').forEach((card) => {
      const productId = card.dataset.id;
      card.querySelector('.card-image-wrapper')?.addEventListener('click', () => openModal(productId));
      card.querySelector('.product-title')?.addEventListener('click', () => openModal(productId));
      card.querySelector('.btn-view-product')?.addEventListener('click', () => openModal(productId));
    });
  } catch (error) {
    grid.innerHTML = `
      <div class="shop-error-state">
        <p class="error-msg">Unable to load catalogue items right now.</p>
        <button type="button" class="btn btn-outline btn-sm btn-retry" id="btn-retry-shop">Try Again</button>
      </div>
    `;
    document.getElementById('btn-retry-shop')?.addEventListener('click', loadAndRenderProducts);
  }
}

/**
 * Render single product card HTML
 * @param {Object} product 
 * @returns {string}
 */
function renderProductCard(product) {
  const imageUrl = product.mainImage?.secure_url || product.mainImage?.url || './ZARA_ASSETS/fashion/signature-fashion-01-ankara.png';
  const altText = product.mainImage?.alt || product.title;
  const formattedPrice = formatCurrency(product.price);

  const availabilityLabels = {
    in_stock: 'In Stock',
    made_to_order: 'Made to Order',
    out_of_stock: 'Sold Out'
  };
  const availabilityBadge = availabilityLabels[product.availability] || 'In Stock';
  const availabilityClass = product.availability === 'out_of_stock' ? 'badge-sold-out' : 'badge-available';

  const categoryLabels = {
    'ready-to-wear': 'Ready-to-Wear',
    'two-piece': 'Two-Piece Set',
    'gowns': 'Gown',
    'bespoke': 'Custom Design'
  };
  const categoryLabel = categoryLabels[product.category] || product.category;

  return `
    <article class="product-card" data-id="${product.id}">
      <div class="card-image-wrapper" title="Click to view details for ${escapeHtml(product.title)}" tabindex="0" role="button" aria-label="View ${escapeHtml(product.title)}">
        <img 
          src="${imageUrl}" 
          alt="${escapeHtml(altText)}" 
          class="product-card-img" 
          loading="lazy"
        >
        <span class="badge product-badge ${availabilityClass}">${availabilityBadge}</span>
      </div>
      <div class="product-card-content">
        <span class="product-category-tag">${escapeHtml(categoryLabel)}</span>
        <h3 class="product-title" title="${escapeHtml(product.title)}" tabindex="0" role="button">${escapeHtml(product.title)}</h3>
        <div class="product-price">${formattedPrice}</div>
        <button type="button" class="btn btn-outline btn-sm btn-view-product" aria-label="View details for ${escapeHtml(product.title)}">
          View Outfit &rarr;
        </button>
      </div>
    </article>
  `;
}

/**
 * Open detail modal for product
 * @param {string} productId 
 */
function openModal(productId) {
  const product = currentProducts.find((p) => p.id === productId);
  if (!product) return;

  const modal = document.getElementById('product-detail-modal');
  const modalBody = document.getElementById('modal-body-content');
  if (!modal || !modalBody) return;

  const formattedPrice = formatCurrency(product.price);
  const images = [product.mainImage, ...(product.additionalImages || [])].filter(Boolean);
  const primaryImg = images[0]?.secure_url || images[0]?.url || './ZARA_ASSETS/fashion/signature-fashion-01-ankara.png';
  let activeImageUrl = primaryImg;

  const availabilityLabels = {
    in_stock: 'In Stock',
    made_to_order: 'Made to Order',
    out_of_stock: 'Sold Out'
  };
  const isOutOfStock = product.availability === 'out_of_stock';
  const availabilityBadge = availabilityLabels[product.availability] || 'In Stock';
  const availabilityClass = isOutOfStock ? 'badge-sold-out' : 'badge-available';

  const categoryLabels = {
    'ready-to-wear': 'Ready-to-Wear',
    'two-piece': 'Two-Piece Set',
    'gowns': 'Gown',
    'bespoke': 'Custom Design'
  };
  const categoryLabel = categoryLabels[product.category] || product.category;

  const hasSizes = Array.isArray(product.availableSizes) && product.availableSizes.length > 0;
  let selectedSize = hasSizes && product.availableSizes.length === 1 ? product.availableSizes[0] : null;

  const sizesHtml = hasSizes
    ? `
      <div class="modal-sizes-group">
        <label class="modal-sizes-label">Available Sizes (Select One):</label>
        <div class="modal-sizes-selector" role="radiogroup" aria-label="Available Sizes">
          ${product.availableSizes.map(s => `
            <button 
              type="button" 
              class="size-pill-btn${selectedSize === s ? ' is-selected' : ''}" 
              data-size="${escapeHtml(s)}" 
              role="radio" 
              aria-checked="${selectedSize === s ? 'true' : 'false'}"
            >
              ${escapeHtml(s)}
            </button>
          `).join('')}
        </div>
        <div class="size-error-msg" id="modal-size-error" style="display:none;">
          ⚠️ Please select a size before proceeding to shop.
        </div>
      </div>
    `
    : '';

  const buttonText = isOutOfStock ? 'Enquire on WhatsApp' : 'Shop Now';
  const buttonClass = isOutOfStock ? 'btn btn-secondary btn-shop-now' : 'btn btn-whatsapp btn-shop-now';

  modalBody.innerHTML = `
    <div class="modal-grid">
      <div class="modal-gallery">
        <div class="modal-main-image-frame">
          <img src="${primaryImg}" alt="${escapeHtml(product.title)}" class="modal-main-img" id="modal-active-img">
        </div>
        ${images.length > 1 ? `
          <div class="modal-thumbnails-row">
            ${images.map((img, idx) => `
              <button type="button" class="modal-thumb-btn ${idx === 0 ? 'active' : ''}" data-src="${img.secure_url || img.url}" aria-label="View image ${idx + 1}">
                <img src="${img.secure_url || img.url}" alt="Thumbnail ${idx + 1}" class="modal-thumb-img">
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="modal-info">
        <div class="modal-availability-row">
          <span class="badge badge-coral">${escapeHtml(categoryLabel)}</span>
          <span class="badge ${availabilityClass}">${escapeHtml(availabilityBadge)}</span>
        </div>
        <h2 class="modal-product-title" id="modal-product-title">${escapeHtml(product.title)}</h2>
        <div class="modal-price">${formattedPrice}</div>
        <p class="modal-description">${escapeHtml(product.description || 'Handcrafted bespoke piece made with premium fabric, refined structure, and precision tailoring.')}</p>
        
        ${sizesHtml}
        
        <div class="modal-actions-group">
          <button type="button" class="${buttonClass}" id="btn-modal-shop-now">
            <span>💬</span> ${buttonText}
          </button>
          <a href="mailto:Janetzara97@gmail.com?subject=Enquiry%20regarding%20${encodeURIComponent(product.title)}" class="btn btn-outline btn-sm" style="width: 100%; text-align: center;">
            Email Fitting Enquiry
          </a>
        </div>
      </div>
    </div>
  `;

  // Attach thumbnail clicks to switch image and track active image URL
  modalBody.querySelectorAll('.modal-thumb-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      modalBody.querySelectorAll('.modal-thumb-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const activeImg = document.getElementById('modal-active-img');
      if (activeImg) activeImg.src = btn.dataset.src;
      activeImageUrl = btn.dataset.src;
    });
  });

  // Attach size selection clicks
  modalBody.querySelectorAll('.size-pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      modalBody.querySelectorAll('.size-pill-btn').forEach(b => {
        b.classList.remove('is-selected');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('is-selected');
      btn.setAttribute('aria-checked', 'true');
      selectedSize = btn.dataset.size;
      const errorMsg = document.getElementById('modal-size-error');
      if (errorMsg) errorMsg.style.display = 'none';
    });
  });

  // Attach "Shop Now" / "Enquire" click handler
  const shopNowBtn = document.getElementById('btn-modal-shop-now');
  shopNowBtn?.addEventListener('click', () => {
    // If sizes are available on this product and none selected, prompt customer
    if (hasSizes && !selectedSize && !isOutOfStock) {
      const errorMsg = document.getElementById('modal-size-error');
      if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }

    const resolvedImageUrl = activeImageUrl.startsWith('http')
      ? activeImageUrl
      : new URL(activeImageUrl, window.location.origin).href;

    let message = '';
    if (isOutOfStock) {
      message = [
        'Hello ZARAFIED STORE, I would like to enquire about this sold-out outfit:',
        '',
        `Product: ${product.title}`,
        `Price: ${formattedPrice}`,
        `Product image: ${resolvedImageUrl}`,
        `Product reference: ${product.id}`,
        '',
        'Please confirm if this piece can be restocked or made to order.'
      ].join('\n');
    } else {
      const lines = [
        'Hello ZARAFIED STORE, I want to shop this outfit.',
        '',
        `Product: ${product.title}`,
        `Price: ${formattedPrice}`
      ];
      if (selectedSize) {
        lines.push(`Size: ${selectedSize}`);
      }
      lines.push(`Product image: ${resolvedImageUrl}`);
      lines.push(`Product reference: ${product.id}`);
      lines.push('');
      lines.push('Please confirm availability and delivery details.');
      message = lines.join('\n');
    }

    const whatsappUrl = `https://wa.me/2348143049193?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  });

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

/**
 * Close product modal
 */
function closeModal() {
  const modal = document.getElementById('product-detail-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/**
 * Generate loading skeleton cards
 * @param {number} count 
 * @returns {string}
 */
function renderSkeletons(count) {
  return Array.from({ length: count })
    .map(() => `
      <div class="product-card skeleton-card" aria-hidden="true">
        <div class="skeleton-img shimmer"></div>
        <div class="skeleton-content">
          <div class="skeleton-line shimmer" style="width: 40%;"></div>
          <div class="skeleton-line shimmer" style="width: 80%; height: 20px;"></div>
          <div class="skeleton-line shimmer" style="width: 50%;"></div>
        </div>
      </div>
    `)
    .join('');
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

/**
 * Public export to allow opening product detail modal from external components (e.g. slideshow)
 * @param {string} productId 
 */
export function openProductModal(productId) {
  openModal(productId);
}

