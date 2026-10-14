/**
 * ZARA — ZARAFIED STORE
 * Navigation Module: Mobile Drawer, Sticky Header & Scroll Handling
 */

export function initNavigation() {
  const header = document.querySelector('.site-header');
  const menuToggle = document.querySelector('.menu-toggle');
  const navDrawer = document.querySelector('.mobile-nav-drawer');
  const navBackdrop = document.querySelector('.mobile-nav-backdrop');
  const closeBtn = document.querySelector('.mobile-close-btn');
  const navLinks = document.querySelectorAll('.mobile-nav-link, .nav-link');

  // Sticky header shadow on scroll
  const handleScroll = () => {
    if (!header) return;
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // Mobile Drawer Toggle
  const openDrawer = () => {
    if (!navDrawer || !menuToggle) return;
    navDrawer.classList.add('is-open');
    if (navBackdrop) navBackdrop.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
  };

  const closeDrawer = () => {
    if (!navDrawer || !menuToggle) return;
    navDrawer.classList.remove('is-open');
    if (navBackdrop) navBackdrop.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    menuToggle.focus();
  };

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeDrawer);
  }

  if (navBackdrop) {
    navBackdrop.addEventListener('click', closeDrawer);
  }

  // Close on Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navDrawer?.classList.contains('is-open')) {
      closeDrawer();
    }
  });

  // Close drawer when any mobile nav link is clicked
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (navDrawer?.classList.contains('is-open')) {
        closeDrawer();
      }
    });
  });
}
