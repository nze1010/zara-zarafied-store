# ZARA — ZARAFIED STORE
## Layer 1: Project Foundation & Approved Homepage Development

### Brand Identity
- **Brand Name:** ZARA — ZARAFIED STORE
- **Tagline:** “Wear your story.”
- **Palette:**
  - Warm cream: `#FFF5F0`
  - Deep plum: `#442438`
  - Berry: `#A64F65`
  - Coral: `#F17B70`
  - Gold: `#D5AD67`
  - Dark text: `#252128`

---

### Layer 1 Approved Scope & Architecture
This project is built strictly using:
- **HTML5** with semantic landmark structure and accessible ARIA attributes
- **CSS3** (Vanilla CSS) structured with modern design tokens, modular stylesheets, and fluid responsive design
- **Vanilla JavaScript (ES Modules)**:
  - `scripts/nav.js` — Mobile navigation drawer and sticky header scroll observer
  - `scripts/slideshow.js` — Fashion showcase carousel with manual controls, dot pagination, keyboard arrows, and touch gesture support
  - `scripts/welcome-card.js` — Dismissible owner welcome card with session storage frequency control and graceful error handling
  - `scripts/main.js` — Application entry point, scroll reveal observer, and service worker registration
- **Lightweight PWA Foundation**: `manifest.webmanifest` and `sw.js` for offline shell caching
- **Firebase-Ready Architecture**: `firebase.json` pre-configured for Firebase Hosting

---

### Brand Assets & Usage (`ZARA_ASSETS/`)
All assets were located, safely extracted from `ZARA_ASSETS_Layer1(1).zip` in the Downloads directory, verified for file integrity, and organized preserving their exact structure:
- `ZARA_ASSETS/brand/zara-logo.png` — Refined brand logo (without the decorative flower beside the final A).
- `ZARA_ASSETS/owner/owner-portrait-red-dress.png` — Primary owner portrait in red dress used in the hero section and welcome card.
- `ZARA_ASSETS/owner/owner-outfit-reference-collage.png` — Supporting visual reference in the Designer Story section.
- `ZARA_ASSETS/fashion/signature-fashion-01-ankara.png` — Signature Ankara peplum tailored piece.
- `ZARA_ASSETS/fashion/signature-fashion-02-paired-looks.png` — Paired elegance & coordinated trouser sets.
- `ZARA_ASSETS/fashion/signature-fashion-03-colourful-dress.png` — Radiant flora flowing gown.

---

### Homepage Shell Sections
1. **Responsive Announcement Bar & Navigation:** Accessible header, brand logo, desktop links, mobile drawer navigation, inquiry CTA.
2. **Owner-Led Hero:** Actual owner portrait, headline "Wear your story.", brand statement, and primary/secondary CTAs.
3. **Signature Fashion Slideshow:** Manual previous/next buttons, dot indicators, slide counter, touch swipe gestures, and keyboard navigation.
4. **Featured Collections Preview:** Clearly distinguishes **Ready-to-Wear (RTW)** from **Custom Designs (Bespoke Atelier)** with features, sizing, and notice of upcoming dynamic catalogue integration.
5. **Designer Story Preview:** Founder's creative vision, supporting outfit collage, and brand quote.
6. **Customer Review Placeholder:** Authentic placeholder without fabricated testimonials, highlighting the upcoming verified review integration and atelier fit guarantees.
7. **Contact & Atelier Information:** Direct studio contact placeholders, email, consultation schedule, and comprehensive footer.
8. **Dismissible Welcome Card:** Owner portrait thumbnail, non-blocking layout, dismissible button, displayed at most once per browsing session via `sessionStorage`, reduced-motion aware.

---

### Local Development
To serve locally for preview:
```bash
python -m http.server 8080
# or
npx serve .
```
Open `http://localhost:8080` in any modern browser.

---

### Future Firebase Architecture (Layer 2+)
- **Firebase Hosting:** Global CDN deployment for static shell.
- **Cloud Firestore:** Database for dynamic product catalogue, client reviews, bespoke consultations, and order records.
- **Firebase Storage:** Secure storage for admin-uploaded product images and lookbook media.
- **Firebase Authentication:** Admin portal login and optional customer accounts.
