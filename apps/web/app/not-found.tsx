// ═══════════════════════════════════════════════════════════════
// NovaCal — 404 Not Found Page
//
// Minimalist typography-based 404 page.
// No illustrations — just clean text and a link back to /calendar.
// Dark theme per AGENTS.md Rule 61.
//
// Source: docs/05-route-map-web-mobile.md §8
//         docs/06-design-specification.md
//         AGENTS.md Rule 100 (no marketing pages)
// ═══════════════════════════════════════════════════════════════

import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[--background] px-6">
      <div className="max-w-sm text-center">
        {/* Large status code — minimal typography */}
        <p className="font-mono text-[6rem] font-bold leading-none tracking-tighter text-[--surface-elevated] select-none">
          404
        </p>

        {/* Message */}
        <h1 className="mt-4 text-lg font-semibold text-[--text-primary]">
          This page doesn&apos;t exist.
        </h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          The page you&apos;re looking for isn&apos;t here. It may have been
          moved or the URL might be incorrect.
        </p>

        {/* Action */}
        <div className="mt-8">
          <Link
            href="/calendar"
            className="inline-flex items-center justify-center rounded-[--radius-base] bg-[--primary-accent] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Go to Calendar
          </Link>
        </div>
      </div>
    </div>
  );
}
