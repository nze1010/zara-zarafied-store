/**
 * ZARA — ZARAFIED STORE
 * Fashion Showcase Slideshow Module
 * - Automatic rotation every 4.5 seconds
 * - Pauses on hover, focus, and touch interaction
 * - Manual previous/next buttons and pagination dots
 * - Respects prefers-reduced-motion preferences
 * - Keyboard (left/right arrows) and mobile swipe support
 */

export function initSlideshow() {
  const slideshowWrapper = document.querySelector('.slideshow-wrapper');
  if (!slideshowWrapper) return;

  const track = slideshowWrapper.querySelector('.slides-track');
  const slides = slideshowWrapper.querySelectorAll('.slide-item');
  const prevBtn = document.getElementById('slide-prev');
  const nextBtn = document.getElementById('slide-next');
  const dots = slideshowWrapper.querySelectorAll('.slideshow-dot');
  const counter = document.getElementById('slide-counter');

  if (!track || slides.length === 0) return;

  let currentIndex = 0;
  const totalSlides = slides.length;
  const AUTO_PLAY_INTERVAL = 4500; // 4.5 seconds between slides
  let autoPlayTimer = null;
  let isPaused = false;

  // Check reduced-motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateSlideshow = (newIndex) => {
    // Handle wrap-around bounds
    if (newIndex < 0) {
      currentIndex = totalSlides - 1;
    } else if (newIndex >= totalSlides) {
      currentIndex = 0;
    } else {
      currentIndex = newIndex;
    }

    // Move track smoothly
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Update pagination dots
    dots.forEach((dot, idx) => {
      const isSelected = idx === currentIndex;
      dot.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      dot.setAttribute('tabindex', isSelected ? '0' : '-1');
    });

    // Update accessible counter
    if (counter) {
      counter.textContent = `${currentIndex + 1} of ${totalSlides}`;
    }

    // Update accessibility attributes for screen readers
    slides.forEach((slide, idx) => {
      if (idx === currentIndex) {
        slide.removeAttribute('aria-hidden');
      } else {
        slide.setAttribute('aria-hidden', 'true');
      }
    });
  };

  const nextSlide = () => {
    updateSlideshow(currentIndex + 1);
  };

  const prevSlide = () => {
    updateSlideshow(currentIndex - 1);
  };

  // Auto-play management
  const startAutoPlay = () => {
    if (prefersReducedMotion || autoPlayTimer !== null || isPaused) return;
    autoPlayTimer = setInterval(() => {
      nextSlide();
    }, AUTO_PLAY_INTERVAL);
  };

  const stopAutoPlay = () => {
    if (autoPlayTimer !== null) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  };

  const restartAutoPlay = () => {
    stopAutoPlay();
    startAutoPlay();
  };

  // Pause on hover & focus
  slideshowWrapper.addEventListener('mouseenter', () => {
    isPaused = true;
    stopAutoPlay();
  });

  slideshowWrapper.addEventListener('mouseleave', () => {
    isPaused = false;
    startAutoPlay();
  });

  slideshowWrapper.addEventListener('focusin', () => {
    isPaused = true;
    stopAutoPlay();
  });

  slideshowWrapper.addEventListener('focusout', () => {
    isPaused = false;
    startAutoPlay();
  });

  // Pause when page is hidden / tab switched
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoPlay();
    } else if (!isPaused) {
      startAutoPlay();
    }
  });

  // Manual Prev / Next Button Controls
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      prevSlide();
      restartAutoPlay();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextSlide();
      restartAutoPlay();
    });
  }

  // Pagination Dots
  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      updateSlideshow(idx);
      restartAutoPlay();
    });
  });

  // Keyboard navigation
  slideshowWrapper.setAttribute('tabindex', '0');
  slideshowWrapper.setAttribute('aria-label', 'Signature fashion gallery. Use left and right arrow keys to navigate.');
  slideshowWrapper.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prevSlide();
      restartAutoPlay();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      nextSlide();
      restartAutoPlay();
    }
  });

  // Mobile Touch Gestures
  let touchStartX = 0;
  let touchEndX = 0;

  slideshowWrapper.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
      stopAutoPlay();
    },
    { passive: true }
  );

  slideshowWrapper.addEventListener(
    'touchend',
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchEndX - touchStartX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) {
          prevSlide();
        } else {
          nextSlide();
        }
      }
      restartAutoPlay();
    },
    { passive: true }
  );

  // Initialize
  updateSlideshow(0);
  startAutoPlay();
}
