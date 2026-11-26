// src/components/MessageBubble.jsx

"use client";

import { memo, useCallback, useMemo } from "react";
import { Check, CheckCheck, Reply } from "lucide-react";
import QuotedMessage from "./extras/QuotedMessage";
import ReactionPicker from "./extras/ReactionPicker";
import MessageReactions from "./MessageReactions";
import ImageAttachment from "./extras/ImageAttachment";

const EMPTY_REACTIONS = [];
const timeFormatter = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" });

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
  const time = timeFormatter.format(new Date(message.created_at));

  const selectedEmojis = useMemo(() => {
    return reactions
      .filter((reaction) => reaction.user_id === userId)
      .map((reaction) => reaction.emoji);
  }, [reactions, userId]);

  const handleReaction = useCallback((emoji) => { onToggleReaction?.(message.id, emoji) }, [message.id, onToggleReaction]);

  return (
    <div className={`group flex min-w-0 items-center gap-1 sm:gap-2 ${isOwn ? "justify-end" : "justify-start"
      }`}
    >
      {/* Message actions */}
      <div
        className={`flex shrink-0 items-center transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${isOwn ? "order-first" : "order-last"
          }`}
      >
        <ReactionPicker
          isOwn={isOwn}
          selectedEmojis={selectedEmojis}
          onSelect={handleReaction}
        />

        <button
          type="button"
          onClick={() => onReply?.(message)}
          aria-label="Reply to message"
          title="Reply to message"
          className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-blue-400"
        >
          <Reply size={17} />
        </button>
      </div>

      {/* Message and reactions */}
      <div className="min-w-0 max-w-[calc(100%-80px)] sm:max-w-[75%]">
        <div
          className={`min-w-0 rounded-2xl px-4 py-2.5 ${isOwn
              ? "rounded-br-sm bg-blue-600 text-white"
              : "rounded-bl-sm bg-gray-800 text-gray-100"
            }`}
        >
          {/* Quoted reply */}
          {message.reply_to_id && (
            <QuotedMessage
              message={quotedMessage}
              senderName={quotedSenderName}
              isOwn={isOwn}
              onClick={() =>
                onJumpToMessage?.(
                  message.reply_to_id
                )
              }
            />
          )}

          {/* Message content */}
          {message.attachment_type === "image" &&
            message.attachment_path && (
              <ImageAttachment
                path={message.attachment_path}
                name={message.attachment_name}
                userId={userId}
              />
            )}

          {message.content && (
            <p className="whitespace-pre-wrap wrap-break-word text-sm">
              {message.content}
            </p>
          )}

          {/* Timestamp and read receipts */}
          <div
            className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${isOwn
                ? "text-blue-200"
                : "text-gray-400"
              }`}
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

        {/* Emoji reactions */}
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
