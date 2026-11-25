// src/components/MessageInput.jsx

"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Send,
  ImagePlus,
  LoaderCircle,
} from "lucide-react";

import useChatStore from "@/store/useChatStore";

import { compressImage } from "@/utils/compressImage";
import { ALLOWED_IMAGE_TYPES } from "@/constants/attachments";

import ReplyPreview from "./ReplyPreview";
import ImagePreview from "./ImagePreview";

function MessageInput({
  onTyping,
  onStopTyping,
  replySenderName,
  userId,
}) {
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectionIdRef = useRef(0);

  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [imageError, setImageError] = useState(null);

  const send = useChatStore((s) => s.send);
  const sending = useChatStore((s) => s.sending);
  const replyTo = useChatStore((s) => s.replyTo);
  const clearReply = useChatStore((s) => s.clearReply);

  const canSend =
    !sending &&
    !processing &&
    Boolean(text.trim() || image);

  useEffect(() => {
    if (replyTo) {
      inputRef.current?.focus();
    }
  }, [replyTo]);

  useEffect(() => {
    return () => {
      selectionIdRef.current += 1;
    };
  }, []);

  function handleChange(event) {
    const value = event.target.value;

    setText(value);
    onTyping?.(value);
  }

  async function handleImageSelection(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || sending) return;

    const selectionId = ++selectionIdRef.current;

    setProcessing(true);
    setImageError(null);

    try {
      const compressed = await compressImage(file);

      if (
        selectionId !== selectionIdRef.current
      ) {
        return;
      }

      setImage(compressed);
      inputRef.current?.focus();
    } catch (error) {
      if (
        selectionId === selectionIdRef.current
      ) {
        setImageError(
          error.message ||
          "Unable to process image"
        );
      }
    } finally {
      if (
        selectionId === selectionIdRef.current
      ) {
        setProcessing(false);
      }
    }
  }

  function removeImage() {
    if (sending) return;

    selectionIdRef.current += 1;

    setImage(null);
    setImageError(null);
    setProcessing(false);
  }

  function handleKeyDown(event) {
    if (event.key !== "Escape") return;

    if (replyTo) {
      event.preventDefault();
      clearReply();
    } else if (image) {
      event.preventDefault();
      removeImage();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSend) return;

    const submittedText = text;
    const submittedImage = image;

    onStopTyping?.();

    const success = await send(
      submittedText.trim(),
      submittedImage,
      userId
    );

    if (success) {
      setText((current) =>
        current === submittedText
          ? ""
          : current
      );

      setImage((current) =>
        current === submittedImage
          ? null
          : current
      );

      setImageError(null);
    }
  }

  return (
    <div className="w-full min-w-0 shrink-0 bg-gray-950">
      <ReplyPreview
        message={replyTo}
        senderName={replySenderName}
        onCancel={clearReply}
      />

      {imageError && (
        <p
          role="alert"
          className="px-4 py-2 text-sm text-red-400"
        >
          {imageError}
        </p>
      )}

      <ImagePreview
        file={image}
        onRemove={removeImage}
        uploading={sending}
      />

      <form
        onSubmit={handleSubmit}
        className="flex min-w-0 items-center gap-2 p-3 sm:gap-3 sm:p-4"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={handleImageSelection}
          className="hidden"
        />

        <button
          type="button"
          disabled={sending || processing}
          onClick={() =>
            fileInputRef.current?.click()
          }
          title="Attach image"
          aria-label="Attach image"
          className="flex shrink-0 items-center justify-center rounded-xl p-2.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-blue-400 disabled:opacity-50"
        >
          {processing ? (
            <LoaderCircle
              size={22}
              className="animate-spin"
            />
          ) : (
            <ImagePlus size={22} />
          )}
        </button>

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleChange}
          onBlur={onStopTyping}
          onKeyDown={handleKeyDown}
          placeholder={
            image
              ? "Add a caption..."
              : replyTo
                ? "Type a reply..."
                : "Type a message..."
          }
          maxLength={5000}
          autoComplete="off"
          aria-label="Message"
          className="block min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-400 outline-none transition-colors focus:border-blue-500"
        />

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="flex shrink-0 items-center justify-center rounded-xl bg-blue-600 p-3 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (
            <LoaderCircle
              size={20}
              className="animate-spin"
            />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>
    </div>
  );
}

export default memo(MessageInput);
