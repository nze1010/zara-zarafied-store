/**
 * ZARA — ZARAFIED STORE
 * Main Application Entry Point (ES Modules)
 */

import { initNavigation } from './nav.js';
import { initSlideshow } from './slideshow.js';
import { initWelcomeCard } from './welcome-card.js';
import { initFirebase } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Core Modules
  initNavigation();
  initSlideshow();
  initWelcomeCard();

  // Initialize Firebase Infrastructure (Graceful Standby Mode)
  initFirebase();

  // Scroll Reveal Animations with IntersectionObserver
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealElements = document.querySelectorAll('.reveal-on-scroll');

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    // Reveal immediately for reduced-motion or unsupported browsers
    revealElements.forEach((el) => el.classList.add('is-revealed'));
  } else {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            obs.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    revealElements.forEach((el) => observer.observe(el));
  }

  // Register Service Worker if supported (lightweight PWA foundation)
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        // Service worker registered safely
      })
      .catch((err) => {
        // Silently catch registration in development / file:// modes
      });
  }
});
