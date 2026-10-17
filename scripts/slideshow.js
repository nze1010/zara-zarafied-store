/**
 * ZARA — ZARAFIED STORE
 * Signature Creations Gallery — Dynamic Firestore-Driven Slideshow
 *
 * Sources slides from published Firestore products automatically.
 * Falls back to hardcoded static assets if Firestore is unavailable.
 *
 * Features:
 * - Auto-advances every 3 seconds (configurable via siteSettings/gallery)
 * - Smooth CSS fade transition between slides (no abrupt cuts)
 * - Manual prev/next buttons, pagination dots, accessible slide counter
 * - Pause on hover, focus, page-hidden; respect prefers-reduced-motion
 * - Mobile touch swipe support
 * - Keyboard left/right arrow navigation
 * - Graceful empty state when no published products exist
 * - Clicking a slide navigates to that product in the Shop catalogue
 * - Prevents duplicate initialization
 */

import { getPublishedProducts } from './products-service.js';
import { SETTINGS_DEFAULTS } from './settings-service.js';
import { buildOptimizedImageUrl, buildResponsiveSrcSet } from './cloudinary.js?v=2';

// Static fallback slides used only when no Firestore products are available
const STATIC_FALLBACK_SLIDES = [
  {
    imageUrl: './ZARA_ASSETS/fashion/signature-fashion-01-ankara.png',
    title: 'Classic Ankara Style',
    category: 'Signature Look',
    description: 'Vibrant prints styled with bold structure and modern elegance.',
    productId: null
  },
  {
    imageUrl: './ZARA_ASSETS/fashion/signature-fashion-02-paired-looks.png',
    title: 'Matching Two-Piece Set',
    category: 'Coordinated Set',
    description: 'Effortless coordination designed for both everyday and special occasions.',
    productId: null
  },
  {
    imageUrl: './ZARA_ASSETS/fashion/signature-fashion-03-colourful-dress.png',
    title: 'Flowing Statement Dress',
    category: 'Statement Piece',
    description: 'Graceful draping and lively colors that bring warmth to any event.',
    productId: null
  }
];

let slideshowInitialized = false;

export async function initSlideshow() {
  // Prevent duplicate initialization
  if (slideshowInitialized) return;
  slideshowInitialized = true;

  const wrapper = document.getElementById('fashion-slideshow');
  if (!wrapper) return;

  // Use default interval without making extra blocking Firestore queries
  const intervalSeconds = SETTINGS_DEFAULTS.gallery.intervalSeconds;

  // Fetch published products from shared cached products service
  let slides = [];
  try {
    const products = await getPublishedProducts();
    if (products.length > 0) {
      slides = products
        .filter(p => p.mainImage?.secure_url || p.mainImage?.url)
        .slice(0, 16) // max 16 curated looks for gallery
        .map(p => ({
          imageUrl: p.mainImage.secure_url || p.mainImage.url,
          title: p.title,
          category: formatCategory(p.category),
          description: p.description || '',
          productId: p.id
        }));
    }
  } catch (_) { /* fall through to static */ }

  // Use static fallbacks if no product slides available
  if (slides.length === 0) {
    slides = STATIC_FALLBACK_SLIDES;
  }

  buildSlideshowDOM(wrapper, slides);
  initSlideshowBehavior(wrapper, slides, intervalSeconds);
}

function formatCategory(cat) {
  const map = {
    'ready-to-wear': 'Ready-to-Wear',
    'two-piece': 'Two-Piece Set',
    'gowns': 'Gown',
    'bespoke': 'Custom Design'
  };
  return map[cat] || cat || 'Signature Look';
}

/**
 * Build the slideshow DOM with progressive media loading
 * Slide 0: Eager optimized load
 * Slide 1: Next likely slide preloaded
 * Slide 2+: Lazy data-src hydrated on-demand before transition
 */
function buildSlideshowDOM(wrapper, slides) {
  const total = slides.length;

  const dotsHtml = slides.map((slide, idx) => `
    <button
      type="button"
      class="slideshow-dot${idx === 0 ? ' is-active' : ''}"
      role="tab"
      aria-selected="${idx === 0 ? 'true' : 'false'}"
      aria-label="Slide ${idx + 1}: ${escapeAttr(slide.title)}"
      tabindex="${idx === 0 ? '0' : '-1'}"
    ></button>
  `).join('');

  const slidesHtml = slides.map((slide, idx) => {
    const clickable = slide.productId
      ? `data-product-id="${escapeAttr(slide.productId)}" style="cursor:pointer;" role="button" tabindex="0"`
      : '';

    const optimizedUrl = buildOptimizedImageUrl(slide.imageUrl, { width: 750, crop: 'limit' });
    const srcset = buildResponsiveSrcSet(slide.imageUrl, [380, 600, 850]);
    const sizes = '(max-width: 600px) 100vw, (max-width: 1024px) 55vw, 650px';

    // Slide 0 and 1 receive src immediately; subsequent slides receive data-src
    const isUpfront = idx <= 1;
    const srcAttr = isUpfront ? `src="${escapeAttr(optimizedUrl)}"` : '';
    const srcsetAttr = (isUpfront && srcset) ? `srcset="${escapeAttr(srcset)}" sizes="${sizes}"` : '';
    const dataSrcAttr = !isUpfront ? `data-src="${escapeAttr(optimizedUrl)}"` : '';
    const dataSrcsetAttr = (!isUpfront && srcset) ? `data-srcset="${escapeAttr(srcset)}"` : '';

    return `
      <article
        class="slide-item${idx === 0 ? ' is-active' : ''}"
        role="group"
        aria-roledescription="slide"
        aria-label="${idx + 1} of ${total}"
        ${idx !== 0 ? 'aria-hidden="true"' : ''}
        ${clickable}
      >
        <div class="slide-media">
          <img
            ${srcAttr}
            ${srcsetAttr}
            ${dataSrcAttr}
            ${dataSrcsetAttr}
            alt="${escapeAttr(slide.title)}"
            class="slide-img"
            loading="${idx === 0 ? 'eager' : 'lazy'}"
            decoding="async"
            width="650"
            height="420"
          >
        </div>
        <div class="slide-content">
          <span class="slide-category">${escapeHtml(slide.category)}</span>
          <h3 class="slide-title">${escapeHtml(slide.title)}</h3>
          ${slide.description ? `<p class="slide-description">${escapeHtml(slide.description.slice(0, 120))}${slide.description.length > 120 ? '…' : ''}</p>` : ''}
          ${slide.productId ? `<span class="slide-shop-link">View in Shop →</span>` : ''}
        </div>
      </article>
    `;
  }).join('');

  wrapper.innerHTML = `
    <div class="slides-viewport">
      <div class="slides-track-fade" id="slides-track-fade">
        ${slidesHtml}
      </div>
    </div>

    <div class="slideshow-controls-bar">
      <div class="slideshow-nav-btns">
        <button type="button" class="slideshow-arrow" id="slide-prev" aria-label="Previous slide">&#10094;</button>
        <button type="button" class="slideshow-arrow" id="slide-next" aria-label="Next slide">&#10095;</button>
      </div>

      <div class="slideshow-dots" role="tablist" aria-label="Slideshow pagination">
        ${dotsHtml}
      </div>

      <span class="slide-counter" id="slide-counter" aria-live="polite">1 of ${total}</span>
    </div>
  `;
}

/**
 * Wire up slideshow behavior with IntersectionObserver, decode-before-switch, and smooth pausing
 */
function initSlideshowBehavior(wrapper, slides, intervalSeconds) {
  const total = slides.length;
  if (total === 0) return;

  let currentIndex = 0;
  let autoTimer = null;
  let isPaused = false;
  let isInViewport = false;
  let isTransitioning = false;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const AUTO_INTERVAL = Math.max(1000, intervalSeconds * 1000);

  const counter = wrapper.querySelector('#slide-counter');
  const prevBtn = wrapper.querySelector('#slide-prev');
  const nextBtn = wrapper.querySelector('#slide-next');
  const dots = wrapper.querySelectorAll('.slideshow-dot');
  const slideItems = wrapper.querySelectorAll('.slide-item');

  /**
   * Preload and decode a slide's image before displaying to prevent blank frames
   */
  async function prepareSlide(index) {
    if (index < 0 || index >= total) return;
    const slide = slideItems[index];
    if (!slide) return;
    const img = slide.querySelector('.slide-img');
    if (!img) return;

    if (img.dataset.src && !img.src) {
      img.src = img.dataset.src;
      if (img.dataset.srcset) {
        img.srcset = img.dataset.srcset;
        img.sizes = '(max-width: 600px) 100vw, (max-width: 1024px) 55vw, 650px';
      }
    }

    if ('decode' in img && !img.complete) {
      try {
        await img.decode();
      } catch (_) {
        // Continue even if decode is delayed
      }
    }
  }

  async function goTo(newIndex) {
    if (isTransitioning) return;
    isTransitioning = true;

    // Wrap around
    if (newIndex < 0) newIndex = total - 1;
    if (newIndex >= total) newIndex = 0;

    // Ensure target slide media is prepared and decoded before switching
    await prepareSlide(newIndex);

    // Hide current
    const oldSlide = slideItems[currentIndex];
    if (oldSlide) {
      oldSlide.classList.remove('is-active');
      oldSlide.setAttribute('aria-hidden', 'true');
    }
    if (dots[currentIndex]) {
      dots[currentIndex].classList.remove('is-active');
      dots[currentIndex].setAttribute('aria-selected', 'false');
      dots[currentIndex].setAttribute('tabindex', '-1');
    }

    currentIndex = newIndex;

    // Show new
    const newSlide = slideItems[currentIndex];
    if (newSlide) {
      newSlide.classList.add('is-active');
      newSlide.removeAttribute('aria-hidden');
    }
    if (dots[currentIndex]) {
      dots[currentIndex].classList.add('is-active');
      dots[currentIndex].setAttribute('aria-selected', 'true');
      dots[currentIndex].setAttribute('tabindex', '0');
    }
    if (counter) counter.textContent = `${currentIndex + 1} of ${total}`;

    isTransitioning = false;

    // Preload next upcoming slide in the background
    const nextIdx = (currentIndex + 1) % total;
    prepareSlide(nextIdx);
  }

  function startAuto() {
    if (prefersReducedMotion || autoTimer !== null || isPaused || !isInViewport || total <= 1) return;
    autoTimer = setInterval(() => {
      goTo(currentIndex + 1);
    }, AUTO_INTERVAL);
  }

  function stopAuto() {
    if (autoTimer !== null) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function restartAuto() {
    stopAuto();
    startAuto();
  }

  // IntersectionObserver: Pause slideshow when offscreen to save battery and network
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isInViewport = entry.isIntersecting && entry.intersectionRatio > 0.1;
        if (isInViewport) {
          startAuto();
        } else {
          stopAuto();
        }
      });
    }, { threshold: [0, 0.15] });
    observer.observe(wrapper);
  } else {
    isInViewport = true;
    startAuto();
  }

  // Hover/focus pausing
  wrapper.addEventListener('mouseenter', () => { isPaused = true; stopAuto(); });
  wrapper.addEventListener('mouseleave', () => { isPaused = false; startAuto(); });
  wrapper.addEventListener('focusin', () => { isPaused = true; stopAuto(); });
  wrapper.addEventListener('focusout', () => { isPaused = false; startAuto(); });

  // Page visibility (pause when tab is backgrounded)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAuto();
    } else if (!isPaused && isInViewport) {
      startAuto();
    }
  });

  // Prev/Next buttons
  prevBtn?.addEventListener('click', () => { goTo(currentIndex - 1); restartAuto(); });
  nextBtn?.addEventListener('click', () => { goTo(currentIndex + 1); restartAuto(); });

  // Dot buttons
  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => { goTo(idx); restartAuto(); });
  });

  // Keyboard
  wrapper.setAttribute('tabindex', '0');
  wrapper.setAttribute('aria-label', 'Signature fashion gallery. Use left and right arrow keys to navigate.');
  wrapper.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentIndex - 1); restartAuto(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentIndex + 1); restartAuto(); }
  });

  // Touch swipe
  let touchStartX = 0;
  wrapper.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; stopAuto(); }, { passive: true });
  wrapper.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(diff) > 40) goTo(diff > 0 ? currentIndex - 1 : currentIndex + 1);
    restartAuto();
  }, { passive: true });

  // Click to navigate to product in shop
  slideItems.forEach(slide => {
    const productId = slide.dataset.productId;
    if (!productId) return;
    const handler = async () => {
      const shopSection = document.getElementById('shop-catalogue');
      if (shopSection) {
        shopSection.scrollIntoView({ behavior: 'smooth' });
      }
      try {
        const { openProductModal } = await import('./shop.js');
        setTimeout(() => openProductModal(productId), 350);
      } catch (_) {}
    };
    slide.addEventListener('click', handler);
    slide.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
  });

  // Init
  goTo(0);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
