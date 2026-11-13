// src/app/messages/[id]/page.js

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatWindow from "@/components/ChatWindow";

export default async function ConversationPage({ params }) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error || !conversation) {
    notFound();
  }

  return (
    <ChatWindow
      conversationId={conversation.id}
      userId={user.id}
    />
  );
}
