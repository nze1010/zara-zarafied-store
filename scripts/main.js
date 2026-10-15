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

  // 8. Service worker
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker
      .register('./sw.js')
      .catch(() => { /* silent in dev */ });
  }
});

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
      if (headerLogo) headerLogo.src = brandSettings.logoUrl;
      const footerLogo = document.getElementById('footer-brand-logo');
      if (footerLogo) footerLogo.src = brandSettings.logoUrl;
    }
    if (brandSettings?.faviconUrl) {
      const favicon = document.querySelector("link[rel*='icon']");
      if (favicon) favicon.href = brandSettings.faviconUrl;
    }

    // 2. Hero Section
    const heroSettings = settings.hero || SETTINGS_DEFAULTS.hero;
    const heroImg = document.getElementById('hero-portrait-img');
    if (heroImg && heroSettings.imageUrl) {
      heroImg.src = heroSettings.imageUrl;
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
      aboutImg.src = aboutSettings.imageUrl;
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

    // 4. Welcome Card
    const wcSettings = settings.welcomeCard || SETTINGS_DEFAULTS.welcomeCard;
    const welcomeImg = document.getElementById('welcome-avatar-img');
    if (welcomeImg && wcSettings.imageUrl) {
      welcomeImg.src = wcSettings.imageUrl;
      if (wcSettings.imageAlt) welcomeImg.alt = wcSettings.imageAlt;
    }
    const wcTitle = document.querySelector('.welcome-greeting-title');
    if (wcTitle && wcSettings.heading) wcTitle.textContent = wcSettings.heading;
    const wcCopy = document.querySelector('.welcome-greeting-copy');
    if (wcCopy && wcSettings.body) wcCopy.textContent = wcSettings.body;
    const wcLink = document.querySelector('.welcome-action-link');
    if (wcLink && wcSettings.linkLabel) wcLink.textContent = wcSettings.linkLabel;

    // Welcome card visibility (enabled:false hides card before it's shown)
    if (wcSettings.enabled === false) {
      const wcCard = document.getElementById('welcome-card');
      if (wcCard) wcCard.remove();
    }

  } catch (err) {
    // Settings hydration is optional — never disrupt user experience
    console.info('[ZARAFIED]: Using static defaults (settings hydration unavailable).', err?.message);
  }
}
