// src/app/messages/[id]/page.js

import { notFound } from "next/navigation";

import {
  createClient,
  requireUser,
} from "@/lib/supabase/server";

import { isUuid } from "@/utils/validation";

import ChatWindow from "@/components/ChatWindow";

export default async function ConversationPage({ params }) {
  const { id } = await params;

  const user = await requireUser();

  if (!isUuid(id)) {
    notFound();
  }

  const supabase = await createClient();

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error || !conversation) {
    notFound();
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <ChatWindow
        conversationId={conversation.id}
        userId={user.id}
      />
    </div>
  );
}