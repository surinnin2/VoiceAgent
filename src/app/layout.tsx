import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "VoiceAgent — record & transcribe",
  description:
    "Record voice and transcribe it with accuracy-optimized engines. Retry across engines if you're not satisfied.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
