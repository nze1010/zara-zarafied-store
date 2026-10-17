/**
 * ZARA — ZARAFIED STORE
 * Main Application Entry Point (ES Modules)
 *
 * Boot order:
 * 1. Navigation (immediate — no async dependencies)
 * 2. Firebase init (non-blocking)
 * 3. Site settings hydration (hero, about, welcome card portraits from Firestore)
 * 4. Slideshow (async — loads published products from Firestore)
 * 5. Welcome card (after settings may update portrait)
 * 6. Public shop catalogue
 * 7. Scroll reveal observer
 * 8. Service worker registration
 */

import { initNavigation } from './nav.js';
import { initSlideshow } from './slideshow.js';
import { initWelcomeCard } from './welcome-card.js';
import { initFirebase } from './firebase-config.js';
import { initShop } from './shop.js';
import { getAllPublicSettings, SETTINGS_DEFAULTS } from './settings-service.js';
import { initPWAInstall } from './pwa-install.js';
import { buildOptimizedImageUrl } from './cloudinary.js?v=2';
import { analyticsTracker } from './analytics-tracker.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Navigation (synchronous — no deps)
  initNavigation();

  // 2. Firebase (non-blocking)
  initFirebase();

  // 3. Hydrate page from siteSettings (best-effort, never blocks page)
  hydrateFromSettings();

  // 4. Dynamic slideshow (async, loads products from Firestore)
  initSlideshow();

  // 5. Welcome card
  initWelcomeCard();

  // 6. Dynamic public shop
  initShop();

  // 7. Scroll reveal animations
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealElements = document.querySelectorAll('.reveal-on-scroll');

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealElements.forEach(el => el.classList.add('is-revealed'));
  } else {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealElements.forEach(el => observer.observe(el));
  }

  // 8. Service worker registration & update lifecycle
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    initServiceWorkerUpdate();
  }

  // 9. PWA Installation Experience
  initPWAInstall();

  // 10. Privacy-Conscious Visitor Analytics
  analyticsTracker.init();
  setupAnalyticsClickListeners();
  initPrivacyNoticeModal();
});

/**
 * Global click attribution for WhatsApp and contact conversions
 */
function setupAnalyticsClickListeners() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('a, button');
    if (!target) return;

    const href = target.getAttribute('href') || '';
    const id = target.id || '';

    // WhatsApp link clicks
    if (href.includes('wa.me') || href.includes('whatsapp.com')) {
      let source = 'general_link';
      if (target.classList.contains('header-whatsapp-btn')) source = 'header';
      else if (target.closest('.mobile-nav-drawer')) source = 'mobile_drawer';
      else if (target.closest('#contact')) source = 'contact_section';
      else if (target.closest('.site-footer')) source = 'footer';
      else if (target.closest('#custom-designs')) source = 'custom_designs_section';
      else if (target.closest('#floating-contact-widget') || target.closest('#contact-widget-panel')) source = 'floating_widget';

      analyticsTracker.recordEvent('whatsapp_click', {
        source,
        targetHref: href.slice(0, 80)
      });
    }

    // Custom Design enquiry buttons
    if (href.includes('custom%20design') || href.includes('custom-designs') || id === 'btn-custom-design') {
      analyticsTracker.recordEvent('custom_design_enquiry', {
        source: id || 'custom_design_link'
      });
    }

    // Email link clicks
    if (href.startsWith('mailto:')) {
      analyticsTracker.recordEvent('contact_click', {
        type: 'email',
        address: href.replace('mailto:', '')
      });
    }
  }, { passive: true });
}

/**
 * Handle Service Worker lifecycle, update notifications, and clean reload
 */
function initServiceWorkerUpdate() {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      // Periodically check for updates when returning to the tab
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          reg.update().catch(() => {});
        }
      });

      // If a new worker is already waiting to activate
      if (reg.waiting) {
        showAppUpdateBanner(reg.waiting);
        return;
      }

      // Listen for newly installed workers
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showAppUpdateBanner(newWorker);
          }
        });
      });
    })
    .catch(() => { /* silent in dev */ });
}

/**
 * Show a small unobtrusive banner when a new release is ready
 */
function showAppUpdateBanner(waitingWorker) {
  if (document.getElementById('app-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'app-update-banner';
  banner.className = 'app-update-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.innerHTML = `
    <div class="update-banner-content">
      <span>✨ A new version of ZARAFIED is ready.</span>
      <button type="button" class="btn btn-primary btn-xs" id="btn-apply-update">Update</button>
      <button type="button" class="update-banner-close" id="btn-close-update" aria-label="Dismiss">&times;</button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('btn-apply-update')?.addEventListener('click', () => {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  document.getElementById('btn-close-update')?.addEventListener('click', () => {
    banner.remove();
  });
}

/**
 * Fetch siteSettings from Firestore and update DOM elements with managed values.
 * Safe to fail — never blocks or disrupts rendering.
 */
async function hydrateFromSettings() {
  try {
    const settings = await getAllPublicSettings();

    // 1. Brand Logo & Favicon
    const brandSettings = settings.brand || SETTINGS_DEFAULTS.brand;
    if (brandSettings?.logoUrl) {
      const headerLogo = document.getElementById('header-brand-logo');
      if (headerLogo) headerLogo.src = buildOptimizedImageUrl(brandSettings.logoUrl, { width: 120, crop: 'limit' });
      const footerLogo = document.getElementById('footer-brand-logo');
      if (footerLogo) footerLogo.src = buildOptimizedImageUrl(brandSettings.logoUrl, { width: 120, crop: 'limit' });
    }
    if (brandSettings?.faviconUrl) {
      const favicon = document.querySelector("link[rel*='icon']");
      if (favicon) favicon.href = brandSettings.faviconUrl;
    }

    // 2. Hero Section
    const heroSettings = settings.hero || SETTINGS_DEFAULTS.hero;
    const heroImg = document.getElementById('hero-portrait-img');
    if (heroImg && heroSettings.imageUrl) {
      heroImg.src = buildOptimizedImageUrl(heroSettings.imageUrl, { width: 900, crop: 'limit' });
      if (heroSettings.imageAlt) heroImg.alt = heroSettings.imageAlt;
    }
    const heroTitle = document.getElementById('hero-title');
    if (heroTitle && heroSettings.headline) {
      heroTitle.innerHTML = heroSettings.headline;
    }
    const heroDesc = document.getElementById('hero-desc');
    if (heroDesc && heroSettings.description) {
      heroDesc.textContent = heroSettings.description;
    }

    // 3. About Section
    const aboutSettings = settings.about || SETTINGS_DEFAULTS.about;
    const aboutImg = document.getElementById('about-collage-img');
    if (aboutImg && aboutSettings.imageUrl) {
      aboutImg.src = buildOptimizedImageUrl(aboutSettings.imageUrl, { width: 800, crop: 'limit' });
      if (aboutSettings.imageAlt) aboutImg.alt = aboutSettings.imageAlt;
    }
    const storyTitle = document.getElementById('story-title');
    if (storyTitle && aboutSettings.heading) {
      storyTitle.textContent = aboutSettings.heading;
    }
    const storyDesc1 = document.getElementById('story-desc-1');
    if (storyDesc1 && aboutSettings.paragraph1) {
      storyDesc1.textContent = aboutSettings.paragraph1;
    }
    const storyDesc2 = document.getElementById('story-desc-2');
    if (storyDesc2 && aboutSettings.paragraph2) {
      storyDesc2.textContent = aboutSettings.paragraph2;
    }

    // 4. Welcome Contact Widget
    const wcSettings = settings.welcomeCard || SETTINGS_DEFAULTS.welcomeCard;
    const welcomeImg = document.getElementById('welcome-avatar-img');
    const panelImg = document.getElementById('welcome-panel-avatar-img');
    if (welcomeImg && wcSettings.imageUrl) {
      welcomeImg.src = buildOptimizedImageUrl(wcSettings.imageUrl, { width: 120, crop: 'limit' });
      if (wcSettings.imageAlt) welcomeImg.alt = wcSettings.imageAlt;
    }
    if (panelImg && wcSettings.imageUrl) {
      panelImg.src = buildOptimizedImageUrl(wcSettings.imageUrl, { width: 120, crop: 'limit' });
      if (wcSettings.imageAlt) panelImg.alt = wcSettings.imageAlt;
    }
    const wcTitle = document.querySelector('.welcome-greeting-title');
    if (wcTitle && wcSettings.heading) wcTitle.textContent = wcSettings.heading;
    const wcCopy = document.querySelector('.welcome-greeting-copy');
    if (wcCopy && wcSettings.body) wcCopy.textContent = wcSettings.body;
    const wcLink = document.querySelector('.welcome-action-link');
    if (wcLink && wcSettings.linkLabel) {
      const linkSpan = wcLink.querySelector('span');
      if (linkSpan) {
        linkSpan.textContent = wcSettings.linkLabel;
      } else {
        wcLink.textContent = wcSettings.linkLabel;
      }
    }

    // Contact widget visibility (enabled:false hides widget)
    if (wcSettings.enabled === false) {
      const widget = document.getElementById('floating-contact-widget') || document.getElementById('welcome-card');
      if (widget) widget.remove();
    }

  } catch (err) {
    // Settings hydration is optional — never disrupt user experience
    console.info('[ZARAFIED]: Using static defaults (settings hydration unavailable).', err?.message);
  }
}

/**
 * Privacy & Analytics Notice Modal logic
 */
function initPrivacyNoticeModal() {
  const modal = document.getElementById('privacy-notice-modal');
  const openNavBtn = document.getElementById('btn-privacy-nav');
  const openBottomBtn = document.getElementById('btn-privacy-bottom');
  const closeBtn = document.getElementById('btn-privacy-modal-close');
  const doneBtn = document.getElementById('btn-privacy-modal-done');
  const toggleOptoutBtn = document.getElementById('btn-toggle-optout');
  const statusText = document.getElementById('optout-status-text');

  if (!modal) return;

  const updateOptoutUI = () => {
    const isOptedOut = localStorage.getItem('zara_analytics_optout') === 'true';
    if (toggleOptoutBtn) {
      toggleOptoutBtn.textContent = isOptedOut ? 'Enable Analytics' : 'Disable Analytics';
    }
    if (statusText) {
      statusText.textContent = isOptedOut
        ? 'Analytics tracking is currently disabled for this browser.'
        : 'Analytics collection is currently active for this browser.';
    }
  };

  const openModal = () => {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    updateOptoutUI();
  };

  const closeModal = () => {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  openNavBtn?.addEventListener('click', openModal);
  openBottomBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  doneBtn?.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  toggleOptoutBtn?.addEventListener('click', () => {
    const isCurrentlyOptedOut = localStorage.getItem('zara_analytics_optout') === 'true';
    if (isCurrentlyOptedOut) {
      localStorage.removeItem('zara_analytics_optout');
    } else {
      localStorage.setItem('zara_analytics_optout', 'true');
    }
    updateOptoutUI();
  });
}
