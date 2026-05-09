"use client";

// ═══════════════════════════════════════════════════════════════
// NovaCal — Dashboard Layout
//
// Sidebar + edge-to-edge canvas.
// Translucent sidebar (240px, collapsible) with:
//   - Calendar toggles (hover-reveal eye icon)
//   - + Add Calendar button
//   - MiniMonthNavigator
//   - User avatar + dropdown menu at bottom
//   - Cmd+K trigger indicator
//
// Source: docs/05-route-map-web-mobile.md §2 (Core Application)
//         docs/06-design-specification.md §2-A (The Global Interface)
//         AGENTS.md Rule 70 (glassmorphism blur)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  ListTodo,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Settings,
  LogOut,
  User as UserIcon,
  LayoutGrid,
} from "lucide-react";
import {
  Button,
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  ScrollArea,
  Badge,
} from "@novacal/ui";
import { SPRING_SWIFT, SPRING_FLUID } from "@novacal/shared";
import { cn } from "@novacal/ui/lib/utils";
import { MiniMonthNavigator } from "../../components/MiniMonthNavigator";
import { AICommandBar } from "../../components/AICommandBar";
import { useSession } from "../../components/providers";

// ─── Types ───

interface CalendarToggle {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

// ─── Constants ───

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 0; // Fully collapsed — just a thin trigger strip

const NAV_ITEMS = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/agenda", label: "Agenda", icon: ListTodo },
  { href: "/search", label: "Search", icon: Search },
] as const;

// ─── Component ───

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useSession();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendars, setCalendars] = useState<CalendarToggle[]>([
    { id: "1", name: "Personal", color: "#6366F1", visible: true },
    { id: "2", name: "Work", color: "#22C55E", visible: true },
    { id: "3", name: "Freelance", color: "#F59E0B", visible: true },
  ]);

  // Toggle calendar visibility
  const toggleCalendar = useCallback((id: string) => {
    setCalendars((prev) =>
      prev.map((cal) =>
        cal.id === id ? { ...cal, visible: !cal.visible } : cal,
      ),
    );
  }, []);

  // Keyboard shortcut: Cmd+B to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle date select from MiniMonthNavigator
  const handleDateSelect = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      // Navigate to calendar with the selected date
      const params = new URLSearchParams();
      params.set("date", date.toISOString().split("T")[0]);
      router.push(`/calendar?${params.toString()}`);
    },
    [router],
  );

  // Handle AI command submission
  const handleAICommand = useCallback(
    async (text: string) => {
      // For now, redirect to search with the query
      // In production, this would call the MCP server
      router.push(`/search?q=${encodeURIComponent(text)}`);
    },
    [router],
  );

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "NC";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[--background]">
      {/* ─── Sidebar ─── */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: SIDEBAR_WIDTH, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={SPRING_FLUID}
            className="relative flex-shrink-0 h-full border-r border-[--border-elevated] overflow-hidden"
            style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          >
            {/* Translucent background */}
            <div className="absolute inset-0 bg-[--surface]/80" />

            {/* Content (relative to appear above the blur) */}
            <div className="relative flex flex-col h-full z-10">
              {/* ── Collapse Button ── */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-[--primary-accent]" />
                  <span className="text-sm font-semibold text-[--text-primary] tracking-wide">
                    NovaCal
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[--text-muted] hover:text-[--text-primary]"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>

              {/* ── Navigation ── */}
              <nav className="px-2 py-2 space-y-0.5">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[--radius-base] px-3 py-2 text-sm font-medium transition-none",
                        "hover:bg-[--ghost-hover]",
                        isActive
                          ? "bg-[--primary-accent-muted] text-[--primary-accent]"
                          : "text-[--text-secondary]",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* ── Calendar Toggles ── */}
              <div className="px-3 mt-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[--text-muted]">
                    My Calendars
                  </span>
                  <span className="text-[--text-muted] border border-[--border-subtle] rounded-[--radius-base] px-1.5 py-0.5 text-[10px] cursor-pointer hover:text-[--text-primary] hover:border-[--text-muted] transition-none">
                    + Add
                  </span>
                </div>
                <div className="space-y-0.5">
                  {calendars.map((cal) => (
                    <div
                      key={cal.id}
                      className="group flex items-center gap-2 px-2 py-1.5 rounded-[--radius-base] hover:bg-[--ghost-hover] cursor-pointer transition-none"
                      onClick={() => toggleCalendar(cal.id)}
                    >
                      {/* Color dot */}
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cal.color }}
                      />
                      {/* Calendar name */}
                      <span
                        className={cn(
                          "text-xs flex-1 transition-none",
                          cal.visible
                            ? "text-[--text-primary]"
                            : "text-[--text-muted] line-through",
                        )}
                      >
                        {cal.name}
                      </span>
                      {/* Eye icon — visible on hover */}
                      <span className="opacity-0 group-hover:opacity-100 transition-none">
                        {cal.visible ? (
                          <Eye className="h-3 w-3 text-[--text-muted]" />
                        ) : (
                          <EyeOff className="h-3 w-3 text-[--text-muted]" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Mini Month Navigator ── */}
              <div className="px-3 mt-2">
                <MiniMonthNavigator
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                />
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* ── Cmd+K Indicator ── */}
              <div className="px-3 pb-2">
                <AICommandBar onSubmit={handleAICommand} />
              </div>

              {/* ── User Avatar + Dropdown ── */}
              <div className="px-2 pb-3 pt-1 border-t border-[--border-elevated]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-[--radius-base] px-2 py-2 hover:bg-[--ghost-hover] transition-none"
                    >
                      <Avatar className="h-8 w-8">
                        {user?.avatarUrl ? (
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-[--text-primary] truncate">
                          {user?.name ?? "User"}
                        </p>
                        <p className="text-[11px] text-[--text-muted] truncate">
                          {user?.email ?? ""}
                        </p>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="start"
                    className="w-56"
                  >
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => router.push("/settings/profile")}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => router.push("/settings/security")}
                    >
                      <UserIcon className="mr-2 h-4 w-4" />
                      Security
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-[--destructive]"
                      onClick={async () => {
                        try {
                          await fetch("/api/auth/logout", { method: "POST" });
                          window.location.href = "/login";
                        } catch {
                          window.location.href = "/login";
                        }
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ─── Sidebar Toggle Button (when collapsed) ─── */}
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 h-10 w-6 flex items-center justify-center bg-[--surface] border border-[--border-elevated] rounded-r-[--radius-base] text-[--text-muted] hover:text-[--text-primary] transition-none"
          aria-label="Open sidebar"
        >
          <PanelLeft className="h-3.5 w-3.5" />
        </button>
      )}

      {/* ─── Main Canvas (Edge-to-Edge) ─── */}
      <main className="flex-1 relative overflow-hidden bg-[--background]">
        {children}
      </main>
    </div>
  );
}
