// src/utils/compressImage.js

import {
  MAX_IMAGE_SIZE,
  TARGET_IMAGE_SIZE,
  MAX_IMAGE_DIMENSION,
  IMAGE_QUALITY,
  MIN_IMAGE_QUALITY,
  IMAGE_QUALITY_STEP,
  IMAGE_EXTENSIONS,
} from "@/constants/attachments";

import {
  validateSourceImage,
  normalizeFile,
} from "@/utils/fileUtils";

/* -------------------- HELPERS -------------------- */

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || !blob.size) {
          reject(
            new Error("Image compression failed")
          );
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

function getImageDimensions(width, height) {
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(width, height)
  );

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: scale < 1,
  };
}

function createImageFile(blob, originalFile) {
  const extension = IMAGE_EXTENSIONS[blob.type];

  if (!extension) {
    throw new Error("Unsupported compressed image format");
  }

  const name =
    originalFile.name.replace(/\.[^.]+$/, "") +
    `.${extension}`;

  return new File([blob], name, {
    type: blob.type,
    lastModified: originalFile.lastModified,
  });
}

/* -------------------- COMPRESSION -------------------- */

export async function compressImage(file) {
  const info = validateSourceImage(file);

  const source = normalizeFile(file, info);

  let bitmap = null;
  let canvas = null;

  try {
    bitmap = await createImageBitmap(source);

    const dimensions = getImageDimensions(
      bitmap.width,
      bitmap.height
    );

    // Keep small images that already meet our requirements.

    if (
      !dimensions.resized &&
      source.size <= TARGET_IMAGE_SIZE
    ) {
      return source;
    }

    // Allocate the canvas only when compression is required.

    canvas = document.createElement("canvas");

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to process image");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.drawImage(
      bitmap,
      0,
      0,
      dimensions.width,
      dimensions.height
    );

    // The canvas now contains the pixels.
    // Release the original decoded bitmap.

    bitmap.close();
    bitmap = null;

    let quality = IMAGE_QUALITY;
    let bestBlob = await canvasToBlob(canvas, quality);

    // Browsers may fall back to PNG if WebP encoding
    // is unsupported. PNG ignores the quality argument.

    while (
      bestBlob.type === "image/webp" &&
      bestBlob.size > TARGET_IMAGE_SIZE &&
      quality > MIN_IMAGE_QUALITY
    ) {
      quality = Math.max(
        MIN_IMAGE_QUALITY,
        Number(
          (quality - IMAGE_QUALITY_STEP).toFixed(2)
        )
      );

      const candidate = await canvasToBlob(
        canvas,
        quality
      );

      if (candidate.size < bestBlob.size) {
        bestBlob = candidate;
      }
    }

    // Never replace an appropriately sized original
    // with a larger compressed version.

    if (
      !dimensions.resized &&
      source.size <= MAX_IMAGE_SIZE &&
      source.size <= bestBlob.size
    ) {
      return source;
    }

    if (bestBlob.size > MAX_IMAGE_SIZE) {
      throw new Error(
        "Image is too large after compression"
      );
    }

    return createImageFile(bestBlob, source);
  } finally {
    bitmap?.close();

    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}