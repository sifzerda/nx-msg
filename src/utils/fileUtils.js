// src/utils/fileUtils.js

import {
  File,
  FileText,
  FileSpreadsheet,
  FileAudio,
  FileArchive,
  FileJson,
  Presentation,
  Image,
} from "lucide-react";

import {
  FILE_TYPES,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
} from "@/constants/attachments";

const FILE_GROUPS = [
  {
    extensions: ["jpg", "jpeg", "png", "webp"],
    icon: Image,
    label: "Image",
    color: "text-green-400",
  },
  {
    extensions: ["pdf"],
    icon: FileText,
    label: "PDF document",
    color: "text-red-400",
  },
  {
    extensions: ["doc", "docx"],
    icon: FileText,
    label: "Word document",
    color: "text-blue-400",
  },
  {
    extensions: ["xls", "xlsx", "csv"],
    icon: FileSpreadsheet,
    label: "Spreadsheet",
    color: "text-emerald-400",
  },
  {
    extensions: ["ppt", "pptx"],
    icon: Presentation,
    label: "Presentation",
    color: "text-orange-400",
  },
  {
    extensions: ["mp3", "wav", "m4a", "ogg"],
    icon: FileAudio,
    label: "Audio file",
    color: "text-purple-400",
  },
  {
    extensions: ["zip"],
    icon: FileArchive,
    label: "ZIP archive",
    color: "text-yellow-400",
  },
  {
    extensions: ["json"],
    icon: FileJson,
    label: "JSON file",
    color: "text-yellow-400",
  },
  {
    extensions: ["txt"],
    icon: FileText,
    label: "Text document",
    color: "text-gray-400",
  },
];

const DEFAULT_FILE_INFO = {
  icon: File,
  label: "File",
  color: "text-gray-400",
};

const FILE_INFO = new Map(
  FILE_GROUPS.flatMap((group) =>
    group.extensions.map((extension) => [
      extension,
      group,
    ])
  )
);

export function getFileExtension(name = "") {
  const index = name.lastIndexOf(".");

  if (index < 0) return "";

  return name.slice(index + 1).toLowerCase();
}

export function getFileInfo(name) {
  return ( FILE_INFO.get(getFileExtension(name)) || DEFAULT_FILE_INFO );
}

export function formatFileSize(bytes) {
  if (bytes == null || !Number.isFinite(Number(bytes))) {
    return "";
  }

  const size = Number(bytes);

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageFile(file) {
  if (!file) return false;

  const extension = getFileExtension(file.name);

  return ALLOWED_IMAGE_TYPES.includes(FILE_TYPES[extension]);
}

export function validateFile(file) {
  if (!file) {
    throw new Error("No file selected");
  }

  const extension = getFileExtension(file.name);

  const mimeType = FILE_TYPES[extension];

  if (!mimeType) {
    throw new Error("Unsupported file format");
  }

  if (file.size <= 0) {
    throw new Error("The selected file is empty");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File exceeds the 20 MB limit");
  }

  return {
    extension: extension === "jpeg" ? "jpg" : extension,
    mimeType,
    isImage: isImageFile(file),
  };
}

export function normalizeFile(file) {
  const { mimeType } = validateFile(file);

  if (file.type === mimeType) {
    return file;
  }

  return new File([file], file.name, {
    type: mimeType,
    lastModified: file.lastModified,
  });
}