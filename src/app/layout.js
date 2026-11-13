// src/app/layout.js

import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/server";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Messenger",
  description: "Real-time messaging application",
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle();

    profile = data;
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="flex h-dvh flex-col bg-gray-950 text-white">
        <Header user={user ? profile ?? { display_name: "User", username: "" } : null} />

        <main className="min-h-0 flex-1 overflow-hidden">
          {children}
        </main>

        <Footer user={user ? profile ?? { display_name: "User", username: "" } : null} />
      </body>
    </html>
  );
}
