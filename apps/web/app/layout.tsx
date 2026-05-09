// ═══════════════════════════════════════════════════════════════
// NovaCal — Root Layout
//
// Imports globals.css for design tokens.
// Provides the Inter font via next/font for optimal loading.
// Wraps the application in Providers (Theme, Session, Toast).
//
// Source: AGENTS.md Rule 61 (dark mode), 25 (error boundaries)
//         docs/05-route-map-web-mobile.md
//         docs/06-design-specification.md
// ═══════════════════════════════════════════════════════════════

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "../components/providers";

// ─── Font Configuration ───

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  fallback: ["monospace"],
});

// ─── Metadata ───

export const metadata: Metadata = {
  title: {
    default: "NovaCal",
    template: "%s — NovaCal",
  },
  description: "Self-hosted intelligent calendar platform",
  keywords: [
    "calendar",
    "scheduling",
    "self-hosted",
    "open-source",
    "collaboration",
  ],
  authors: [{ name: "NovaCal Team" }],
  themeColor: "#000000",
  colorScheme: "dark",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

// ─── Root Layout ───

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        {/* Force dark mode at the system level */}
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="bg-[--background] text-[--text-primary] antialiased">
        <Providers>
          {/* Error boundary is implemented as a route-group error.tsx */}
          {children}
        </Providers>
      </body>
    </html>
  );
}
