# ZARA — ZARAFIED STORE
## Layer 2 & 3: Firebase Infrastructure, Product CMS & Cloudinary Architecture Document

This document establishes the official database schema, security access model, media storage hierarchy, Cloudinary integration, and administrative content-management architecture for **ZARA — ZARAFIED STORE**.

---

## 0. Project Identity & Cloud Resources

| Resource | Setting / Value | Status |
|---|---|---|
| **Firebase Project Display Name** | `zarastore` | Active |
| **Firebase Project ID** | `zarastore-17250` | Active |
| **Project Number** | `370409615096` | Active |
| **Registered Web App** | `zarafiedstore` (`1:370409615096:web:620bbc0b6277358b02150d`) | Active & Integrated |
| **Preferred Hosting Site** | `zarafiedstore` (`https://zarafiedstore.web.app`) | Reserved & Created |
| **Cloud Firestore** | Database: `(default)` in `europe-west1` (`FIRESTORE_NATIVE`) | **Active & Live**; Production Rules Deployed & Verified |
| **Firebase Storage** | Bucket: `zarastore-17250.firebasestorage.app` | API Enabled; Rules Prepared; Blocked by Google requirement to link billing account (Blaze plan) |
| **Firebase Authentication** | Provider: Email/Password (Admin: `Janetzara97@gmail.com`) | **Active & Live**; Email/Password Provider Enabled; `scripts/grant-admin.cjs` prepared |
| **Cloudinary Media Cloud** | Cloud Name: `dkeqnovyf` | **Active & Live**; Zero billing/Spark-compatible |
| **Cloudinary Upload Preset** | Preset: `zara_product_images` (Unsigned) | **Active & Live**; Tested & Verified |
| **Cloudinary Asset Folder** | Folder: `zara/products` | Configured & Segregated |

---

## 1. Cloud Firestore Data Architecture

Cloud Firestore is organized around core logical collections designed with strict type validation, document identifier conventions, and audit timestamps.

### 1.1 Collection: `products` (Dynamic Catalogue)
- **Purpose:** Stores the ready-to-wear fashion catalogue, bespoke entries, inventory availability, sizing options, fabric details, pricing in Nigerian naira (NGN), and Cloudinary image asset identifiers.
- **Document ID Strategy:** Slug-based identifier or Firestore Auto-ID.
- **Publication Status:** `status` field: `'draft' | 'published'`.
- **Security:** Public visitors can strictly read documents where `status == 'published'`. All write, update, and delete actions require `request.auth.token.admin == true`.
- **Fields:**
  | Field | Type | Required | Description |
  |---|---|:---:|---|
  | `id` | `string` | Yes | Unique product identifier matching Firestore document ID |
  | `title` | `string` | Yes | Garment title (e.g. "Sculpted Ankara Evening Gown") |
  | `description` | `string` | No | Garment description, cut, fabric, and styling notes |
  | `category` | `string` | Yes | `'ready-to-wear' | 'two-piece' | 'gowns' | 'bespoke'` |
  | `price` | `number` | Yes | Numeric price in Nigerian Naira (NGN) (e.g., `45000`) |
  | `currency` | `string` | Yes | Currency code (`'NGN'`) |
  | `availability` | `string` | Yes | `'in_stock' | 'made_to_order' | 'out_of_stock'` |
  | `status` | `string` | Yes | Publication state: `'published' | 'draft'` |
  | `availableSizes` | `array<string>` | Yes | Array of supported sizes (e.g., `['UK 10', 'UK 12', 'Custom / Made-to-Measure']`) |
  | `mainImage` | `map` | Yes | Primary photograph metadata: `{ secure_url: string, url: string, public_id: string, format: string, bytes: number, alt: string }` |
  | `images` | `array<map>` | No | Optional additional gallery photography maps |
  | `featured` | `boolean` | No | Flag indicating highlight on homepage |
  | `createdAt` | `timestamp` | Yes | Server timestamp when the product was created |
  | `updatedAt` | `timestamp` | Yes | Server timestamp when last modified |
  | `createdBy` | `string` | Yes | UID or email of the administrator who created the entry |

---

### 1.2 Collection: `portfolio`
- **Purpose:** Bespoke made-to-measure showcase, client red-carpet looks, and custom couture commissions.
- **Publication Status:** `status` field: `'published' | 'draft'`.
- **Fields:** `id`, `title`, `category`, `description`, `images`, `status`, `displayOrder`, `createdAt`, `updatedAt`.

---

### 1.3 Collection: `orders`
- **Purpose:** Customer order records, line items, customer details, and delivery fulfillment state.
- **Security:** Confidential. Strictly accessible to authenticated administrators.

---

### 1.4 Collection: `customEnquiries`
- **Purpose:** Fitting consultations, bespoke couture inquiries, and special event commission requests.
- **Security:** Public write (with size and content validation); Admin-only read, update and delete.

---

### 1.5 Collection: `reviews`
- **Purpose:** Genuine customer reviews, event photos, and fit feedback.
- **Security:** Public can read only `status == 'approved'`. Submissions start as `'pending'`. Admin moderation required.

---

### 1.6 Collection: `siteSettings`
- **Purpose:** Public contact information, studio announcements, and store settings.
- **Confirmed business information:**
  - `brandName`: `"ZARA — ZARAFIED STORE"`
  - `email`: `"Janetzara97@gmail.com"`
  - `phone`: `"+234 814 304 9193"`
  - `whatsapp`: `"+234 814 304 9193"`
  - `location`: `"Ogborhill, Aba, Abia State, Nigeria"`
  - `isPublic`: `true`

---

## 2. Cloudinary Media Integration & Unsigned Preset Security Model

### 2.1 Configuration
- **Cloud Name:** `dkeqnovyf`
- **Upload Preset:** `zara_product_images` (Unsigned)
- **Asset Folder:** `zara/products`
- **Allowed Formats:** `image/jpeg`, `image/png`, `image/webp`
- **Maximum File Size:** 5 MB (5,242,880 bytes)
- **API Secret:** Never exposed in frontend client code. Only public cloud name and unsigned preset are utilized.

### 2.2 Security Architecture of Unsigned Presets
An unsigned upload preset enables direct browser-to-Cloudinary uploads without routing binary files through a backend server or triggering Firebase Blaze compute costs. However:
1. **Frontend Visibility:** Any visitor inspecting network requests can see the cloud name `dkeqnovyf` and upload preset `zara_product_images`. Neither client-side validation nor an admin login screen alone completely prevents a direct curl/script upload to an unsigned preset.
2. **Defensive Isolation via Cloud Firestore Security Rules:**
   - Public users and malicious actors **cannot write** to the Firestore `products` collection.
   - `firestore.rules` enforces:
     ```javascript
     match /products/{productId} {
       allow read: if (resource != null && resource.data.status == 'published') || isAdmin();
       allow write: if isAdmin();
     }
     ```
   - Even if an unauthorized file were uploaded directly to Cloudinary, it **cannot be linked to any product** in the store database.
   - The public catalogue only queries Firestore documents with `status == 'published'`. Therefore, rogue uploads remain orphaned files in Cloudinary, entirely invisible to visitors.
3. **Preset Hardening Recommendations (Cloudinary Console):**
   - In Cloudinary Settings &rarr; Upload &rarr; Upload Presets &rarr; `zara_product_images`:
     - Restrict Allowed File Types to `jpg, png, webp`.
     - Set Maximum Image File Size to `5MB`.
     - Enable Incoming Transformation (e.g., auto-convert to WebP, max width 1600px).
     - Optional: Enable Cloudinary AI Moderation to automatically flag questionable content.

---

## 3. Firebase Authentication & Trusted Admin Authorization

### 3.1 Security Principle
Administrative privileges are **never** granted simply because a user is signed in, nor by trusting a client-provided `isAdmin` boolean or user profile document. Such client-side checks can be bypassed using modified requests or browser developer tools.

### 3.2 Trusted Authorization Pattern: Custom Claims
Administrative access is enforced through **Firebase Auth Custom Claims**:
```javascript
request.auth.token.admin == true
```
Custom claims are cryptographically signed within the Firebase ID token and can only be set by trusted backend code using the Firebase Admin SDK.

### 3.3 Setting the Initial Administrator (Manual CLI Step)
Once the administrator `Janetzara97@gmail.com` creates an account in Firebase Auth:
```bash
node scripts/grant-admin.cjs
```
This script uses the Firebase Admin SDK to fetch the user by email and set `{ admin: true }`.

---

## 4. Admin Content-Management Workflow (`admin.html`)

The store provides a dedicated, authenticated administrative portal at `/admin.html`:
1. **Authentication Screen:** Secure Email/Password form with error alerts and return link to the public website.
2. **Role Verification Alert:** If a user logs in but lacks `{ admin: true }`, the dashboard displays an explicit warning stating that write access is restricted until administrative claims are provisioned.
3. **Catalogue Overview:**
   - Real-time statistics: Total Outfits, Live Published Outfits, Draft Outfits.
   - Comprehensive outfit table with thumbnail, title, category, price in NGN, availability, and publication status.
4. **Outfit Management Modal:**
   - Outfit Title and detailed styling notes.
   - Price in Nigerian Naira (NGN).
   - Category selector: Ready-to-Wear, Two-Piece Set, Gowns & Dresses, Bespoke.
   - Availability selector: In Stock, Made to Order, Sold Out.
   - Status selector: Published or Draft.
   - Size checkmarks: UK 6 through UK 18, Made-to-Measure.
   - **Cloudinary Upload Dropzone:** Drag-and-drop or click to upload, instant image preview, animated upload progress bar, and 5MB validation.
5. **Instant Actions:**
   - One-click Publish / Unpublish toggle.
   - Modal editing of all product metadata and image replacement.
   - Permanent deletion with accessible confirmation modal.

---

## 5. Public Shop Catalogue Integration (`index.html` & `scripts/shop.js`)

1. **Embedded Section:** Clean `#shop-catalogue` integration situated inside the approved `#collections` section.
2. **Category Filtering:** Interactive filter pills allowing visitors to browse:
   - All Outfits
   - Ready-to-Wear
   - Two-Piece Sets
   - Gowns & Dresses
   - Custom & Bespoke
3. **Real-Time Database Query:** Queries Firestore with `where('status', '==', 'published')`. Unpublished/draft pieces are completely excluded.
4. **Interactive Outfit Cards:** Displays Cloudinary photography, NGN formatted pricing, availability badges, and size options.
5. **Product Detail Modal:** Clicking any outfit opens a modal showcasing the full garment photo, description, available sizes, and a direct WhatsApp button pre-filling the garment title, price, and inquiry details:
   ```
   https://wa.me/2348143049193?text=Hello%20ZARAFIED,%20I%20am%20interested%20in%20ordering%20the%20[Title]%20(₦[Price])...
   ```

---

## 6. Operational Status & Verification Summary

| Component | Test Status | Notes |
|---|---|---|
| Cloudinary Unsigned Upload | **PASS** | Validated live against preset `zara_product_images` on cloud `dkeqnovyf`. Upload returned secure URL and asset ID. |
| Client-Side File Validation | **PASS** | Validates MIME types (JPEG, PNG, WebP) and restricts files > 5MB. |
| Firestore Products CRUD | **PASS** | Automated suite verified create, read, edit, toggle publish, and delete lifecycle on `zarastore-17250`. |
| Firestore Security Rules | **PASS** | Public unauthenticated writes rejected with HTTP 403. Public reads permit only `status == 'published'`. |
| Admin Dashboard (`admin.html`) | **PASS** | Verified in browser. Zero console errors. Responsive layout tested on desktop and mobile. |
| Public Shop Catalogue | **PASS** | Integrated into approved homepage without breaking existing layout or slideshow. Verified with live category filtering. |
| Production Hosting Deployment | **STOPPED** | Production hosting deployment deliberately withheld per prompt instructions. |


