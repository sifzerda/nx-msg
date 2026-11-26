// src/components/MessageBubble.jsx

"use client";

import {
  memo,
  useCallback,
  useMemo,
} from "react";

import {
  Check,
  CheckCheck,
  Reply,
} from "lucide-react";

import { isPreviewAllowed } from "@/utils/previewUrlPolicy";
import { extractUrls } from "@/utils/urlUtils";

import QuotedMessage from "./extras/QuotedMessage";
import ReactionPicker from "./extras/ReactionPicker";
import MessageReactions from "./MessageReactions";

import ImageAttachment from "./extras/ImageAttachment";
import FileAttachment from "./extras/FileAttachment";
import GifMessage from "./extras/GifMessage";

import MessageText from "./extras/MessageText";
import LinkPreview from "./extras/LinkPreview";

/* -------------------- CONSTANTS -------------------- */

const EMPTY_REACTIONS = Object.freeze([]);

const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
});

/* -------------------- COMPONENT -------------------- */

function MessageBubble({
  message,
  isOwn,
  isRead,
  showReadStatus = true,

  // Message replies
  quotedMessage,
  quotedSenderName,
  onReply,
  onJumpToMessage,

  // Emoji reactions
  reactions = EMPTY_REACTIONS,
  userId,
  onToggleReaction,
}) {
  const time = timeFormatter.format(
    new Date(message.created_at)
  );

  /* -------------------- PERMISSIONS -------------------- */

  const canReply = typeof onReply === "function";

  const canReact =
    typeof onToggleReaction === "function";

  const hasActions = canReply || canReact;

  /* -------------------- MESSAGE CONTENT -------------------- */

  const hasGif = Boolean(message.gif_id);

  const hasImage =
    message.attachment_type === "image" &&
    Boolean(message.attachment_path);

  const hasFile =
    message.attachment_type === "file" &&
    Boolean(message.attachment_path);

  const hasMedia = hasGif || hasImage || hasFile;

  const hasContent = Boolean(message.content?.trim());

  /* -------------------- LINK PREVIEW -------------------- */

  const previewUrl = useMemo(() => {
    const [url] = extractUrls(
      message.content || "",
      1
    );

    if (!url || !isPreviewAllowed(url)) {
      return null;
    }

    return url;
  }, [message.content]);

  /* -------------------- REACTIONS -------------------- */

  const selectedEmojis = useMemo(() => {
    if (!canReact || !reactions.length) {
      return EMPTY_REACTIONS;
    }

    return reactions
      .filter(
        (reaction) => reaction.user_id === userId
      )
      .map((reaction) => reaction.emoji);

  }, [reactions, userId, canReact]);

  const handleReaction = useCallback(
    (emoji) => {
      onToggleReaction?.(message.id, emoji);
    },
    [message.id, onToggleReaction]
  );

  /* -------------------- REPLIES -------------------- */

  const handleReply = useCallback(() => {
    onReply?.(message);
  }, [message, onReply]);

  const handleJumpToMessage = useCallback(() => {
    if (message.reply_to_id) {
      onJumpToMessage?.(message.reply_to_id);
    }
  }, [message.reply_to_id, onJumpToMessage]);

  /* -------------------- RENDER -------------------- */

  return (
    <div
      className={[
        "group flex min-w-0 items-center gap-1 sm:gap-2",
        isOwn ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      {/* Message actions */}

      {hasActions && (
        <div
          className={[
            "flex shrink-0 items-center transition-opacity",
            "md:opacity-0 md:group-hover:opacity-100",
            "md:group-focus-within:opacity-100",
            isOwn ? "order-first" : "order-last",
          ].join(" ")}
        >
          {canReact && (
            <ReactionPicker
              isOwn={isOwn}
              selectedEmojis={selectedEmojis}
              onSelect={handleReaction}
            />
          )}

          {canReply && (
            <button
              type="button"
              onClick={handleReply}
              aria-label="Reply to message"
              title="Reply to message"
              className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-blue-400"
            >
              <Reply size={17} />
            </button>
          )}
        </div>
      )}

      {/* Message and reactions */}

      <div
        className={[
          "min-w-0",

          canReply && canReact
            ? "max-w-[calc(100%-80px)]"
            : hasActions
              ? "max-w-[calc(100%-44px)]"
              : "max-w-full",

          "sm:max-w-[75%]",

          previewUrl ? "w-96" : "",
        ].join(" ")}
      >
        <div
          className={[
            "min-w-0 rounded-2xl px-4 py-2.5",

            isOwn
              ? "rounded-br-sm bg-blue-600 text-white"
              : "rounded-bl-sm bg-gray-800 text-gray-100",
          ].join(" ")}
        >
          {/* Quoted reply */}

          {message.reply_to_id && (
            <QuotedMessage
              message={quotedMessage}
              senderName={quotedSenderName}
              isOwn={isOwn}
              onClick={
                quotedMessage && onJumpToMessage
                  ? handleJumpToMessage
                  : undefined
              }
            />
          )}

          {/* GIF attachment */}

          {hasGif && (
            <GifMessage
              key={message.gif_id}
              gifId={message.gif_id}
            />
          )}

          {/* Image attachment */}

          {hasImage && (
            <ImageAttachment
              path={message.attachment_path}
              name={message.attachment_name}
              userId={userId}
            />
          )}

          {/* File attachment */}

          {hasFile && (
            <FileAttachment
              path={message.attachment_path}
              name={message.attachment_name}
              size={message.attachment_size}
            />
          )}

          {/* Message text or media caption */}

          {hasContent && (
            <MessageText
              content={message.content}
              isOwn={isOwn}
              className={hasMedia ? "mt-2" : ""}
            />
          )}

          {/* Automatic link preview */}

          {previewUrl && userId && (
            <LinkPreview
              key={`${userId}:${message.id}:${previewUrl}`}
              messageId={message.id}
              userId={userId}
              url={previewUrl}
            />
          )}

          {/* Timestamp and read receipts */}

          <div
            className={[
              "mt-1 flex items-center justify-end gap-1",
              "text-[11px]",

              isOwn
                ? "text-blue-200"
                : "text-gray-400",
            ].join(" ")}
          >
            <time dateTime={message.created_at}>
              {time}
            </time>

            {isOwn && showReadStatus && (
              isRead ? (
                <CheckCheck
                  size={15}
                  className="text-cyan-300"
                  aria-label="Read"
                />
              ) : (
                <Check
                  size={15}
                  aria-label="Sent"
                />
              )
            )}
          </div>
        </div>

        {/* Existing emoji reactions */}

        <MessageReactions
          reactions={reactions}
          userId={userId}
          isOwn={isOwn}
          onToggle={handleReaction}
        />
      </div>
    </div>
  );
}

export default memo(MessageBubble);