// src/components/ContactCard.jsx

import { UserRound, UserPlus, UserMinus } from "lucide-react";

export default function ContactCard({
  user,
  isContact = false,
  onAdd,
  onRemove,
  disabled = false,
}) {
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
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRemove?.(user.id)}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white transition hover:bg-red-500 disabled:opacity-50"
        >
          <UserMinus size={16} />
          Remove
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdd?.(user.id)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          <UserPlus size={16} />
          Add
        </button>
      )}
    </div>
  );
}
