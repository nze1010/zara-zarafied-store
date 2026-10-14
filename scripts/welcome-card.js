/**
 * ZARA — ZARAFIED STORE
 * Welcome Card Module (Step 6)
 * - Introduces the owner with actual portrait
 * - Non-blocking floating corner card
 * - At most once per browsing session (sessionStorage with graceful error handling)
 * - Accessible dismiss controls and reduced-motion compliance
 */

const STORAGE_KEY = 'zarafied_welcome_card_dismissed';

export function initWelcomeCard() {
  const card = document.getElementById('welcome-card');
  const closeBtn = document.getElementById('welcome-close-btn');
  const actionLink = document.querySelector('.welcome-action-link');

  if (!card) return;

  // Graceful sessionStorage check
  let isDismissed = false;
  try {
    isDismissed = window.sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch (error) {
    // If storage is unavailable (e.g. private mode or disabled cookies),
    // default to showing once during the current script runtime
    isDismissed = false;
  }

  if (isDismissed) {
    card.remove();
    return;
  }

  // Dismiss handler
  const dismissCard = () => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch (e) {
      // Gracefully handle storage errors
    }

    card.classList.remove('is-visible');
    card.classList.add('is-dismissing');

    // Remove from DOM after fade out
    setTimeout(() => {
      card.remove();
    }, 400);
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', dismissCard);
  }

  if (actionLink) {
    actionLink.addEventListener('click', () => {
      dismissCard();
    });
  }

  // Check reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal card after initial homepage render without delaying user actions
  const revealDelay = prefersReducedMotion ? 600 : 1200;
  setTimeout(() => {
    if (document.body.contains(card)) {
      card.classList.add('is-visible');
    }
  }, revealDelay);
}
