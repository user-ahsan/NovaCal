"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { Cpu, Key, Webhook, Code2 } from "lucide-react";
import { cn } from "@novacal/ui/lib/utils";

// ─── Sidebar Items ───

const DEVELOPER_ITEMS = [
  { id: "mcp", label: "MCP Config", href: "/developer/mcp", icon: Cpu },
  { id: "api-keys", label: "API Keys", href: "/developer/api-keys", icon: Key },
  { id: "webhooks", label: "Webhooks", href: "/developer/webhooks", icon: Webhook },
] as const;

// ─── Types ───

interface DeveloperLayoutProps {
  children: ReactNode;
}

// ─── Component ───

export default function DeveloperLayout({ children }: DeveloperLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeId, setActiveId] = useState("mcp");

  useEffect(() => {
    const current = DEVELOPER_ITEMS.find((item) => pathname.startsWith(item.href));
    if (current) setActiveId(current.id);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-[--background]">
      {/* Developer sidebar — denser UI */}
      <aside className="w-56 shrink-0 border-r border-[--border-subtle] bg-[--surface] p-3">
        {/* Header */}
        <div className="mb-4 flex items-center gap-2 px-3">
          <Code2 size={16} className="text-[--primary-accent]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[--primary-accent]">
            Developer
          </span>
        </div>

        <nav className="flex flex-col gap-0.5">
          <LayoutGroup>
            {DEVELOPER_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-[--radius-base] px-3 py-2 text-sm font-medium transition-none",
                    "hover:bg-[--ghost-hover]",
                    isActive ? "text-[--text-primary]" : "text-[--text-secondary]",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="developer-active-pill"
                      className="absolute inset-0 rounded-[--radius-base] bg-[--ghost-active]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}

                  <span className="relative z-10 flex items-center gap-3">
                    <Icon size={15} className="shrink-0" />
                    <span>{item.label}</span>
                  </span>
                </button>
              );
            })}
          </LayoutGroup>
        </nav>
      </aside>

      {/* Main content — denser spacing for developer pages */}
      <main className="flex-1 overflow-y-auto p-5">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="space-y-4"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
