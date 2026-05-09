"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { LayoutDashboard, Users, Server, Shield } from "lucide-react";
import { cn } from "@novacal/ui/lib/utils";

// ─── Sidebar Items ───

const ADMIN_ITEMS = [
  { id: "dashboard", label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { id: "users", label: "Users", href: "/admin/users", icon: Users },
  { id: "system", label: "System", href: "/admin/system", icon: Server },
] as const;

// ─── Types ───

interface AdminLayoutProps {
  children: ReactNode;
}

// ─── Component ───

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeId, setActiveId] = useState("dashboard");

  // Instance Admin guard placeholder — in production this reads the session
  // const { user, isInstanceAdmin } = useAuth();
  // if (!isInstanceAdmin) redirect("/calendar");

  useEffect(() => {
    const current = ADMIN_ITEMS.find((item) => pathname.startsWith(item.href));
    if (current) setActiveId(current.id);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-[--background]">
      {/* Admin sidebar */}
      <aside className="w-56 shrink-0 border-r border-[--border-subtle] bg-[--surface] p-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-2 px-3">
          <Shield size={18} className="text-[--primary-accent]" />
          <span className="text-sm font-semibold text-[--text-primary]">Admin</span>
        </div>

        <nav className="flex flex-col gap-1">
          <LayoutGroup>
            {ADMIN_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-[--radius-base] px-3 py-2.5 text-sm font-medium transition-none",
                    "hover:bg-[--ghost-hover]",
                    isActive ? "text-[--text-primary]" : "text-[--text-secondary]",
                  )}
                >
                  {/* Active pill — slides smoothly */}
                  {isActive && (
                    <motion.div
                      layoutId="admin-active-pill"
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
