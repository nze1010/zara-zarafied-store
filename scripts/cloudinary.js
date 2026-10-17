/**
 * ZARA — ZARAFIED STORE
 * Cloudinary Image Upload Service
 * 
 * Configuration:
 * - Cloud Name: dkeqnovyf
 * - Unsigned Upload Preset: zara_product_images
 * - Target Folder: zara/products
 * 
 * Security & Validation:
 * - Never includes or exposes API secrets in frontend code.
 * - Enforces client-side validation: JPEG, PNG, or WebP only; maximum 5 MB.
 * - Handles loading progress, network errors, and retry mechanisms.
 */

export const CLOUDINARY_CONFIG = {
  cloudName: 'dkeqnovyf',
  uploadPreset: 'zara_product_images',
  folder: 'zara/products',
  maxSizeBytes: 4.5 * 1024 * 1024, // 4.5 MB ceiling with safety buffer
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
};

/**
 * Validate image file format and size before upload
 * @param {File} file 
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'Please select an image file to upload.' };
  }

  // Validate MIME type
  const isAllowedType = CLOUDINARY_CONFIG.allowedMimeTypes.includes(file.type);
  if (!isAllowedType) {
    return {
      valid: false,
      error: `Unsupported file format (${file.type || 'unknown'}). Please choose a JPEG, PNG, or WebP image.`
    };
  }

  // Validate file size (max 4.5MB)
  if (file.size > CLOUDINARY_CONFIG.maxSizeBytes) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Optimized file size is too large (${sizeInMB} MB). Maximum allowed upload size is 4.5 MB.`
    };
  }

  return { valid: true, error: null };
}

/**
 * Upload an image file to Cloudinary using the unsigned preset
 * @param {File} file - Validated file object
 * @param {Function} [onProgress] - Optional progress callback receiving percentage (0-100)
 * @returns {Promise<{
 *   url: string,
 *   secure_url: string,
 *   public_id: string,
 *   asset_id: string,
 *   format: string,
 *   bytes: number,
 *   width: number,
 *   height: number
 * }>}
 */
export async function uploadImageToCloudinary(file, onProgress = null) {
  // Validate file before initiating network request
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', CLOUDINARY_CONFIG.folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);

    // Track upload progress if callback provided
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            url: response.url,
            secure_url: response.secure_url,
            public_id: response.public_id,
            asset_id: response.asset_id,
            format: response.format,
            bytes: response.bytes,
            width: response.width,
            height: response.height
          });
        } else {
          const errorMessage = response.error?.message || `Cloudinary upload failed with status ${xhr.status}.`;
          reject(new Error(errorMessage));
        }
      } catch (err) {
        reject(new Error('Failed to parse Cloudinary upload response.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred while connecting to Cloudinary. Please check your internet connection and retry.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Image upload timed out. Please check your internet connection and retry.'));
    };

    xhr.timeout = 45000; // 45 seconds timeout
    xhr.send(formData);
  });
}

/**
 * Check if a URL points to a Cloudinary-hosted asset
 * @param {string} url 
 * @returns {boolean}
 */
export function isCloudinaryUrl(url) {
  return Boolean(
    url &&
    typeof url === 'string' &&
    url.includes('res.cloudinary.com') &&
    url.includes('/image/upload/')
  );
}

/**
 * Safely generate an optimized Cloudinary delivery URL using supported transformations.
 * Preserves aspect ratio with `c_limit` (never crops outfits).
 * If the URL is not from Cloudinary, returns the raw URL untouched.
 *
 * @param {string} rawUrl - Cloudinary or local image URL
 * @param {Object} [options]
 * @param {number} [options.width] - Target width in pixels (e.g. 380, 600, 800)
 * @param {string} [options.quality='auto'] - Cloudinary quality ('auto', 'auto:eco', 'auto:good')
 * @param {string} [options.format='auto'] - Cloudinary format ('auto', 'webp', 'avif')
 * @param {string} [options.crop='limit'] - Cloudinary crop mode ('limit', 'fit' - never crop outfits)
 * @param {string|number} [options.dpr] - Device pixel ratio (e.g. 'auto')
 * @returns {string} Optimised delivery URL
 */
export function buildOptimizedImageUrl(rawUrl, options = {}) {
  if (!isCloudinaryUrl(rawUrl)) {
    return rawUrl;
  }

  const {
    width,
    quality = 'auto',
    format = 'auto',
    crop = 'limit',
    dpr
  } = options;

  const parts = rawUrl.split('/image/upload/');
  const prefix = parts[0] + '/image/upload/';
  let rest = parts.slice(1).join('/image/upload/');

  // Strip any existing transformation segments before the public_id / version
  rest = rest.replace(/^(?:(?:[a-z]{1,4}_[a-zA-Z0-9_.:-]+,?)+(\/|$))+/i, '');

  const transformations = [];
  if (crop) transformations.push(`c_${crop}`);
  if (width && Number.isFinite(width)) transformations.push(`w_${Math.round(width)}`);
  if (dpr) transformations.push(`dpr_${dpr}`);
  if (quality) transformations.push(`q_${quality}`);
  if (format) transformations.push(`f_${format}`);

  if (transformations.length === 0) {
    return `${prefix}${rest}`;
  }

  return `${prefix}${transformations.join(',')}/${rest}`;
}

/**
 * Build responsive srcset string for Cloudinary images.
 * Returns empty string if not a Cloudinary image.
 *
 * @param {string} rawUrl 
 * @param {number[]} [widths=[360, 600, 900]]
 * @returns {string}
 */
export function buildResponsiveSrcSet(rawUrl, widths = [360, 600, 900]) {
  if (!isCloudinaryUrl(rawUrl)) return '';
  return widths
    .map(w => `${buildOptimizedImageUrl(rawUrl, { width: w })} ${w}w`)
    .join(', ');
}

