# ZARA — ZARAFIED STORE
## Layer 1 & Layer 2: Foundation, Refined Homepage & Firebase Infrastructure

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

### Layer 1 & 2 Architecture & Technology
- **HTML5** with semantic landmark structure and accessible ARIA attributes
- **CSS3** (Vanilla CSS) structured with modern design tokens, modular stylesheets, and fluid responsive design
- **Vanilla JavaScript (ES Modules)**:
  - `scripts/nav.js` — Mobile navigation drawer and sticky header scroll observer
  - `scripts/slideshow.js` — Automatic fashion showcase carousel (4.5s advance, hover/focus pause, manual arrows, dots, swipe, keyboard)
  - `scripts/welcome-card.js` — Dismissible owner welcome card with session storage frequency control and graceful error handling
  - `scripts/firebase-config.js` — Isolated Firebase modular SDK initialization with graceful standby mode
  - `scripts/main.js` — Application entry point, scroll reveal observer, and service worker registration
- **Lightweight PWA Foundation**: `manifest.webmanifest` and `sw.js` for offline shell caching
- **Firebase Infrastructure & Security Rules**:
  - `firestore.rules` — Production-grade Cloud Firestore security rules (least privilege, default deny)
  - `storage.rules` — Firebase Storage rules with image type validation and 5MB size limit
  - `firebase.json` — Hosting, Firestore, Storage, and Emulator configuration
  - `FIREBASE_ARCHITECTURE.md` — Detailed data models (`products`, `portfolio`, `orders`, `customEnquiries`, `reviews`, `siteSettings`), storage hierarchy, and custom claim admin authorization

---

### Brand Assets & Usage (`ZARA_ASSETS/`)
- `ZARA_ASSETS/brand/zara-logo.png` — Brand logo.
- `ZARA_ASSETS/owner/owner-portrait-red-dress.png` — Primary owner portrait in red dress used in the hero section and welcome card.
- `ZARA_ASSETS/owner/owner-outfit-reference-collage.png` — Visual reference in the Designer Story section.
- `ZARA_ASSETS/fashion/signature-fashion-01-ankara.png` — Signature Ankara tailored look.
- `ZARA_ASSETS/fashion/signature-fashion-02-paired-looks.png` — Matching two-piece set.
- `ZARA_ASSETS/fashion/signature-fashion-03-colourful-dress.png` — Flowing statement dress.

---

### Refined Homepage Sections
1. **Direct Header & Clean Navigation:** Brand logo and ZARA wordmark, Home, Shop, Custom Designs, About, Contact, and a prominent "Chat on WhatsApp" action button. (Announcement bar removed).
2. **Refined Hero Section:** Featuring the actual owner portrait, headline "Wear your story.", supporting text: *"Beautiful outfits, made to express your style. Discover our fashion collections or let us create something special just for you."*, and primary/secondary CTAs ("Explore Collections" & "Custom Designs").
3. **Automatic Signature Creations Slideshow:** Automatic rotation every 4.5 seconds with pause on interaction/hover, manual previous/next controls, dot pagination, and natural focus on fashion photography.
4. **Simplified Collections Section:** Two clear cards for **Ready-to-Wear** (*"Explore available styles and find an outfit you love."* / *“Explore Styles”*) and **Custom Designs** (*"Have something special in mind? Let’s create an outfit that suits you."* / *“Discuss Your Design”*).
5. **Personal Designer Story:** Warm, concise, and professional narrative introducing the founder and creative idea behind ZARAFIED with the single action *“Meet the Designer”*.
6. **Customer Reviews Section:** Clean placeholder for upcoming verified client reviews with a warm invitation to share feedback (*no fabricated testimonials*).
7. **Contact & Enquiries:** Direct WhatsApp chat action (+234 814 304 9193), official email (Janetzara97@gmail.com), and Ogborhill, Aba, Abia State location note.
8. **Compact Footer:** Clean essential navigation, direct WhatsApp/email contact, location, and copyright.
9. **Dismissible Welcome Card:** Owner portrait thumbnail, non-blocking layout, dismissible button, displayed at most once per browsing session via `sessionStorage`, reduced-motion aware.

---

### Local Development & Preview
To serve locally for preview:
```bash
python -m http.server 8085
# or
npx serve .
```
Open `http://localhost:8085` in any modern browser.

---

### Firebase Infrastructure & Cloud Configuration
- **Firebase Project ID:** `zarastore-17250` (Display name: `zarastore`, Project Number: `370409615096`)
- **Registered Web App:** `zarafiedstore` (`1:370409615096:web:620bbc0b6277358b02150d`)
- **Cloud Firestore:** Database `(default)` in `europe-west1` (`FIRESTORE_NATIVE`) — **Live & Active**
- **Firebase Authentication:** Tenant Active & Live; **Email/Password** Provider **ENABLED**; `scripts/grant-admin.cjs` prepared for `Janetzara97@gmail.com`
- **Firebase Storage:** API enabled; rules prepared; bucket creation blocked by Google Cloud requirement to link a billing account (Blaze plan)
- **Security Rules:**
  - `firestore.rules`: **Deployed to `zarastore-17250` & Verified**; public read on published products/portfolio and approved reviews; admin-only writes; orders and enquiries kept strictly confidential.
  - `storage.rules`: Strict 5MB limit, `image/*` MIME check, admin-only write/delete for `/products/`, `/portfolio/`, and `/brand/`.
- **Configured Hosting Site:** `zarafiedstore` -> [https://zarafiedstore.web.app](https://zarafiedstore.web.app) (Site created & verified; public deployment withheld pending Layer 3 approval).
- Full architecture, schemas, and operational details: See [FIREBASE_ARCHITECTURE.md](file:///c:/Users/COLLINS/Desktop/zarafied/FIREBASE_ARCHITECTURE.md).
