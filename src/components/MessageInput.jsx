// src/components/MessageInput.jsx

"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import dynamic from "next/dynamic";

import {
  Send,
  Paperclip,
  LoaderCircle,
  Smile,
} from "lucide-react";

import useChatStore from "@/store/useChatStore";

import { compressImage } from "@/utils/compressImage";
import { insertEmoji } from "@/utils/emojiUtils";

import {
  isImageFile,
  validateFile,
  normalizeFile,
  getFileExtension,
} from "@/utils/fileUtils";

import {
  FILE_ACCEPT,
  FILE_TYPES,
} from "@/constants/attachments";

import {
  MAX_MESSAGE_LENGTH,
  COMPOSER_PICKER,
} from "@/constants/emojis";

import ReplyPreview from "./ReplyPreview";
import AttachmentPreview from "./extras/AttachmentPreview";
import GifPreview from "./extras/GifPreview";

/* -------------------- LAZY LOADING -------------------- */

function PickerLoading({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-gray-800 bg-gray-900 py-8 text-sm text-gray-400">
      <LoaderCircle
        size={20}
        className="animate-spin"
      />

      Loading {label} picker...
    </div>
  );
}

const GifPicker = dynamic(
  () => import("./extras/GifPicker"),
  {
    ssr: false,
    loading: () => <PickerLoading label="GIF" />,
  }
);

const EmojiPicker = dynamic(
  () => import("./extras/EmojiPicker"),
  {
    ssr: false,
    loading: () => <PickerLoading label="emoji" />,
  }
);

/* -------------------- STYLES -------------------- */

const PICKER_BUTTON_CLASS = [
  "flex shrink-0 items-center justify-center",
  "rounded-xl p-2 transition-colors",
  "disabled:opacity-50 sm:p-2.5",
].join(" ");

const ACTIVE_BUTTON_CLASS =
  "bg-blue-600/20 text-blue-400";

const INACTIVE_BUTTON_CLASS =
  "text-gray-400 hover:bg-gray-800 hover:text-blue-400";

function getPickerButtonClass(active) {
  return `${PICKER_BUTTON_CLASS} ${
    active
      ? ACTIVE_BUTTON_CLASS
      : INACTIVE_BUTTON_CLASS
  }`;
}

/* -------------------- COMPONENT -------------------- */

function MessageInput({
  onTyping,
  onStopTyping,
  replySenderName,
  userId,
}) {
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectionIdRef = useRef(0);

  const textRef = useRef("");

  const cursorRef = useRef({
    start: 0,
    end: 0,
  });

  const pendingCursorRef = useRef(null);

  /* -------------------- STATE -------------------- */

  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [selectedGif, setSelectedGif] = useState(null);

  const [activePicker, setActivePicker] =
    useState(null);

  const [processing, setProcessing] =
    useState(false);

  const [attachmentError, setAttachmentError] =
    useState(null);

  /* -------------------- ZUSTAND -------------------- */

  const send = useChatStore((s) => s.send);
  const sending = useChatStore((s) => s.sending);
  const replyTo = useChatStore((s) => s.replyTo);
  const clearReply = useChatStore((s) => s.clearReply);

  /* -------------------- DERIVED STATE -------------------- */

  const gifPickerOpen =
    activePicker === COMPOSER_PICKER.GIF;

  const emojiPickerOpen =
    activePicker === COMPOSER_PICKER.EMOJI;

  const pickerDisabled = sending || processing;

  const canSend =
    !sending &&
    !processing &&
    Boolean(
      text.trim() ||
      attachment ||
      selectedGif
    );

  /* -------------------- CURSOR MANAGEMENT -------------------- */

  const rememberCursor = useCallback(() => {
    const input = inputRef.current;

    if (!input) return;

    cursorRef.current = {
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length,
    };
  }, []);

  const focusInput = useCallback(() => {
    const input = inputRef.current;

    if (!input) return;

    input.focus();

    const { start, end } = cursorRef.current;

    input.setSelectionRange(
      Math.min(start, input.value.length),
      Math.min(end, input.value.length)
    );
  }, []);

  useLayoutEffect(() => {
    const cursor = pendingCursorRef.current;

    if (cursor === null) return;

    pendingCursorRef.current = null;

    inputRef.current?.setSelectionRange(
      cursor,
      cursor
    );
  }, [text]);

  /* -------------------- EFFECTS -------------------- */

  // Focus the composer when replying.

  useEffect(() => {
    if (replyTo) {
      focusInput();
    }
  }, [replyTo, focusInput]);

  // Invalidate pending file processing on unmount.

  useEffect(() => {
    return () => {
      selectionIdRef.current += 1;
    };
  }, []);

  /* -------------------- TEXT INPUT -------------------- */

  function handleChange(event) {
    const value = event.target.value;

    textRef.current = value;

    cursorRef.current = {
      start: event.target.selectionStart ?? value.length,
      end: event.target.selectionEnd ?? value.length,
    };

    setText(value);

    onTyping?.(value);
  }

  function handleBlur() {
    rememberCursor();

    onStopTyping?.();
  }

  /* -------------------- PICKER MANAGEMENT -------------------- */

  const closePicker = useCallback(() => {
    setActivePicker(null);

    focusInput();
  }, [focusInput]);

  function togglePicker(picker) {
    if (pickerDisabled) return;

    if (activePicker === picker) {
      closePicker();
      return;
    }

    if (document.activeElement === inputRef.current) {
      rememberCursor();
    }

    setActivePicker(picker);
  }

  /* -------------------- EMOJI PICKER -------------------- */

  const selectEmoji = useCallback(
    (emoji) => {
      if (useChatStore.getState().sending) {
        return;
      }

      const { start, end } = cursorRef.current;

      const result = insertEmoji(
        textRef.current,
        emoji,
        start,
        end,
        MAX_MESSAGE_LENGTH
      );

      if (!result.inserted) return;

      textRef.current = result.text;

      cursorRef.current = {
        start: result.cursor,
        end: result.cursor,
      };

      pendingCursorRef.current = result.cursor;

      setText(result.text);

      onTyping?.(result.text);

      // Keep the picker open so multiple emojis
      // can be inserted without reopening it.
    },
    [onTyping]
  );

  /* -------------------- GIF PICKER -------------------- */

  const selectGif = useCallback(
    (gif) => {
      if (!gif?.id) return;

      if (useChatStore.getState().sending) {
        return;
      }

      // Cancel pending file processing.

      selectionIdRef.current += 1;

      setProcessing(false);

      // A GIF replaces an existing attachment.

      setAttachment(null);
      setAttachmentError(null);

      setSelectedGif(gif);
      setActivePicker(null);

      focusInput();
    },
    [focusInput]
  );

  function removeGif() {
    if (sending) return;

    setSelectedGif(null);

    focusInput();
  }

  /* -------------------- FILE PICKER -------------------- */

  function openFilePicker() {
    if (pickerDisabled) return;

    setActivePicker(null);

    fileInputRef.current?.click();
  }

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || useChatStore.getState().sending) {
      return;
    }

    const selectionId =
      ++selectionIdRef.current;

    setProcessing(true);
    setAttachmentError(null);

    try {
      let processedFile;

      if (isImageFile(file)) {
        const extension =
          getFileExtension(file.name);

        const mimeType =
          FILE_TYPES[extension];

        const imageFile =
          file.type === mimeType
            ? file
            : new File(
                [file],
                file.name,
                {
                  type: mimeType,
                  lastModified: file.lastModified,
                }
              );

        processedFile =
          await compressImage(imageFile);
      } else {
        validateFile(file);

        processedFile =
          normalizeFile(file);
      }

      if (
        selectionId !== selectionIdRef.current
      ) {
        return;
      }

      // A file replaces an existing GIF.

      setAttachment(processedFile);
      setSelectedGif(null);
      setActivePicker(null);

      focusInput();
    } catch (error) {
      if (
        selectionId === selectionIdRef.current
      ) {
        setAttachmentError(
          error.message ||
            "Unable to process attachment"
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

  function removeAttachment() {
    if (sending) return;

    selectionIdRef.current += 1;

    setAttachment(null);
    setAttachmentError(null);
    setProcessing(false);
  }

  /* -------------------- KEYBOARD SHORTCUTS -------------------- */

  function handleKeyDown(event) {
    if (event.key !== "Escape") return;

    if (activePicker) {
      event.preventDefault();

      closePicker();
    } else if (replyTo) {
      event.preventDefault();

      clearReply();
    } else if (selectedGif) {
      event.preventDefault();

      removeGif();
    } else if (attachment) {
      event.preventDefault();

      removeAttachment();
    }
  }

  /* -------------------- SEND MESSAGE -------------------- */

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSend) return;

    const submittedText = textRef.current;
    const submittedAttachment = attachment;
    const submittedGif = selectedGif;

    setActivePicker(null);

    onStopTyping?.();

    const success = await send(
      submittedText.trim(),
      submittedAttachment,
      userId,
      submittedGif?.id ?? null
    );

    if (!success) return;

    // Preserve any new text entered while sending.

    if (textRef.current === submittedText) {
      textRef.current = "";

      cursorRef.current = {
        start: 0,
        end: 0,
      };

      pendingCursorRef.current = null;

      setText("");
    }

    setAttachment((current) =>
      current === submittedAttachment
        ? null
        : current
    );

    setSelectedGif((current) =>
      current === submittedGif
        ? null
        : current
    );

    setAttachmentError(null);
  }

  /* -------------------- PLACEHOLDER -------------------- */

  const placeholder =
    attachment || selectedGif
      ? "Add a caption..."
      : replyTo
        ? "Type a reply..."
        : "Type a message...";

  /* -------------------- RENDER -------------------- */

  return (
    <div
      className="w-full min-w-0 shrink-0 bg-gray-950"
      onKeyDown={handleKeyDown}
    >
      {/* GIF picker */}

      {gifPickerOpen && (
        <GifPicker
          onSelect={selectGif}
          onClose={closePicker}
        />
      )}

      {/* Emoji picker */}

      {emojiPickerOpen && (
        <EmojiPicker
          onSelect={selectEmoji}
          onClose={closePicker}
        />
      )}

      {/* Reply preview */}

      <ReplyPreview
        message={replyTo}
        senderName={replySenderName}
        onCancel={clearReply}
      />

      {/* Attachment errors */}

      {attachmentError && (
        <p
          role="alert"
          className="px-4 py-2 text-sm text-red-400"
        >
          {attachmentError}
        </p>
      )}

      {/* File preview */}

      {attachment && (
        <AttachmentPreview
          file={attachment}
          onRemove={removeAttachment}
          uploading={sending}
        />
      )}

      {/* GIF preview */}

      {selectedGif && (
        <GifPreview
          gif={selectedGif}
          onRemove={removeGif}
          sending={sending}
        />
      )}

      {/* Message composer */}

      <form
        onSubmit={handleSubmit}
        className="flex min-w-0 items-center gap-1 p-2 sm:gap-3 sm:p-4"
      >
        {/* Hidden file input */}

        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_ACCEPT}
          onChange={handleFileSelection}
          className="hidden"
        />

        {/* Attachment button */}

        <button
          type="button"
          disabled={pickerDisabled}
          onClick={openFilePicker}
          title="Attach a file"
          aria-label="Attach a file"
          className={getPickerButtonClass(
            Boolean(attachment)
          )}
        >
          {processing ? (
            <LoaderCircle
              size={22}
              className="animate-spin"
            />
          ) : (
            <Paperclip size={22} />
          )}
        </button>

        {/* Emoji picker button */}

        <button
          type="button"
          disabled={pickerDisabled}
          onClick={() =>
            togglePicker(COMPOSER_PICKER.EMOJI)
          }
          title="Choose an emoji"
          aria-label="Choose an emoji"
          aria-expanded={emojiPickerOpen}
          className={getPickerButtonClass(
            emojiPickerOpen
          )}
        >
          <Smile size={22} />
        </button>

        {/* GIF picker button */}

        <button
          type="button"
          disabled={pickerDisabled}
          onClick={() =>
            togglePicker(COMPOSER_PICKER.GIF)
          }
          title="Choose a GIF"
          aria-label="Choose a GIF"
          aria-expanded={gifPickerOpen}
          className={getPickerButtonClass(
            gifPickerOpen || Boolean(selectedGif)
          )}
        >
          <span className="rounded border border-current px-1 py-0.5 text-[10px] font-bold leading-none">
            GIF
          </span>
        </button>

        {/* Text input */}

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleChange}
          onSelect={rememberCursor}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={MAX_MESSAGE_LENGTH}
          autoComplete="off"
          aria-label="Message"
          className="block min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-800 px-3 py-3 text-white placeholder-gray-400 outline-none transition-colors focus:border-blue-500 sm:px-4"
        />

        {/* Send button */}

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