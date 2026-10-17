/**
 * ZARA — ZARAFIED STORE
 * Floating Draggable WhatsApp Contact Assistant Widget
 *
 * Requirements & Features:
 * - Significantly smaller than the previous card (compact FAB / pill by default).
 * - Draggable across screen on touch (Android/iOS) and mouse (Desktop).
 * - Strict 6px drag threshold: dragging never triggers accidental clicks or WhatsApp navigation.
 * - Stays strictly within the visible viewport bounds on all screen sizes.
 * - Smoothly expands into a refined, compact assistance panel when tapped.
 * - Respects user position preference during current session (sessionStorage).
 * - Keyboard accessible (Space/Enter to toggle, Escape to close).
 * - Preserves hydration hooks for siteSettings/welcomeCard.
 */

const STORAGE_POS_X = 'zarafied_contact_pos_x';
const STORAGE_POS_Y = 'zarafied_contact_pos_y';

export function initWelcomeCard() {
  const widget = document.getElementById('floating-contact-widget');
  const trigger = document.getElementById('contact-widget-trigger');
  const panel = document.getElementById('contact-widget-panel');
  const closeBtn = document.getElementById('contact-widget-close');
  const waLink = document.getElementById('contact-widget-wa-link');

  if (!widget || !trigger || !panel) return;

  // Restore saved session position if available and within viewport
  restoreSavedPosition(widget);

  // Toggle Panel Logic
  let isOpen = false;

  function openPanel() {
    isOpen = true;
    updatePanelOrientation(widget);
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePanel();
    });
  }

  // Close panel when clicking outside
  document.addEventListener('pointerdown', (e) => {
    if (isOpen && !widget.contains(e.target)) {
      closePanel();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closePanel();
      trigger.focus();
    }
  });

  // =========================================================================
  // DRAGGING MECHANICS (Pointer Events for Touch & Mouse)
  // =========================================================================
  let isPointerDown = false;
  let hasDragged = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  trigger.addEventListener('pointerdown', (e) => {
    // Only respond to primary mouse button or single touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    isPointerDown = true;
    hasDragged = false;
    startX = e.clientX;
    startY = e.clientY;

    const rect = widget.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    try {
      trigger.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  trigger.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    const distance = Math.hypot(deltaX, deltaY);

    // Suppress clicks once moved beyond 6px threshold
    if (!hasDragged && distance > 6) {
      hasDragged = true;
      widget.classList.add('is-dragging');
      // If panel is open when drag starts, collapse it
      if (isOpen) closePanel();
    }

    if (hasDragged) {
      e.preventDefault();
      let newLeft = initialLeft + deltaX;
      let newTop = initialTop + deltaY;

      // Clamp strictly within viewport
      const clamped = clampCoordinates(newLeft, newTop, widget.offsetWidth, widget.offsetHeight);
      applyWidgetPosition(widget, clamped.left, clamped.top);
    }
  });

  const endDrag = (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;

    try {
      trigger.releasePointerCapture(e.pointerId);
    } catch (_) {}

    widget.classList.remove('is-dragging');

    if (hasDragged) {
      // Save position to sessionStorage
      const rect = widget.getBoundingClientRect();
      savePosition(rect.left, rect.top);
      // Determine new panel direction based on final position
      updatePanelOrientation(widget);
    } else {
      // Pure tap / click -> Toggle panel
      togglePanel();
    }
  };

  trigger.addEventListener('pointerup', endDrag);
  trigger.addEventListener('pointercancel', endDrag);

  // Prevent drag-release from triggering any accidental nested link clicks
  trigger.addEventListener('click', (e) => {
    if (hasDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // Re-clamp on window resize
  window.addEventListener('resize', () => {
    const rect = widget.getBoundingClientRect();
    const clamped = clampCoordinates(rect.left, rect.top, widget.offsetWidth, widget.offsetHeight);
    applyWidgetPosition(widget, clamped.left, clamped.top);
    updatePanelOrientation(widget);
  });
}

/**
 * Bounds checking: keeps widget within visible viewport
 */
function clampCoordinates(left, top, width, height) {
  const margin = 12;
  const headerOffset = 70; // Below sticky header
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(headerOffset, window.innerHeight - height - margin);

  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(headerOffset, top), maxTop)
  };
}

function applyWidgetPosition(widget, left, top) {
  widget.style.left = `${Math.round(left)}px`;
  widget.style.top = `${Math.round(top)}px`;
  widget.style.right = 'auto';
  widget.style.bottom = 'auto';
}

function updatePanelOrientation(widget) {
  const rect = widget.getBoundingClientRect();
  const midX = window.innerWidth / 2;
  const midY = window.innerHeight / 2;

  // If in upper half of screen, open panel downwards
  if (rect.top < 240) {
    widget.classList.add('open-down');
  } else {
    widget.classList.remove('open-down');
  }

  // If in left half of screen, align panel to left
  if (rect.left < midX - 60) {
    widget.classList.add('align-left');
  } else {
    widget.classList.remove('align-left');
  }
}

function savePosition(left, top) {
  try {
    sessionStorage.setItem(STORAGE_POS_X, Math.round(left));
    sessionStorage.setItem(STORAGE_POS_Y, Math.round(top));
  } catch (_) {}
}

function restoreSavedPosition(widget) {
  try {
    const savedX = sessionStorage.getItem(STORAGE_POS_X);
    const savedY = sessionStorage.getItem(STORAGE_POS_Y);

    if (savedX !== null && savedY !== null) {
      const left = parseFloat(savedX);
      const top = parseFloat(savedY);

      if (!isNaN(left) && !isNaN(top)) {
        // Ensure within current viewport in case orientation changed
        const clamped = clampCoordinates(left, top, 50, 50);
        applyWidgetPosition(widget, clamped.left, clamped.top);
        updatePanelOrientation(widget);
      }
    }
  } catch (_) {}
}
