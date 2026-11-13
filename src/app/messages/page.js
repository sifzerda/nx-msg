// src/app/messages/page.js

export default function MessagesPage() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Your Messages
        </h1>

        <p className="mt-3 text-gray-400">
          Select a conversation or start a new chat
          from your contacts.
        </p>
      </div>
    </div>
  );
}
