// src/components/ImagePreview.jsx

"use client";

import {
  memo,
  useEffect,
  useState,
} from "react";

import {
  X,
  LoaderCircle,
} from "lucide-react";

function ImagePreview({
  file,
  onRemove,
  uploading,
}) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);

    setPreview(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!file) return null;

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-gray-800 bg-gray-900/70 p-3">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-800">
        {preview && (
          <img
            src={preview}
            alt="Selected attachment"
            className="h-full w-full object-cover"
          />
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <LoaderCircle
              size={24}
              className="animate-spin text-white"
            />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {file.name}
        </p>

        <p className="mt-1 text-xs text-gray-400">
          {Math.round(file.size / 1024)} KB
          {" · "}
          {uploading
            ? "Sending image..."
            : "Ready to send"}
        </p>
      </div>

      <button
        type="button"
        disabled={uploading}
        onClick={onRemove}
        aria-label="Remove attachment"
        className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50"
      >
        <X size={20} />
      </button>
    </div>
  );
}

export default memo(ImagePreview);
