// src/app/messages/[id]/page.js

import { notFound } from "next/navigation";

import {
  createClient,
  requireUser,
} from "@/lib/supabase/server";

import ChatWindow from "@/components/ChatWindow";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ConversationPage({
  params,
}) {
  const { id } = await params;

  const user = await requireUser();

  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id)
  ) {
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