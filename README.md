# ZARA — ZARAFIED STORE
## Layer 1, 2 & 3: Brand Foundation, Firebase Architecture & Dynamic Product CMS

### Brand Identity
- **Brand Name:** ZARA — ZARAFIED STORE
- **Tagline:** “Wear your story.”
- **Official Email:** `Janetzara97@gmail.com`
- **WhatsApp:** `+234 814 304 9193` (`https://wa.me/2348143049193`)
- **Location:** Ogborhill, Aba, Abia State, Nigeria
- **Palette:**
  - Warm cream: `#FFF5F0`
  - Deep plum: `#442438`
  - Berry: `#A64F65`
  - Coral: `#F17B70`
  - Gold: `#D5AD67`
  - Dark text: `#252128`

---

### Layer 1, 2 & 3 Architecture & Technology
- **HTML5** with semantic landmark structure and accessible ARIA attributes
- **CSS3** (Vanilla CSS) structured with modern design tokens, modular stylesheets, fluid responsive grid, and accessible modal overlays:
  - `styles/tokens.css` — Global typography, spacing, elevations, and luxury brand palette
  - `styles/base.css` — CSS reset, base typography, and accessibility utilities
  - `styles/components.css` — Navigation, buttons, slideshow, collection cards, shop catalogue filters, outfit cards, and detail modal
  - `styles/admin.css` — Complete responsive administrative dashboard, stats cards, product table, and upload dropzones
- **Vanilla JavaScript (ES Modules)**:
  - `scripts/nav.js` — Mobile navigation drawer and sticky header scroll observer
  - `scripts/slideshow.js` — Automatic fashion showcase carousel (4.5s advance, hover/focus pause, manual arrows, dots, swipe, keyboard)
  - `scripts/welcome-card.js` — Dismissible owner welcome card with session storage frequency control
  - `scripts/firebase-config.js` — Isolated Firebase modular SDK initialization with graceful standby mode
  - `scripts/cloudinary.js` — Cloudinary unsigned upload client with strict 4.5MB ceiling, MIME validation, and upload progress feedback
  - `scripts/compressor.js` — Client-side adaptive image compressor with progressive quality reduction, max 2000px dimension capping, and transparency preservation
  - `scripts/products-service.js` — Cloud Firestore product CRUD and query service with currency formatting
  - `scripts/shop.js` — Dynamic public shop catalogue controller with category filters, loading skeleton shimmers, and WhatsApp ordering modal
  - `scripts/admin.js` — Authenticated admin dashboard controller with Firebase Auth, cryptographic custom claim checks, live compression feedback, and product modal management
  - `scripts/main.js` — Application entry point, scroll reveal observer, and service worker registration
- **Lightweight PWA Foundation**: `manifest.webmanifest` and `sw.js` (v6) with asset caching and Cloudinary bypass
- **Firebase Infrastructure & Security Rules**:
  - `firestore.rules` — Production-grade Cloud Firestore security rules (public read for `status == 'published'`, admin-only write)
  - `storage.rules` — Firebase Storage rules with image type validation and 5MB size limit
  - `firebase.json` — Hosting, Firestore, Storage, and Emulator configuration
  - `FIREBASE_ARCHITECTURE.md` — Complete architecture reference document

---

### Cloud Media & Image Upload Architecture (Cloudinary)
- **Cloud Name:** `dkeqnovyf`
- **Upload Preset:** `zara_product_images` (Unsigned)
- **Asset Folder:** `zara/products`
- **Automatic Browser Compression:**
  - Files are optimized locally in the browser before upload (`scripts/compressor.js`).
  - Output file size strictly capped at **4.5 MB** (safety ceiling below Cloudinary's 5 MB limit).
  - Maximum dimension capped at 2,000 pixels (longest side) without upscaling small images.
  - WebP preference with alpha transparency preservation; progressive quality adaptation.
  - Live feedback badge shows original vs. optimized file size and reduction percentage.
- **Security Model:**
  - Front-end code does not include any API secrets.
  - While unsigned presets can receive direct uploads from anyone observing the network request, the store catalogue is guarded by Firestore Security Rules: only authenticated administrators holding `{ admin: true }` custom claims can attach image URLs to the Firestore `products` collection.
  - Public queries strictly filter for `status == 'published'`. Unlinked uploads in Cloudinary remain orphaned and invisible to the public.

---

### Admin Portal (`admin.html`)
- Dedicated administrative interface accessible via footer link or directly at `/admin.html`.
- Secure Email/Password authentication.
- Cryptographic verification of Firebase Auth custom claims (`request.auth.token.admin == true`).
- Real-time catalogue statistics: Total, Published, and Draft outfits.
- Complete product management: add outfit, edit details, replace photograph, toggle live publish/unpublish, and delete with confirmation.
- Drag-and-drop Cloudinary photo upload dropzone with progress bar.

---

### Public Shop Catalogue
- Seamlessly integrated into the approved `#collections` section of `index.html`.
- Category filtering: All Outfits, Ready-to-Wear, Two-Piece Sets, Gowns & Dresses, Custom & Bespoke.
- Reads directly from Cloud Firestore `products` collection (`status == 'published'`).
- Renders high-quality Cloudinary photography with NGN currency formatting and availability indicators.
- Outfit detail modal with one-click WhatsApp order inquiry directly to `+234 814 304 9193`.

---

### Local Development & Preview
To serve locally for preview:
```bash
python -m http.server 8085
# or
npx serve .
```
Open `http://localhost:8085` in any modern browser.
Admin portal: `http://localhost:8085/admin.html`.
