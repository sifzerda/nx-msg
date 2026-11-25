// src/utils/compressImage.js

import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  MAX_SOURCE_IMAGE_SIZE,
  MAX_IMAGE_DIMENSION,
  IMAGE_QUALITY,
} from "@/constants/attachments";

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Image compression failed"));
        }
      },
      type,
      quality
    );
  });
}

export async function compressImage(file) {
  if (!file) {
    throw new Error("No image selected");
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      "Please select a JPEG, PNG or WebP image"
    );
  }

  if (file.size > MAX_SOURCE_IMAGE_SIZE) {
    throw new Error(
      "Original image must be smaller than 30 MB"
    );
  }

  const bitmap = await createImageBitmap(file);

  const canvas = document.createElement("canvas");

  try {
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION /
        Math.max(bitmap.width, bitmap.height)
    );

    // Avoid unnecessary recompression.
    if (scale === 1 && file.size <= MAX_IMAGE_SIZE) {
      return file;
    }

    canvas.width = Math.max(
      1,
      Math.round(bitmap.width * scale)
    );

    canvas.height = Math.max(
      1,
      Math.round(bitmap.height * scale)
    );

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
      canvas.width,
      canvas.height
    );

    let quality = IMAGE_QUALITY;
    let blob = await canvasToBlob(
      canvas,
      "image/webp",
      quality
    );

    while (
      blob.size > MAX_IMAGE_SIZE &&
      quality > 0.35
    ) {
      quality -= 0.1;

      blob = await canvasToBlob(
        canvas,
        "image/webp",
        quality
      );
    }

    if (blob.size > MAX_IMAGE_SIZE) {
      throw new Error(
        "Image is too large after compression"
      );
    }

    const extension =
      blob.type === "image/webp"
        ? "webp"
        : blob.type === "image/jpeg"
          ? "jpg"
          : "png";

    const name =
      file.name.replace(/\.[^.]+$/, "") +
      `.${extension}`;

    return new File([blob], name, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();

    canvas.width = 0;
    canvas.height = 0;
  }
}
