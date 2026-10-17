/**
 * ZARA — ZARAFIED STORE
 * PWA Installation Experience & Platform-Specific Guide
 *
 * Capabilities:
 * - Detects standalone display mode (installed) to prevent duplicate prompts.
 * - Captures `beforeinstallprompt` event on supported browsers (Chrome, Edge, Android).
 * - Exposes easy-to-discover install entry points:
 *   1. Inside mobile navigation drawer (#btn-pwa-install-drawer)
 *   2. Non-intrusive first-visit install banner (#pwa-install-banner) with dismissal cooldown
 * - Provides tailored modal guide for iOS Safari (Share -> Add to Home Screen) and unsupported desktop browsers.
 * - Tracks `appinstalled` event and gracefully updates UI.
 */

const STORAGE_DISMISSED = 'zarafied_pwa_dismissed';
const STORAGE_INSTALLED = 'zarafied_pwa_installed';
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

let deferredPrompt = null;

export function initPWAInstall() {
  const drawerBtn = document.getElementById('btn-pwa-install-drawer');
  const banner = document.getElementById('pwa-install-banner');
  const bannerInstallBtn = document.getElementById('btn-pwa-install-banner');
  const bannerDismissBtn = document.getElementById('btn-pwa-dismiss-banner');
  const guideModal = document.getElementById('pwa-guide-modal');
  const guideCloseBtn = document.getElementById('btn-pwa-guide-close');
  const guideDoneBtn = document.getElementById('btn-pwa-guide-done');

  // Check if app is already running standalone / installed
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
    || window.navigator.standalone === true;

  if (isStandalone) {
    markInstalled();
    return; // Don't show prompts when running as PWA
  }

  // Detect platform
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOSSafari = isIOS && isSafari;

  // Show drawer install button
  if (drawerBtn) {
    drawerBtn.style.display = 'block';
    drawerBtn.addEventListener('click', () => {
      const closeNavBtn = document.getElementById('mobile-close-btn');
      if (closeNavBtn) closeNavBtn.click();
      triggerInstallFlow({ isIOSSafari, guideModal });
    });
  }

  // Handle native beforeinstallprompt (Android / Chrome / Edge)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show first-visit banner if not dismissed
    if (shouldShowBanner()) {
      // Delay slightly so it doesn't distract immediately upon landing
      setTimeout(() => {
        if (banner && shouldShowBanner()) {
          banner.style.display = 'flex';
          window.__ZARA_ANALYTICS__?.recordEvent('pwa_install_prompt', { platform: 'native' });
        }
      }, 3500);
    }
  });

  // If on iOS Safari, allow first-visit banner too
  if (isIOSSafari && shouldShowBanner()) {
    setTimeout(() => {
      if (banner && shouldShowBanner()) {
        banner.style.display = 'flex';
      }
    }, 4000);
  }

  // Banner Actions
  if (bannerInstallBtn) {
    bannerInstallBtn.addEventListener('click', () => {
      hideBanner(banner);
      triggerInstallFlow({ isIOSSafari, guideModal });
    });
  }

  if (bannerDismissBtn) {
    bannerDismissBtn.addEventListener('click', () => {
      dismissBanner(banner);
    });
  }

  // Guide Modal Close
  const closeGuide = () => {
    if (guideModal) {
      guideModal.style.display = 'none';
      guideModal.setAttribute('aria-hidden', 'true');
    }
  };

  if (guideCloseBtn) guideCloseBtn.addEventListener('click', closeGuide);
  if (guideDoneBtn) guideDoneBtn.addEventListener('click', closeGuide);
  if (guideModal) {
    guideModal.addEventListener('click', (e) => {
      if (e.target === guideModal) closeGuide();
    });
  }

  // Handle successful installation
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    markInstalled();
    window.__ZARA_ANALYTICS__?.recordEvent('pwa_install_accepted');
    if (banner) banner.style.display = 'none';
    if (drawerBtn) drawerBtn.style.display = 'none';
    closeGuide();
  });
}

/**
 * Trigger appropriate installation mechanism based on browser capabilities
 */
async function triggerInstallFlow({ isIOSSafari, guideModal }) {
  // If native prompt is available
  if (deferredPrompt) {
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        markInstalled();
      }
      deferredPrompt = null;
    } catch (_) {
      showGuideModal(guideModal, 'general');
    }
    return;
  }

  // If on iOS Safari
  if (isIOSSafari) {
    showGuideModal(guideModal, 'ios');
    return;
  }

  // Fallback for general browsers (Android Chrome without deferred prompt or Desktop)
  showGuideModal(guideModal, 'general');
}

/**
 * Render platform-specific installation instructions inside modal
 */
function showGuideModal(guideModal, platform) {
  if (!guideModal) return;

  const subtitle = document.getElementById('pwa-guide-platform-text');
  const stepsContainer = document.getElementById('pwa-guide-steps');

  if (platform === 'ios') {
    if (subtitle) subtitle.textContent = 'Install on iPhone & iPad';
    if (stepsContainer) {
      stepsContainer.innerHTML = `
        <div class="pwa-guide-steps-list">
          <div class="pwa-step-item">
            <span class="pwa-step-num">1</span>
            <div>Tap the <strong>Share</strong> button in Safari's bottom navigation bar <span class="pwa-step-icon">⎙</span>.</div>
          </div>
          <div class="pwa-step-item">
            <span class="pwa-step-num">2</span>
            <div>Scroll down in the sharing options and tap <strong>"Add to Home Screen"</strong> <span class="pwa-step-icon">⊞</span>.</div>
          </div>
          <div class="pwa-step-item">
            <span class="pwa-step-num">3</span>
            <div>Tap <strong>Add</strong> in the top-right corner to place ZARAFIED on your home screen.</div>
          </div>
        </div>
      `;
    }
  } else {
    if (subtitle) subtitle.textContent = 'Install to your device';
    if (stepsContainer) {
      stepsContainer.innerHTML = `
        <div class="pwa-guide-steps-list">
          <div class="pwa-step-item">
            <span class="pwa-step-num">1</span>
            <div>Open your browser options menu (<span class="pwa-step-icon">⋮</span> or <span class="pwa-step-icon">⋯</span>).</div>
          </div>
          <div class="pwa-step-item">
            <span class="pwa-step-num">2</span>
            <div>Select <strong>"Install ZARAFIED STORE"</strong> or <strong>"Add to Home screen"</strong>.</div>
          </div>
          <div class="pwa-step-item">
            <span class="pwa-step-num">3</span>
            <div>Confirm by tapping <strong>Install</strong>.</div>
          </div>
        </div>
      `;
    }
  }

  guideModal.style.display = 'flex';
  guideModal.setAttribute('aria-hidden', 'false');
}

function shouldShowBanner() {
  try {
    if (localStorage.getItem(STORAGE_INSTALLED) === 'true') return false;
    const dismissedTime = localStorage.getItem(STORAGE_DISMISSED);
    if (dismissedTime) {
      const elapsed = Date.now() - parseInt(dismissedTime, 10);
      if (elapsed < DISMISS_COOLDOWN_MS) return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function dismissBanner(banner) {
  if (banner) banner.style.display = 'none';
  try {
    localStorage.setItem(STORAGE_DISMISSED, Date.now().toString());
  } catch (_) {}
}

function hideBanner(banner) {
  if (banner) banner.style.display = 'none';
}

function markInstalled() {
  try {
    localStorage.setItem(STORAGE_INSTALLED, 'true');
  } catch (_) {}
}
