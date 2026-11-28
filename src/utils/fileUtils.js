// src/utils/fileUtils.js

import {
  File as FileIcon,
  FileText,
  FileSpreadsheet,
  FileAudio,
  FileArchive,
  FileJson,
  Presentation,
  Image as ImageIcon,
} from "lucide-react";

import {
  FILE_TYPES,
  MAX_FILE_SIZE,
  MAX_SOURCE_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES,
} from "@/constants/attachments";

/* -------------------- FILE INFORMATION -------------------- */

const FILE_GROUPS = [
  [
    ["jpg", "jpeg", "png", "webp"],
    ImageIcon,
    "Image",
    "text-green-400",
  ],
  [
    ["pdf"],
    FileText,
    "PDF document",
    "text-red-400",
  ],
  [
    ["doc", "docx"],
    FileText,
    "Word document",
    "text-blue-400",
  ],
  [
    ["xls", "xlsx", "csv"],
    FileSpreadsheet,
    "Spreadsheet",
    "text-emerald-400",
  ],
  [
    ["ppt", "pptx"],
    Presentation,
    "Presentation",
    "text-orange-400",
  ],
  [
    ["mp3", "wav", "m4a", "ogg"],
    FileAudio,
    "Audio file",
    "text-purple-400",
  ],
  [
    ["zip"],
    FileArchive,
    "ZIP archive",
    "text-yellow-400",
  ],
  [
    ["json"],
    FileJson,
    "JSON file",
    "text-yellow-400",
  ],
  [
    ["txt"],
    FileText,
    "Text document",
    "text-gray-400",
  ],
];

const DEFAULT_FILE_INFO = Object.freeze({
  icon: FileIcon,
  label: "File",
  color: "text-gray-400",
});

const FILE_INFO = new Map();

for (const [extensions, icon, label, color] of FILE_GROUPS) {
  const info = Object.freeze({
    extensions,
    icon,
    label,
    color,
  });

  for (const extension of extensions) {
    FILE_INFO.set(extension, info);
  }
}

/* -------------------- FILE TYPE -------------------- */

function getFileExtension(name) {
  if (typeof name !== "string") return "";

  const index = name.lastIndexOf(".");

  return index < 0
    ? ""
    : name.slice(index + 1).toLowerCase();
}

function getMimeType(extension) {
  return Object.hasOwn(FILE_TYPES, extension)
    ? FILE_TYPES[extension]
    : null;
}

function getFileMimeType(name) {
  return getMimeType(getFileExtension(name));
}

export function getFileInfo(name) {
  return (
    FILE_INFO.get(getFileExtension(name)) ??
    DEFAULT_FILE_INFO
  );
}

export function isImageFile(file) {
  return ALLOWED_IMAGE_TYPES.includes(
    getFileMimeType(file?.name)
  );
}

/* -------------------- FILE SIZE -------------------- */

export function formatFileSize(bytes) {
  if (bytes == null) return "";

  const size = Number(bytes);

  if (!Number.isFinite(size) || size < 0) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 ** 2) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 ** 2).toFixed(1)} MB`;
}

/* -------------------- VALIDATION -------------------- */

function getValidatedFileInfo(file) {
  if (!file) {
    throw new Error("No file selected");
  }

  const extension = getFileExtension(file.name);
  const mimeType = getMimeType(extension);

  if (!mimeType) {
    throw new Error("Unsupported file format");
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error(
      "The selected file is empty or invalid"
    );
  }

  return {
    extension: extension === "jpeg"
      ? "jpg"
      : extension,

    mimeType,

    isImage: ALLOWED_IMAGE_TYPES.includes(mimeType),
  };
}

export function validateFile(file) {
  const info = getValidatedFileInfo(file);

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File exceeds the ${formatFileSize(MAX_FILE_SIZE)} limit`
    );
  }

  return info;
}

export function validateSourceImage(file) {
  const info = getValidatedFileInfo(file);

  if (!info.isImage) {
    throw new Error(
      "Please select a JPEG, PNG or WebP image"
    );
  }

  if (file.size > MAX_SOURCE_IMAGE_SIZE) {
    throw new Error(
      `Original image must not exceed ${formatFileSize(MAX_SOURCE_IMAGE_SIZE)}`
    );
  }

  return info;
}

/* -------------------- NORMALISATION -------------------- */

export function normalizeFile(file, info) {
  const { mimeType } = info ?? validateFile(file);

  if (file.type === mimeType) {
    return file;
  }

  return new File([file], file.name, {
    type: mimeType,
    lastModified: file.lastModified,
  });
}