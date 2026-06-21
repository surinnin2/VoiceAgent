"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Two-tab bottom bar. Hidden on the note detail/edit screen for an immersive editing context.
export function TabBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/notes/")) return null; // detail screen
  // Keep the bar off the legacy /recordings detail pages too.
  if (pathname.startsWith("/recordings/")) return null;

  const tab = (href: string, icon: string, label: string, active: boolean) => (
    <Link href={href} className={`tab${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      <span className="tab-icon" aria-hidden="true">{icon}</span>
      <span className="tab-label">{label}</span>
    </Link>
  );

  return (
    <nav className="tabbar">
      {tab("/", "●", "Capture", pathname === "/")}
      {tab("/notes", "≣", "Notes", pathname === "/notes")}
    </nav>
  );
}
