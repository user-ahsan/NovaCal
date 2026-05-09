"use client";

// ═══════════════════════════════════════════════════════════════
// NovaCal — Client Providers
//
// Wraps the application in required context providers:
//   - ThemeProvider: Dark-mode-first theme context
//   - SessionProvider: Auth session context
//   - Toaster (Sonner): Toast notification system
//
// Source: AGENTS.md Rule 25 (error boundaries), 61 (dark mode first)
// ═══════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect } from "react";
import { Toaster } from "@novacal/ui";
import { TooltipProvider } from "@novacal/ui";

// ─── Theme Context ───
// Dark-mode-first. Light mode is a variant, not the primary.
// AGENTS.md Rule 61: "Dark mode first. Default theme is OLED black."

type Theme = "dark" | "light" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  resolvedTheme: "dark",
});

export function useTheme() {
  return useContext(ThemeContext);
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("novacal-theme", newTheme);
    } catch {}
  };

  useEffect(() => {
    // Read stored theme preference
    try {
      const stored = localStorage.getItem("novacal-theme") as Theme | null;
      if (stored) {
        setThemeState(stored);
      }
    } catch {}

    // Listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme === "system") {
        setResolvedTheme(mediaQuery.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  useEffect(() => {
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setResolvedTheme(isDark ? "dark" : "light");
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Session Context ───
// Provides auth session state across the application.

interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface SessionContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  isLoading: true,
  refresh: async () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            avatarUrl: data.user.image ?? null,
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  return (
    <SessionContext.Provider
      value={{ user, isLoading, refresh: fetchSession }}
    >
      {children}
    </SessionContext.Provider>
  );
}

// ─── Composite Providers ───

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              },
            }}
          />
        </TooltipProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
