// src/app/layout.js

import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PushNotificationInitializer from "@/components/PushNotificationInitializer";
import ThemeProvider from "@/theme/ThemeProvider";
import AppearanceScript from "@/theme/AppearanceScript";

import "./globals.css";

/* -------------------- FONTS -------------------- */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* -------------------- METADATA -------------------- */

export const metadata = {
  title: "Messenger",
  description: "Real-time messaging application",
};

/* -------------------- ROOT LAYOUT -------------------- */

export default async function RootLayout({ children }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", user.id)
      .maybeSingle();

    profile = data;
  }

  const currentUser = user
    ? {
        id: user.id,
        username: profile?.username ?? "",
        display_name: profile?.display_name ?? "User",
      }
    : null;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <AppearanceScript />
      </head>

      <body className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">

        <ThemeProvider>

          {/* Background notification management */}

          <PushNotificationInitializer
            userId={currentUser?.id ?? null}
          />

          {/* Application header */}

          <Header user={currentUser} />

          {/* Page content */}

          <main className="min-h-0 flex-1 overflow-hidden">
            {children}
          </main>

          {/* Application footer */}

          <Footer user={currentUser} />

        </ThemeProvider>

      </body>
    </html>
  );
}