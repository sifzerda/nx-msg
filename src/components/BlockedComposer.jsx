// src/components/extras/BlockedComposer.jsx

import { memo } from "react";
import { Ban, LoaderCircle } from "lucide-react";

function BlockedComposer({
  isBlockedByMe,
  messagingUnavailable,
}) {
  if (!messagingUnavailable) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-5 text-sm text-gray-500">
        <LoaderCircle
          size={16}
          className="animate-spin"
        />

        Loading conversation permissions...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-5 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-gray-400">
        <Ban size={20} />
      </div>

      <p className="text-sm font-medium text-gray-300">
        {isBlockedByMe
          ? "You have blocked this user"
          : "Messaging is unavailable"}
      </p>

      <p className="max-w-sm text-xs leading-relaxed text-gray-500">
        {isBlockedByMe
          ? "Unblock this user from the conversation options to allow private messaging again, if they have not also blocked you."
          : "You cannot currently send messages in this conversation."}
      </p>
    </div>
  );
}

export default memo(BlockedComposer);