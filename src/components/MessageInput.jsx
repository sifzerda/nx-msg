// src/components/MessageInput.jsx

"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import useChatStore from "@/store/useChatStore";

export default function MessageInput() {
  const [text, setText] = useState("");
  const send = useChatStore((s) => s.send);
  const sending = useChatStore((s) => s.sending);

  async function handleSubmit(event) {
    event.preventDefault();

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
      className="flex w-full min-w-0 shrink-0 items-center gap-3 bg-gray-950 p-3 sm:p-4"
    >
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Type a message..."
        maxLength={5000}
        autoComplete="off"
        aria-label="Message"
        className="block min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-400 outline-none transition-colors focus:border-blue-500"
      />

      <button
        type="submit"
        disabled={!text.trim() || sending}
        aria-label="Send message"
        className="flex shrink-0 items-center justify-center rounded-xl bg-blue-600 p-3 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send size={20} />
      </button>
    </form>
  );
}
