// src/components/ContactCard.jsx

import { UserRound, UserPlus, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { startChat } from "@/lib/messages";

export default function ContactCard({
  user,
  isContact = false,
  onAdd,
  onRemove,
  disabled = false,
}) {

  const router = useRouter();

  async function handleStartChat() {
    try {
      const conversationId = await startChat(user.id);
      router.push(`/messages/${conversationId}`);
    } catch (error) {
      console.error("Unable to start chat:", error.message);
      alert(error.message);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-800">
          <UserRound className="text-gray-400" size={22} />
        </div>

        <div className="min-w-0">
          <h3 className="truncate font-semibold text-white">
            {user.display_name}
          </h3>

          <p className="truncate text-sm text-gray-400">
            @{user.username}
          </p>
        </div>
      </div>

      {isContact ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleStartChat}
            disabled={disabled}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <MessageCircle size={16} />
            Message
          </button>

          <button
            type="button"
            onClick={() => onRemove?.(user.id)}
            disabled={disabled}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onAdd?.(user.id)}
          disabled={disabled}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Add
        </button>
      )}
    </div>
  );
}
