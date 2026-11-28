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

import { insertEmoji } from "@/utils/emojiUtils";
import { isImageFile, normalizeFile } from "@/utils/fileUtils";
import { FILE_ACCEPT } from "@/constants/attachments";

import {
  MAX_MESSAGE_LENGTH,
  COMPOSER_PICKER,
} from "@/constants/emojis";

import { ReplyPreview } from "./MessageReply";
import AttachmentPreview from "./extras/AttachmentPreview";

/* -------------------- LAZY LOADING -------------------- */

function PickerLoading({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-gray-800 bg-gray-900 py-8 text-sm text-gray-400">
      <LoaderCircle size={20} className="animate-spin" />
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

async function prepareFile(file) {
  if (!isImageFile(file)) {
    return normalizeFile(file);
  }

  const { compressImage } = await import(
    "@/utils/compressImage"
  );

  return compressImage(file);
}

/* -------------------- HELPERS -------------------- */

function getCursor(input) {
  return {
    start: input.selectionStart ?? input.value.length,
    end: input.selectionEnd ?? input.value.length,
  };
}

function PickerButton({
  label,
  active = false,
  expanded,
  disabled,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded={expanded}
      className={`flex shrink-0 items-center justify-center rounded-xl p-2 transition-colors disabled:opacity-50 sm:p-2.5 ${
        active
          ? "bg-blue-600/20 text-blue-400"
          : "text-gray-400 hover:bg-gray-800 hover:text-blue-400"
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------- MESSAGE INPUT -------------------- */

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
  const textVersionRef = useRef(0);

  const cursorRef = useRef({ start: 0, end: 0 });
  const pendingCursorRef = useRef(null);

  const [text, setText] = useState("");
  const [media, setMedia] = useState(null);
  const [activePicker, setActivePicker] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [attachmentError, setAttachmentError] = useState(null);

  const sending = useChatStore((s) => s.sending);
  const replyTo = useChatStore((s) => s.replyTo);

  const attachment = media?.type === "file"
    ? media.value
    : null;

  const selectedGif = media?.type === "gif"
    ? media.value
    : null;

  const gifPickerOpen = activePicker === COMPOSER_PICKER.GIF;
  const emojiPickerOpen = activePicker === COMPOSER_PICKER.EMOJI;

  const pickerDisabled = sending || processing;

  const canSend =
    !pickerDisabled &&
    Boolean(text.trim() || media);

  const placeholder = media
    ? "Add a caption..."
    : replyTo
      ? "Type a reply..."
      : "Type a message...";

  /* -------------------- CURSOR -------------------- */

  const rememberCursor = useCallback(() => {
    const input = inputRef.current;

    if (input) {
      cursorRef.current = getCursor(input);
    }
  }, []);

  const focusInput = useCallback(() => {
    const input = inputRef.current;

    if (!input) return;

    const { start, end } = cursorRef.current;

    input.focus();

    input.setSelectionRange(
      Math.min(start, input.value.length),
      Math.min(end, input.value.length)
    );
  }, []);

  useLayoutEffect(() => {
    const cursor = pendingCursorRef.current;

    if (cursor === null) return;

    pendingCursorRef.current = null;
    inputRef.current?.setSelectionRange(cursor, cursor);
  }, [text]);

  useEffect(() => {
    if (replyTo) focusInput();
  }, [replyTo, focusInput]);

  useEffect(() => {
    return () => {
      selectionIdRef.current += 1;
    };
  }, []);

  /* -------------------- TEXT -------------------- */

  const updateText = useCallback(
    (value) => {
      textRef.current = value;
      textVersionRef.current += 1;

      setText(value);
      onTyping?.(value);
    },
    [onTyping]
  );

  function handleChange(event) {
    cursorRef.current = getCursor(event.target);
    pendingCursorRef.current = null;

    updateText(event.target.value);
  }

  function handleBlur() {
    rememberCursor();
    onStopTyping?.();
  }

  /* -------------------- PICKERS -------------------- */

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

  const selectEmoji = useCallback(
    (emoji) => {
      if (useChatStore.getState().sending) return;

      const { start, end } = cursorRef.current;

      const result = insertEmoji(
        textRef.current,
        emoji,
        start,
        end,
        MAX_MESSAGE_LENGTH
      );

      if (!result.inserted) return;

      cursorRef.current = {
        start: result.cursor,
        end: result.cursor,
      };

      pendingCursorRef.current = result.cursor;

      updateText(result.text);
    },
    [updateText]
  );

  /* -------------------- MEDIA -------------------- */

  const replaceMedia = useCallback(
    (nextMedia) => {
      selectionIdRef.current += 1;

      setMedia(nextMedia);
      setProcessing(false);
      setAttachmentError(null);
      setActivePicker(null);

      focusInput();
    },
    [focusInput]
  );

  const selectGif = useCallback(
    (gif) => {
      if (!gif?.id || useChatStore.getState().sending) {
        return;
      }

      replaceMedia({
        type: "gif",
        value: gif,
      });
    },
    [replaceMedia]
  );

  const removeMedia = useCallback(() => {
    if (useChatStore.getState().sending) return;

    replaceMedia(null);
  }, [replaceMedia]);

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

    const selectionId = ++selectionIdRef.current;

    setProcessing(true);
    setAttachmentError(null);

    try {
      const processedFile = await prepareFile(file);

      if (selectionId !== selectionIdRef.current) {
        return;
      }

      setMedia({
        type: "file",
        value: processedFile,
      });

      setActivePicker(null);
      focusInput();
    } catch (error) {
      if (selectionId === selectionIdRef.current) {
        setAttachmentError(
          error?.message || "Unable to process attachment"
        );
      }
    } finally {
      if (selectionId === selectionIdRef.current) {
        setProcessing(false);
      }
    }
  }

  /* -------------------- KEYBOARD -------------------- */

  function clearReply() {
    useChatStore.getState().clearReply();
  }

  function handleKeyDown(event) {
    if (event.key !== "Escape") return;

    if (activePicker) {
      event.preventDefault();
      closePicker();
    } else if (replyTo) {
      event.preventDefault();
      clearReply();
    } else if ((media || processing) && !sending) {
      event.preventDefault();
      removeMedia();
    }
  }

  /* -------------------- SUBMISSION -------------------- */

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSend || useChatStore.getState().sending) {
      return;
    }

    const submittedText = textRef.current;
    const submittedVersion = textVersionRef.current;
    const submittedMedia = media;

    setActivePicker(null);
    onStopTyping?.();

    const success = await useChatStore.getState().send(
      submittedText.trim(),
      attachment,
      userId,
      selectedGif?.id ?? null
    );

    if (!success) return;

    // Preserve text edited while sending, even if
    // the user eventually enters the same text again.

    if (textVersionRef.current === submittedVersion) {
      textRef.current = "";
      textVersionRef.current += 1;

      cursorRef.current = { start: 0, end: 0 };
      pendingCursorRef.current = null;

      setText("");
    }

    setMedia((current) =>
      current === submittedMedia ? null : current
    );

    setAttachmentError(null);
  }

  /* -------------------- RENDER -------------------- */

  return (
    <div
      className="w-full min-w-0 shrink-0 bg-gray-950"
      onKeyDown={handleKeyDown}
    >
      {gifPickerOpen && (
        <GifPicker
          onSelect={selectGif}
          onClose={closePicker}
        />
      )}

      {emojiPickerOpen && (
        <EmojiPicker
          onSelect={selectEmoji}
          onClose={closePicker}
        />
      )}

      <ReplyPreview
        message={replyTo}
        senderName={replySenderName}
        onCancel={clearReply}
      />

      {attachmentError && (
        <p role="alert" className="px-4 py-2 text-sm text-red-400">
          {attachmentError}
        </p>
      )}

      {media && (
        <AttachmentPreview
          file={attachment}
          gif={selectedGif}
          sending={sending}
          onRemove={removeMedia}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="flex min-w-0 items-center gap-1 p-2 sm:gap-3 sm:p-4"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_ACCEPT}
          onChange={handleFileSelection}
          className="hidden"
        />

        <PickerButton
          label="Attach a file"
          active={Boolean(attachment)}
          disabled={pickerDisabled}
          onClick={openFilePicker}
        >
          {processing ? (
            <LoaderCircle size={22} className="animate-spin" />
          ) : (
            <Paperclip size={22} />
          )}
        </PickerButton>

        <PickerButton
          label="Choose an emoji"
          active={emojiPickerOpen}
          expanded={emojiPickerOpen}
          disabled={pickerDisabled}
          onClick={() => togglePicker(COMPOSER_PICKER.EMOJI)}
        >
          <Smile size={22} />
        </PickerButton>

        <PickerButton
          label="Choose a GIF"
          active={gifPickerOpen || Boolean(selectedGif)}
          expanded={gifPickerOpen}
          disabled={pickerDisabled}
          onClick={() => togglePicker(COMPOSER_PICKER.GIF)}
        >
          <span className="rounded border border-current px-1 py-0.5 text-[10px] font-bold leading-none">
            GIF
          </span>
        </PickerButton>

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

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="flex shrink-0 items-center justify-center rounded-xl bg-blue-600 p-3 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (
            <LoaderCircle size={20} className="animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>
    </div>
  );
}

export default memo(MessageInput);