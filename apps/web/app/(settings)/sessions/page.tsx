"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, AlertTriangle } from "lucide-react";
import { Button } from "@novacal/ui/button";
import { Badge } from "@novacal/ui/badge";
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

interface Session {
  id: string;
  device: string;
  ip: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

// ─── Component ───

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [panicOpen, setPanicOpen] = useState(false);

  /** Fetch the active device session list. */
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/v1/auth/sessions");
        const data = await res.json();
        setSessions(data.sessions ?? []);
      } catch {
        // Fallback to empty
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  /** Revoke a single session. */
  const handleRevoke = useCallback(async (sessionId: string) => {
    try {
      await fetch(`/api/v1/auth/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // Handle silently
    }
  }, []);

  /** Revoke all sessions. */
  const handleRevokeAll = useCallback(async () => {
    try {
      await fetch("/api/v1/auth/sessions", { method: "DELETE" });
      setSessions([]);
      setPanicOpen(false);
    } catch {
      // Handle silently
    }
  }, []);

  /** Format a UTC date string to a human-readable local format. */
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[--surface-elevated]" />
        <div className="h-6 w-72 animate-pulse rounded bg-[--surface-elevated]" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded bg-[--surface-elevated]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">Sessions</h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Manage devices and active sessions signed into your account.
        </p>
      </div>

      {/* Device ledger table */}
      <div className="overflow-hidden rounded-[--radius-base] border border-[--border-subtle]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {sessions.map((session) => (
                <motion.tr
                  key={session.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, height: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="border-b border-[--border-subtle] hover:bg-[--ghost-hover]"
                >
                  <TableCell className="flex items-center gap-2">
                    <span>{session.device}</span>
                    {session.isCurrent && (
                      <Badge variant="secondary" className="text-[10px]">Current</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{session.ip}</TableCell>
                  <TableCell className="text-sm">{formatDate(session.lastActive)}</TableCell>
                  <TableCell className="text-sm">{formatDate(session.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(session.id)}
                      className="text-xs text-[--destructive] hover:text-[--destructive]"
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </motion.tr>
              ))}
            </AnimatePresence>

            {sessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-[--text-muted]">
                  No active sessions.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Panic Button: Log out of all devices ─── */}
      <Dialog open={panicOpen} onOpenChange={setPanicOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" className="gap-2">
            <LogOut size={16} />
            Log out of all devices
          </Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-[--destructive]" />
              Log out of all devices?
            </DialogTitle>
            <DialogDescription>
              This will revoke every active session, including the one you are using now.
              You will need to sign in again on all devices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPanicOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevokeAll}>
              Log out everywhere
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
