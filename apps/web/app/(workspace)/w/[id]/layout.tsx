"use client";

import { usePathname, useRouter, useParams } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { Settings, Users } from "lucide-react";
import { cn } from "@novacal/ui/lib/utils";

// ─── Sidebar Items ───

const WORKSPACE_ITEMS = [
  { id: "settings", label: "Settings", href: "", icon: Settings as React.ElementType },
  { id: "members", label: "Members", href: "/members", icon: Users as React.ElementType },
] as const;

// ─── Types ───

interface WorkspaceLayoutProps {
  children: ReactNode;
}

// ─── Component ───

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;

  const [activeId, setActiveId] = useState("settings");

  useEffect(() => {
    const current = WORKSPACE_ITEMS.find(
      (item) =>
        item.id === "settings"
          ? pathname === `/w/${workspaceId}` || pathname === `/w/${workspaceId}/settings`
          : pathname === `/w/${workspaceId}/members`,
    );
    if (current) setActiveId(current.id);
  }, [pathname, workspaceId]);

  const basePath = `/w/${workspaceId}`;

  return (
    <div className="flex min-h-screen bg-[--background]">
      {/* Workspace sidebar */}
      <aside className="w-56 shrink-0 border-r border-[--border-subtle] bg-[--surface] p-4">
        <nav className="flex flex-col gap-1">
          <LayoutGroup>
            {WORKSPACE_ITEMS.map((item) => {
              const Icon = item.icon;
              const href = item.id === "settings" ? basePath : `${basePath}${item.href}`;
              const isActive = activeId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(href)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-[--radius-base] px-3 py-2.5 text-sm font-medium transition-none",
                    "hover:bg-[--ghost-hover]",
                    isActive ? "text-[--text-primary]" : "text-[--text-secondary]",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="workspace-active-pill"
                      className="absolute inset-0 rounded-[--radius-base] bg-[--ghost-active]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}

                  <span className="relative z-10 flex items-center gap-3">
                    <Icon size={16} className="shrink-0" />
                    <span>{item.label}</span>
                  </span>
                </button>
              );
            })}
          </LayoutGroup>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
