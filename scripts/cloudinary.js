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
