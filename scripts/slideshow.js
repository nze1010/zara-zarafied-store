/**
 * ZARA — ZARAFIED STORE
 * Fashion Showcase Slideshow Module
 * Handles manual previous/next navigation, slide indicators, keyboard & touch
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

  const updateSlideshow = (newIndex) => {
    // Handle bounds
    if (newIndex < 0) {
      currentIndex = totalSlides - 1;
    } else if (newIndex >= totalSlides) {
      currentIndex = 0;
    } else {
      currentIndex = newIndex;
    }

    // Move track
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Update dots
    dots.forEach((dot, idx) => {
      const isSelected = idx === currentIndex;
      dot.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      dot.setAttribute('tabindex', isSelected ? '0' : '-1');
    });

    // Update counter
    if (counter) {
      counter.textContent = `Look ${currentIndex + 1} of ${totalSlides}`;
    }

    // Update slides visibility for assistive tech
    slides.forEach((slide, idx) => {
      if (idx === currentIndex) {
        slide.removeAttribute('aria-hidden');
      } else {
        slide.setAttribute('aria-hidden', 'true');
      }
    });
  };

  // Event Listeners for Prev/Next Buttons
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      updateSlideshow(currentIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      updateSlideshow(currentIndex + 1);
    });
  }

  // Event Listeners for Pagination Dots
  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      updateSlideshow(idx);
    });
  });

  // Keyboard Navigation on Slideshow Wrapper
  slideshowWrapper.setAttribute('tabindex', '0');
  slideshowWrapper.setAttribute('aria-label', 'Signature Fashion Slideshow. Use left and right arrow keys to navigate looks.');
  slideshowWrapper.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      updateSlideshow(currentIndex - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      updateSlideshow(currentIndex + 1);
    }
  });

  // Touch Swipe Support for Mobile Devices
  let touchStartX = 0;
  let touchEndX = 0;

  slideshowWrapper.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );

  slideshowWrapper.addEventListener(
    'touchend',
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleGesture();
    },
    { passive: true }
  );

  const handleGesture = () => {
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swiped right -> Previous
        updateSlideshow(currentIndex - 1);
      } else {
        // Swiped left -> Next
        updateSlideshow(currentIndex + 1);
      }
    }
  };

  // Initialize first slide state
  updateSlideshow(0);
}
