import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: "Voice Notes",
  description: "Hold or tap to record a voice note. It transcribes automatically and sorts into your categories.",
  applicationName: "Voice Notes",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Notes" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app">{children}</div>
        <TabBar />
      </body>
    </html>
  );
}
