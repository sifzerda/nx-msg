// src/app/layout.js

import { Geist, Geist_Mono } from "next/font/google";
import { getCurrentUser } from "@/lib/supabase/server";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SessionInitializer from "@/components/SessionInitializer";

import ThemeProvider from "@/themes/ThemeProvider";
import { APPEARANCE_SCRIPT } from "@/themes/appearanceScript";

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
  const currentUser = await getCurrentUser();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} overflow-clip`}
    >
      <head>
        <script
          id="messenger-appearance"
          dangerouslySetInnerHTML={{
            __html: APPEARANCE_SCRIPT,
          }}
        />
      </head>

      <body className="flex h-dvh min-h-dvh flex-col overflow-clip bg-background text-foreground">
        <ThemeProvider>
          <SessionInitializer
            userId={currentUser?.id ?? null}
          />

          <Header
            key={currentUser?.id ?? "guest"}
            user={currentUser}
          />

          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-clip">
            {children}
          </main>

          <Footer user={currentUser} />
        </ThemeProvider>
      </body>
    </html>
  );
}