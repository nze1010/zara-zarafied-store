/**
 * ZARA — ZARAFIED STORE
 * Client-Side Browser Image Optimization & Adaptive Compressor (ES Modules)
 *
 * Requirements:
 * - Accept JPEG, PNG, and WebP images.
 * - Enforce maximum output file size: 4.5 MB (4,718,592 bytes), leaving safety margin below Cloudinary's 5 MB limit.
 * - Set maximum dimension of 2,000 pixels on longest side (never upscale small images).
 * - Adaptive progressive compression: start with high quality (0.92) and step down only when necessary.
 * - Prefer WebP format when supported by browser; preserve transparency for PNG/WebP (never destroy alpha channel).
 * - Handle EXIF orientation properly via createImageBitmap where supported.
 * - Reject unsupported or corrupted files with clear, helpful error messages.
 * - Clean up memory, revoke temporary URLs, and release canvas resources.
 */

export const COMPRESSION_CONFIG = {
  maxOutputSizeBytes: 4.5 * 1024 * 1024, // 4.5 MB safety ceiling
  maxDimensionPixels: 2000,              // 2000px max on longest side
  maxInputSizeBytes: 50 * 1024 * 1024,   // 50 MB sanity limit to protect memory
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  initialQuality: 0.92,
  qualitySteps: [0.92, 0.85, 0.78, 0.70, 0.60],
  dimensionFallbacks: [2000, 1600, 1200]
};

let cachedWebPSupport = null;

/**
 * Detect whether the current browser environment can encode Canvas to image/webp
 * @returns {Promise<boolean>}
 */
export async function isWebPEncodingSupported() {
  if (cachedWebPSupport !== null) {
    return cachedWebPSupport;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.8);
    });
    cachedWebPSupport = Boolean(blob && blob.type === 'image/webp');
  } catch (err) {
    cachedWebPSupport = false;
  }
  return cachedWebPSupport;
}

/**
 * Validate raw input file before attempting compression
 * @param {File} file 
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateInputFile(file) {
  if (!file) {
    return { valid: false, error: 'Please select an image file to upload.' };
  }

  // Check file type
  const mimeType = (file.type || '').toLowerCase();
  const fileName = (file.name || '').toLowerCase();
  const hasValidMime = COMPRESSION_CONFIG.allowedMimeTypes.includes(mimeType);
  const hasValidExt = COMPRESSION_CONFIG.allowedExtensions.some(ext => fileName.endsWith(ext));

  if (!hasValidMime && !hasValidExt) {
    return {
      valid: false,
      error: `Unsupported file format (${mimeType || 'unknown'}). Please choose a JPEG, PNG, or WebP photograph.`
    };
  }

  // Check input sanity limit
  if (file.size > COMPRESSION_CONFIG.maxInputSizeBytes) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is excessively large (${mb} MB). Please choose an image under 50 MB.`
    };
  }

  return { valid: true, error: null };
}

/**
 * Calculate scaled dimensions preserving aspect ratio without upscaling
 * @param {number} srcWidth 
 * @param {number} srcHeight 
 * @param {number} maxDimension 
 * @returns {{ width: number, height: number, scaled: boolean }}
 */
export function calculateDimensions(srcWidth, srcHeight, maxDimension = COMPRESSION_CONFIG.maxDimensionPixels) {
  if (srcWidth <= maxDimension && srcHeight <= maxDimension) {
    return { width: srcWidth, height: srcHeight, scaled: false };
  }

  let width = srcWidth;
  let height = srcHeight;

  if (srcWidth >= srcHeight) {
    width = maxDimension;
    height = Math.round((srcHeight * maxDimension) / srcWidth);
  } else {
    height = maxDimension;
    width = Math.round((srcWidth * maxDimension) / srcHeight);
  }

  return { width, height, scaled: true };
}

/**
 * Load image into a drawable source (ImageBitmap or HTMLImageElement)
 * Handles phone photograph EXIF orientation where supported
 * @param {File} file 
 * @returns {Promise<{ source: any, width: number, height: number, cleanup: Function }>}
 */
async function loadDrawableImage(file) {
  // Method 1: Modern createImageBitmap with automatic EXIF orientation
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          if (typeof bitmap.close === 'function') {
            bitmap.close();
          }
        }
      };
    } catch (e) {
      // Fall through to HTMLImageElement on decode or options error
    }
  }

  // Method 2: HTMLImageElement via object URL
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => {
          URL.revokeObjectURL(objectUrl);
        }
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The selected image file appears to be corrupted or cannot be decoded.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Check if canvas context contains any alpha transparency pixels
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} width 
 * @param {number} height 
 * @returns {boolean}
 */
function inspectAlphaTransparency(ctx, width, height) {
  try {
    // Sample pixels across image to detect transparency
    const sampleWidth = Math.min(width, 200);
    const sampleHeight = Math.min(height, 200);
    const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    for (let i = 3; i < imgData.length; i += 4) {
      if (imgData[i] < 250) {
        return true;
      }
    }
    return false;
  } catch (err) {
    // If pixel inspection is blocked or fails, treat PNG conservatively
    return true;
  }
}

/**
 * Render drawable source onto a canvas with specified target dimensions
 * @param {any} source 
 * @param {number} targetWidth 
 * @param {number} targetHeight 
 * @returns {HTMLCanvasElement}
 */
function renderToCanvas(source, targetWidth, targetHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: true });

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  return { canvas, ctx };
}

/**
 * Convert Canvas to Blob with requested format and quality
 * @param {HTMLCanvasElement} canvas 
 * @param {string} format 
 * @param {number} quality 
 * @returns {Promise<Blob>}
 */
function canvasToBlobAsync(canvas, format, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas serialization to Blob failed.'));
      }
    }, format, quality);
  });
}

/**
 * Format bytes into human-readable representation (e.g., "1.4 MB", "850 KB")
 * @param {number} bytes 
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Compress and optimize an image file adaptively in the browser
 * 
 * @param {File} file - Original input file
 * @param {Function} [onStatus] - Optional status update callback
 * @returns {Promise<{
 *   optimizedFile: File,
 *   originalSize: number,
 *   optimizedSize: number,
 *   reductionPercent: number,
 *   reductionText: string,
 *   dimensions: { width: number, height: number },
 *   format: string
 * }>}
 */
export async function compressImage(file, onStatus = null) {
  const validation = validateInputFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  onStatus?.({ stage: 'loading', message: 'Analyzing image data...' });

  let drawable;
  try {
    drawable = await loadDrawableImage(file);
  } catch (err) {
    throw new Error(err.message || 'Failed to decode image. File may be corrupted.');
  }

  try {
    const origWidth = drawable.width;
    const origHeight = drawable.height;

    if (!origWidth || !origHeight) {
      throw new Error('Image has invalid dimensions (0x0). Please choose a valid photograph.');
    }

    const supportsWebP = await isWebPEncodingSupported();
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

    onStatus?.({ stage: 'compressing', message: 'Optimizing fashion photograph...' });

    // Determine target format and transparency handling
    let targetFormat = 'image/jpeg';
    let isTransparent = false;

    // Check transparency if original was PNG
    if (isPng) {
      // Create initial small canvas to inspect transparency
      const testDims = calculateDimensions(origWidth, origHeight, 400);
      const { ctx: testCtx, canvas: testCanvas } = renderToCanvas(drawable.source, testDims.width, testDims.height);
      isTransparent = inspectAlphaTransparency(testCtx, testDims.width, testDims.height);
      testCanvas.width = 0;
      testCanvas.height = 0;
    }

    if (supportsWebP) {
      // WebP natively supports transparency and offers superior compression
      targetFormat = 'image/webp';
    } else if (isTransparent) {
      // If WebP is not supported and PNG has transparency, retain PNG to avoid black/white background
      targetFormat = 'image/png';
    } else {
      targetFormat = 'image/jpeg';
    }

    let bestBlob = null;
    let finalWidth = origWidth;
    let finalHeight = origHeight;

    // Progressive optimization strategy:
    // Try maxDimension 2000 with progressive quality steps
    // If still > 4.5 MB, step down dimensions (1600, 1200)
    for (const maxDim of COMPRESSION_CONFIG.dimensionFallbacks) {
      const { width, height } = calculateDimensions(origWidth, origHeight, maxDim);
      finalWidth = width;
      finalHeight = height;

      const { canvas, ctx } = renderToCanvas(drawable.source, width, height);

      if (targetFormat === 'image/png') {
        // PNG is lossless in Canvas, quality parameter is ignored
        const blob = await canvasToBlobAsync(canvas, 'image/png');
        canvas.width = 0;
        canvas.height = 0;

        if (blob.size <= COMPRESSION_CONFIG.maxOutputSizeBytes) {
          bestBlob = blob;
          break;
        }
        // If PNG is still too large, loop continues to smaller dimensions
      } else {
        // WebP or JPEG: step through quality levels
        for (const quality of COMPRESSION_CONFIG.qualitySteps) {
          const blob = await canvasToBlobAsync(canvas, targetFormat, quality);
          if (blob.size <= COMPRESSION_CONFIG.maxOutputSizeBytes) {
            bestBlob = blob;
            break;
          }
          // Keep smallest candidate found so far
          if (!bestBlob || blob.size < bestBlob.size) {
            bestBlob = blob;
          }
        }

        canvas.width = 0;
        canvas.height = 0;

        if (bestBlob && bestBlob.size <= COMPRESSION_CONFIG.maxOutputSizeBytes) {
          break;
        }
      }
    }

    if (!bestBlob || bestBlob.size > COMPRESSION_CONFIG.maxOutputSizeBytes) {
      const achievedSize = bestBlob ? formatBytes(bestBlob.size) : 'unknown';
      throw new Error(
        `Photograph could not be reduced below 4.5 MB without severe quality degradation (current: ${achievedSize}). Please select an image with a smaller file size or lower resolution.`
      );
    }

    // Determine clean file extension
    let outputExt = '.jpg';
    if (bestBlob.type === 'image/webp') outputExt = '.webp';
    else if (bestBlob.type === 'image/png') outputExt = '.png';

    const baseName = file.name.replace(/\.[^/.]+$/, '').trim() || 'product-image';
    const optimizedFileName = `${baseName}-opt${outputExt}`;
    const optimizedFile = new File([bestBlob], optimizedFileName, {
      type: bestBlob.type,
      lastModified: Date.now()
    });

    const originalSize = file.size;
    const optimizedSize = bestBlob.size;
    const reductionPercent = Math.max(0, ((originalSize - optimizedSize) / originalSize) * 100);
    const reductionText = reductionPercent > 0.5
      ? `${reductionPercent.toFixed(1)}% smaller`
      : 'optimized';

    return {
      optimizedFile,
      originalSize,
      optimizedSize,
      reductionPercent,
      reductionText,
      dimensions: { width: finalWidth, height: finalHeight },
      format: bestBlob.type
    };
  } finally {
    drawable.cleanup();
  }
}
