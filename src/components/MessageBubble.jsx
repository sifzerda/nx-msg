// src/components/messages/MessageBubble.jsx

export default function MessageBubble({ message, isOwn }) {
  const time = new Date(message.created_at).toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" }
  );

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isOwn
            ? "bg-blue-600 text-white"
            : "bg-gray-800 text-gray-100"
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm">
          {message.content}
        </p>

        <p className="mt-1 text-right text-xs opacity-60">
          {time}
        </p>
      </div>
    </div>
  );
}
