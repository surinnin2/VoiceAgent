import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: "Voice Notes",
  description: "Hold or tap to record a voice note. It transcribes automatically and sorts into your categories.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Notes" },
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
