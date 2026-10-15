# ZARA — ZARAFIED STORE
## Layer 2: Firebase Infrastructure & Security Architecture Document

This document establishes the official database schema, security access model, media storage hierarchy, and administrative authentication architecture for **ZARA — ZARAFIED STORE**.

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

---

## 1. Cloud Firestore Data Architecture

Cloud Firestore is organized around six core logical collections designed with strict type validation, document identifier conventions, and audit timestamps.

### 1.1 Collection: `products`
- **Purpose:** Stores the ready-to-wear fashion catalogue, inventory status, sizing options, fabric details, pricing, and visual lookbook URLs.
- **Document ID Strategy:** Slug-based identifier derived from title (e.g. `ankara-peplum-blouse-01`) or Firestore Auto-ID.
- **Publication Status:** `status` field: `'draft' | 'published' | 'archived'`.
- **Fields:**
  | Field | Type | Required | Description |
  |---|---|:---:|---|
  | `id` | `string` | Yes | Unique product identifier matching document ID |
  | `title` | `string` | Yes | Human-readable garment title (e.g., "Classic Ankara Peplum Top") |
  | `description` | `string` | Yes | Full garment description, tailoring details & styling notes |
  | `category` | `string` | Yes | `'ready-to-wear' | 'accessories' | 'two-piece' | 'gowns'` |
  | `price` | `number` | Yes | Numeric price in Nigerian Naira (NGN) (e.g., `45000`) |
  | `currency` | `string` | Yes | Currency code (`'NGN'`) |
  | `availableSizes` | `array<string>` | Yes | Array of supported standard sizes: `['UK 8', 'UK 10', 'UK 12', 'UK 14', 'UK 16']` |
  | `images` | `array<map>` | Yes | Array of image metadata maps: `[{ url: string, storagePath: string, alt: string, isPrimary: boolean }]` |
  | `featured` | `boolean` | Yes | Whether displayed in homepage highlights (`true | false`) |
  | `status` | `string` | Yes | Publication state: `'draft' | 'published' | 'archived'` |
  | `createdAt` | `timestamp` | Yes | Server timestamp when the product was created |
  | `updatedAt` | `timestamp` | Yes | Server timestamp when last modified |
  | `createdBy` | `string` | Yes | UID of the administrator who created the entry |

---

### 1.2 Collection: `portfolio`
- **Purpose:** Bespoke made-to-measure showcase, client red-carpet looks, and custom couture commissions.
- **Document ID Strategy:** Auto-ID or descriptive slug (e.g. `crimson-bridal-gown-2026`).
- **Publication Status:** `status` field: `'published' | 'draft'`.
- **Fields:**
  | Field | Type | Required | Description |
  |---|---|:---:|---|
  | `id` | `string` | Yes | Document identifier |
  | `title` | `string` | Yes | Style title (e.g., "Sculpted Crimson Gala Gown") |
  | `category` | `string` | Yes | `'couture' | 'bridal' | 'traditional' | 'contemporary'` |
  | `description` | `string` | Yes | Narrative on the fabrics, beading, and silhouette inspiration |
  | `images` | `array<map>` | Yes | Image URLs, storage paths and photography credits |
  | `status` | `string` | Yes | `'published' | 'draft'` |
  | `displayOrder` | `number` | No | Numeric sorting weight for homepage gallery presentation |
  | `createdAt` | `timestamp` | Yes | Creation timestamp |
  | `updatedAt` | `timestamp` | Yes | Modification timestamp |

---

### 1.3 Collection: `orders`
- **Purpose:** Customer order records, line items, customer details, and delivery fulfillment state.
- **Security:** Confidential. Strictly accessible to authenticated administrators.
- **Fields:**
  | Field | Type | Required | Description |
  |---|---|:---:|---|
  | `id` | `string` | Yes | Unique order reference (e.g., `ZF-2026-0042`) |
  | `customer` | `map` | Yes | `{ name: string, email: string, phone: string, address: string, city: string, state: string, country: string }` |
  | `items` | `array<map>` | Yes | Ordered items: `[{ productId: string, title: string, size: string, quantity: number, unitPrice: number }]` |
  | `subtotal` | `number` | Yes | Total items cost before delivery |
  | `deliveryFee` | `number` | Yes | Shipping cost |
  | `total` | `number` | Yes | Gross total in NGN |
  | `status` | `string` | Yes | `'pending' | 'confirmed' | 'in_production' | 'dispatched' | 'delivered' | 'cancelled'` |
  | `paymentMethod` | `string` | Yes | `'bank_transfer' | 'paystack' | 'flutterwave'` |
  | `paymentReference` | `string` | No | Verified transaction reference |
  | `createdAt` | `timestamp` | Yes | Order placement timestamp |
  | `updatedAt` | `timestamp` | Yes | Status update timestamp |

---

### 1.4 Collection: `customEnquiries`
- **Purpose:** Fitting consultations, bespoke couture inquiries, and special event commission requests.
- **Security:** Public write (with size and content validation); Admin-only read, update and delete.
- **Fields:**
  | Field | Type | Required | Description |
  |---|---|:---:|---|
  | `id` | `string` | Yes | Auto-ID |
  | `name` | `string` | Yes | Client full name (max 100 chars) |
  | `contact` | `string` | Yes | Phone number or email address (max 100 chars) |
  | `preferredChannel` | `string` | No | `'whatsapp' | 'email' | 'phone'` |
  | `eventType` | `string` | No | `'wedding' | 'reception' | 'birthday' | 'other'` |
  | `targetDate` | `string` | No | Desired completion date |
  | `message` | `string` | Yes | Description of desired style or inquiry (max 2000 chars) |
  | `status` | `string` | Yes | `'new' | 'contacted' | 'fitting_booked' | 'closed'` |
  | `createdAt` | `timestamp` | Yes | Submission timestamp |

---

### 1.5 Collection: `reviews`
- **Purpose:** Genuine customer reviews, event photos, and fit feedback.
- **Security:** Public can read only `status == 'approved'`. Submissions start as `'pending'`. Admin moderation required.
- **Fields:**
  | Field | Type | Required | Description |
  |---|---|:---:|---|
  | `id` | `string` | Yes | Auto-ID |
  | `author` | `string` | Yes | Client name or alias (e.g., "Chioma A., Aba") |
  | `location` | `string` | No | City or state |
  | `reviewText` | `string` | Yes | Written review (max 1500 chars) |
  | `rating` | `number` | No | 1 to 5 numeric score |
  | `verifiedBuyer` | `boolean` | Yes | Whether linked to a completed order |
  | `orderId` | `string` | No | Optional reference to original order |
  | `status` | `string` | Yes | `'pending' | 'approved' | 'rejected'` |
  | `createdAt` | `timestamp` | Yes | Submission timestamp |
  | `approvedAt` | `timestamp` | No | Moderation timestamp |

---

### 1.6 Collection: `siteSettings`
- **Purpose:** Public contact information, studio announcements, and store settings.
- **Security:** Read permitted if `isPublic == true`. Write restricted to administrators.
- **Documents:**
  - `siteSettings/contact`: Confirmed business information:
    - `brandName`: `"ZARA — ZARAFIED STORE"`
    - `email`: `"Janetzara97@gmail.com"`
    - `phone`: `"+234 814 304 9193"`
    - `whatsapp`: `"+234 814 304 9193"`
    - `location`: `"Ogborhill, Aba, Abia State, Nigeria"`
    - `isPublic`: `true`
  - `siteSettings/announcements`: Optional banner text, holiday hours, or collection release notices.

---

## 2. Firebase Storage Media Hierarchy

Media is partitioned into dedicated namespaces with size restrictions (5MB max) and MIME type validation (`image/*`).

```
gs://zarastore-17250.firebasestorage.app/
├── products/
│   └── {productId}/
│       ├── primary.webp
│       ├── gallery-01.webp
│       └── gallery-02.webp
├── portfolio/
│   └── {portfolioId}/
│       ├── cover.webp
│       └── detail-01.webp
└── brand/
    ├── logo.png
    └── hero-portrait.png
```

### Media Upload & Firestore Reference Workflow
1. **Admin selects image file** in the upcoming admin dashboard.
2. **Dashboard validates** image format (`image/jpeg`, `image/png`, `image/webp`) and file size (≤ 5MB).
3. **Uploads to Firebase Storage** at `products/{productId}/{uuid}.webp` using Firebase Storage SDK.
4. **Retrieves Public Download URL** via `getDownloadURL(storageRef)`.
5. **Saves Metadata in Firestore** within `products/{productId}` under `images: [{ storagePath, url, alt }]`.
6. **Local Asset Isolation:** The supplied brand photographs in `ZARA_ASSETS/` remain available locally. They are NOT automatically migrated or overwritten.

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
When the Firebase project is configured, the administrator claim for `Janetzara97@gmail.com` is granted using the Node.js Firebase Admin SDK or Cloud Function:

```javascript
// admin-setup.js (Run once in private trusted environment)
import admin from 'firebase-admin';

// Initialize with service account key in secure private environment
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

async function grantAdmin(email) {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`Successfully granted admin privileges to ${email} (UID: ${user.uid})`);
}

grantAdmin('Janetzara97@gmail.com');
```

---

## 4. Security Rules Architecture

### 4.1 Cloud Firestore (`firestore.rules`)
- **Default Deny:** `match /{document=**} { allow read, write: if false; }`
- **Published Catalogue Access:** Public read allowed for `products` and `portfolio` only where `status == 'published'`.
- **Order Confidentiality:** Orders cannot be listed or read by public users.
- **Client Enquiries:** Public create allowed with payload size and field validation; read/update restricted to verified admins.
- **Moderated Reviews:** Public read restricted to `status == 'approved'`.

### 4.2 Firebase Storage (`storage.rules`)
- **Default Deny:** Any unmapped bucket path denies read and write.
- **Image Type Enforcement:** `request.resource.contentType.matches('image/.*')`.
- **File Size Cap:** `request.resource.size <= 5 * 1024 * 1024` (5 MB).
- **Admin Write Authority:** Write/delete strictly restricted to `request.auth.token.admin == true`.

---

## 5. Local Standby Mode & Graceful Degradation

The frontend architecture in `scripts/firebase-config.js` is isolated and designed with graceful degradation:
- If Firebase credentials are missing or unconfigured, the website runs in **Local Standby Mode**.
- The homepage loads 100% reliably using the verified local brand assets and HTML shell.
- No uncaught JavaScript exceptions or blank pages occur.
- When valid credentials are provided in `scripts/firebase-env.js`, the modular SDK seamlessly activates without requiring application code changes.

---

## 6. Local Setup, Testing & Deployment Reference

### 6.1 Local Development Preview
```bash
# Serve static files locally
python -m http.server 8085
# or
npx serve .
```

### 6.2 Firebase Local Emulator Suite
Test Firestore and Storage security rules locally without affecting production data:
```bash
npx firebase-tools emulators:start --only firestore,storage,hosting,auth
```
- Emulator UI: `http://localhost:4000`
- Firestore Emulator: `localhost:8080`
- Storage Emulator: `localhost:9199`
- Hosting Emulator: `localhost:5000`

### 6.3 Security Rules Deployment
To deploy only the security rules to `zarastore-17250`:
```bash
npx firebase-tools deploy --only firestore:rules,storage --project zarastore-17250
```

### 6.4 Production Hosting Deployment (Layer 2 Review Only — Do Not Run Yet)
When production deployment is approved:
```bash
npx firebase-tools deploy --only hosting:zarafiedstore --project zarastore-17250
```
Public URL: `https://zarafiedstore.web.app`

---

## 7. Operational Status & Remaining Steps

1. **Cloud Firestore Provisioning (COMPLETED & VERIFIED):**
   - Active database: `projects/zarastore-17250/databases/(default)`
   - Location: `europe-west1` (Belgium, optimal low latency for West Africa & Nigeria)
   - Rules: Deployed from `firestore.rules` and verified via automated test suite.
2. **Firebase Authentication Initialization (COMPLETED & VERIFIED):**
   - Tenant: Active and operational on `zarastore-17250`.
   - Sign-in Provider: **Email/Password** is **ENABLED** and verified.
   - Admin Provisioning: Once administrator `Janetzara97@gmail.com` creates their account in the Console, run `node scripts/grant-admin.cjs` to cryptographically assign the `{ admin: true }` custom claim.
3. **Firebase Storage (Blocked by Google Billing Account Requirement):**
   - Exact Blocker: Google Firebase now requires a billing account to be linked (upgrade to the Blaze pay-as-you-go plan) before creating a Cloud Storage bucket on new projects. The Firebase Console explicitly requires: *"To use Storage, upgrade your project's pricing plan"* at [https://console.firebase.google.com/project/zarastore-17250/storage](https://console.firebase.google.com/project/zarastore-17250/storage).
   - Next Action: When the store owner is ready to link a payment/billing account, click **Upgrade project** in the Console (Storage includes generous free-tier quotas: 5GB storage, 1GB/day downloads, 20k uploads/day under Blaze).
   - Once upgraded and the bucket is created, run:
     ```bash
     npx firebase-tools deploy --only storage --project zarastore-17250
     ```

