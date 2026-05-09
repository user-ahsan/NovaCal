// ═══════════════════════════════════════════════════════════════
// NovaCal — Public Route Group Layout
//
// Minimal centered layout for public sharing pages.
// No sidebar, no navigation, no auth required.
// Used by: /p/[hash] (public calendar), /e/[hash] (single event)
//
// Source: docs/05-route-map-web-mobile.md §7
//         docs/06-design-specification.md
//         AGENTS.md Rule 100 (no marketing pages — share links only)
// ═══════════════════════════════════════════════════════════════

import type { ReactNode } from "react";

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-[--background]">
      {children}
    </div>
  );
}
