import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { PwaRegistration } from "@/components/pwa-registration";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Outreach Console",
  description: "A focused sales CRM for calls, follow-ups, meetings, and deals.",
  appleWebApp: {
    capable: true,
    title: "Outreach",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#24304d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background">
        <PwaRegistration />
        <NavBar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
