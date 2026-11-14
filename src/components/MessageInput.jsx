// src/components/MessageInput.jsx

"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import useChatStore from "@/store/useChatStore";

export default function MessageInput() {
  const [text, setText] = useState("");

  const send = useChatStore((s) => s.send);
  const sending = useChatStore((s) => s.sending);

  async function handleSubmit(e) {
    e.preventDefault();

    const content = text.trim();
    if (!content || sending) return;

    const success = await send(content);

    if (success) {
      setText("");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 border-t border-gray-800 p-4"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        maxLength={5000}
        className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-blue-500"
      />

      <button
        type="submit"
        disabled={!text.trim() || sending}
        aria-label="Send message"
        className="rounded-xl bg-blue-600 p-3 text-white hover:bg-blue-500 disabled:opacity-50"
      >
        <Send size={20} />
      </button>
    </form>
  );
}
