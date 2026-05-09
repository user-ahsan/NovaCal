"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@novacal/ui/button";
import { Input } from "@novacal/ui/input";
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@novacal/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@novacal/ui/table";
import { CodeBlockCopy } from "../../../../components/CodeBlockCopy";

// ─── Event trigger options ───

const WEBHOOK_EVENTS = [
  { value: "event.created", label: "event.created" },
  { value: "event.updated", label: "event.updated" },
  { value: "event.deleted", label: "event.deleted" },
] as const;

// ─── Types ───

interface Webhook {
  id: string;
  name: string;
  targetUrl: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

interface DeliveryLog {
  id: string;
  webhookId: string;
  event: string;
  status: "success" | "failed";
  statusCode: number;
  timestamp: string;
}

// ─── Component ───

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Create webhook form
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTargetUrl, setNewTargetUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["event.created"]);
  const [newSecret, setNewSecret] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);

  /** Fetch webhooks and delivery logs. */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [whRes, delRes] = await Promise.all([
          fetch("/api/v1/webhooks"),
          fetch("/api/v1/webhooks/deliveries?limit=50"),
        ]);
        setWebhooks((await whRes.json()).webhooks ?? []);
        setDeliveries((await delRes.json()).deliveries ?? []);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /** Create a new webhook. */
  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newTargetUrl.trim()) return;
    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          targetUrl: newTargetUrl.trim(),
          events: newEvents,
          secret: newSecret || undefined,
        }),
      });
      const data = await res.json();

      setWebhooks((prev) => [data, ...prev]);
      setCreateOpen(false);
      setNewName("");
      setNewTargetUrl("");
      setNewEvents(["event.created"]);
      setNewSecret("");
    } catch {
      // Handle silently
    }
  }, [newName, newTargetUrl, newEvents, newSecret]);

  /** Delete a webhook. */
  const handleDelete = useCallback(async (webhookId: string) => {
    try {
      await fetch(`/api/v1/webhooks/${webhookId}`, { method: "DELETE" });
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
      setDeliveries((prev) => prev.filter((d) => d.webhookId !== webhookId));
    } catch {
      // Handle silently
    }
  }, []);

  /** Toggle webhook active state. */
  const handleToggleActive = useCallback(async (webhookId: string, currentlyActive: boolean) => {
    try {
      await fetch(`/api/v1/webhooks/${webhookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentlyActive }),
      });
      setWebhooks((prev) =>
        prev.map((w) =>
          w.id === webhookId ? { ...w, active: !currentlyActive } : w,
        ),
      );
    } catch {
      // Handle silently
    }
  }, []);

  /** Copy secret to clipboard. */
  const handleCopySecret = useCallback(async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, []);

  /** Format date string. */
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

  // ─── Loading ───
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-7 w-48 animate-pulse rounded bg-[--surface-elevated]" />
        <div className="h-5 w-64 animate-pulse rounded bg-[--surface-elevated]" />
        <div className="h-10 w-32 animate-pulse rounded bg-[--surface-elevated]" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-[--surface-elevated]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[--text-primary]">Webhooks</h1>
          <p className="mt-0.5 text-xs text-[--text-secondary]">
            Configure outgoing webhooks for calendar events.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus size={14} />
              Add Webhook
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Webhook</DialogTitle>
              <DialogDescription>
                Events will be sent as POST requests to the target URL.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[--text-primary]">Name</label>
                <Input
                  placeholder="My Webhook"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              {/* Target URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[--text-primary]">Target URL</label>
                <Input
                  placeholder="https://example.com/webhook"
                  value={newTargetUrl}
                  onChange={(e) => setNewTargetUrl(e.target.value)}
                />
              </div>

              {/* Events */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[--text-primary]">Events</label>
                <div className="flex flex-wrap gap-2">
                  {WEBHOOK_EVENTS.map((evt) => {
                    const selected = newEvents.includes(evt.value);
                    return (
                      <button
                        key={evt.value}
                        type="button"
                        onClick={() =>
                          setNewEvents((prev) =>
                            selected
                              ? prev.filter((e) => e !== evt.value)
                              : [...prev, evt.value],
                          )
                        }
                        className={`rounded-[--radius-base] border px-2.5 py-1 font-mono text-xs transition-none ${
                          selected
                            ? "border-[--primary-accent] bg-[--primary-accent]/10 text-[--primary-accent]"
                            : "border-[--border-subtle] text-[--text-secondary] hover:bg-[--ghost-hover]"
                        }`}
                      >
                        {evt.value}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Secret */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[--text-primary]">
                  Secret Token <span className="text-[--text-muted]">(optional)</span>
                </label>
                <Input
                  placeholder="Leave blank to auto-generate"
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || !newTargetUrl.trim()}>
                Create Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Webhooks list */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
          Endpoints
        </h2>

        <AnimatePresence mode="popLayout">
          {webhooks.map((wh) => (
            <motion.div
              key={wh.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="rounded-[--radius-base] border border-[--border-subtle] bg-[--surface-elevated] p-4"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[--text-primary]">{wh.name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(wh.id, wh.active)}
                    >
                      <Badge
                        variant={wh.active ? "default" : "secondary"}
                        className={`text-[10px] cursor-pointer ${
                          wh.active
                            ? "bg-[--success]/10 text-[--success] border-none"
                            : ""
                        }`}
                      >
                        {wh.active ? "Active" : "Paused"}
                      </Badge>
                    </button>
                  </div>

                  {/* Target URL */}
                  <code className="block rounded-[--radius-base] bg-[--background] px-2.5 py-1.5 font-mono text-xs text-[--text-secondary] select-all">
                    {wh.targetUrl}
                  </code>

                  {/* Events */}
                  <div className="flex flex-wrap gap-1.5">
                    {wh.events.map((evt) => (
                      <Badge key={evt} variant="outline" className="font-mono text-[10px]">
                        {evt}
                      </Badge>
                    ))}
                  </div>

                  {/* Secret */}
                  {wh.secret && (
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-[--background] px-2 py-0.5 font-mono text-[10px] text-[--text-muted]">
                        Secret: ••••••••
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopySecret(wh.secret)}
                        className="text-[--text-muted] transition-none hover:text-[--text-primary]"
                      >
                        {secretCopied ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(wh.id)}
                  className="rounded-[--radius-base] p-1.5 text-[--destructive] transition-none hover:bg-[--destructive]/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {webhooks.length === 0 && (
          <div className="py-12 text-center text-sm text-[--text-muted]">
            No webhooks configured. Click &ldquo;Add Webhook&rdquo; to create one.
          </div>
        )}
      </div>

      {/* ─── Delivery Log ─── */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
          Delivery Log
        </h2>

        <div className="overflow-hidden rounded-[--radius-base] border border-[--border-subtle]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((del) => (
                <TableRow key={del.id}>
                  <TableCell className="font-mono text-xs text-[--text-primary]">
                    {del.event}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={del.status === "success" ? "default" : "destructive"}
                      className={`text-[10px] ${
                        del.status === "success"
                          ? "bg-[--success]/10 text-[--success] border-none"
                          : ""
                      }`}
                    >
                      {del.status === "success" ? "Delivered" : "Failed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[--text-secondary]">
                    {del.statusCode}
                  </TableCell>
                  <TableCell className="text-xs text-[--text-secondary]">
                    {formatDate(del.timestamp)}
                  </TableCell>
                </TableRow>
              ))}

              {deliveries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-[--text-muted]">
                    No deliveries yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
