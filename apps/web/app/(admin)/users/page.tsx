"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShieldAlert, Shield, RotateCcw } from "lucide-react";
import { Button } from "@novacal/ui/button";
import { Input } from "@novacal/ui/input";
import { Badge } from "@novacal/ui/badge";
import { Avatar, AvatarFallback } from "@novacal/ui/avatar";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@novacal/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@novacal/ui/table";

// ─── Types ───

interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: "active" | "banned" | "suspended";
  createdAt: string;
  lastLogin: string | null;
}

// ─── Component ───

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/v1/admin/users");
        const data = await res.json();
        setUsers(data.users ?? []);
      } catch {
        // Fallback empty
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  /** Filter users by search query. */
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  /** Toggle user ban status. */
  const handleToggleBan = useCallback(async (userId: string, currentlyBanned: boolean) => {
    try {
      if (currentlyBanned) {
        await fetch(`/api/v1/admin/users/${userId}/unban`, { method: "POST" });
      } else {
        await fetch(`/api/v1/admin/users/${userId}/ban`, { method: "POST" });
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, status: currentlyBanned ? "active" : "banned" as const }
            : u,
        ),
      );
      setConfirmUserId(null);
    } catch {
      // Handle silently
    }
  }, []);

  /** Force reset a user's password. */
  const handleResetPassword = useCallback(async (userId: string) => {
    try {
      await fetch(`/api/v1/admin/users/${userId}/reset-password`, { method: "POST" });
    } catch {
      // Handle silently
    }
  }, []);

  /** Format date string. */
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  /** Status badge variant. */
  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-[--success]/10 text-[--success] border-none">Active</Badge>;
      case "banned":
        return <Badge variant="destructive">Banned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[--surface-elevated]" />
        <div className="h-10 w-72 animate-pulse rounded bg-[--surface-elevated]" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded bg-[--surface-elevated]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">Users</h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Manage all registered users on this instance.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted]" />
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users table */}
      <div className="overflow-hidden rounded-[--radius-base] border border-[--border-subtle]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {filteredUsers.map((user) => (
                <motion.tr
                  key={user.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="border-b border-[--border-subtle] hover:bg-[--ghost-hover]"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-[--text-primary]">{user.name}</p>
                        <p className="text-xs text-[--text-muted]">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{statusBadge(user.status)}</TableCell>
                  <TableCell className="text-sm">{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-sm">{formatDate(user.lastLogin)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Reset password */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetPassword(user.id)}
                        className="text-xs"
                      >
                        <RotateCcw size={14} className="mr-1" />
                        Reset Pwd
                      </Button>

                      {/* Ban / Unban */}
                      <Dialog
                        open={confirmUserId === user.id}
                        onOpenChange={(open) => !open && setConfirmUserId(null)}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmUserId(user.id)}
                            className={`text-xs ${
                              user.status === "banned"
                                ? "text-[--success]"
                                : "text-[--destructive]"
                            }`}
                          >
                            {user.status === "banned" ? (
                              <Shield size={14} className="mr-1" />
                            ) : (
                              <ShieldAlert size={14} className="mr-1" />
                            )}
                            {user.status === "banned" ? "Unban" : "Ban"}
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {user.status === "banned" ? "Unban" : "Ban"} {user.name}?
                            </DialogTitle>
                            <DialogDescription>
                              {user.status === "banned"
                                ? "This will restore the user's access to the instance."
                                : "This user will lose access to their account and all associated data."}
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setConfirmUserId(null)}>
                              Cancel
                            </Button>
                            <Button
                              variant={user.status === "banned" ? "default" : "destructive"}
                              onClick={() => handleToggleBan(user.id, user.status === "banned")}
                            >
                              {user.status === "banned" ? "Unban" : "Ban User"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </AnimatePresence>

            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-[--text-muted]">
                  {search ? "No users match your search." : "No users registered yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
