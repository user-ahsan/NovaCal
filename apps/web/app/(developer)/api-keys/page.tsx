"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Copy, Check, Trash2, Eye, EyeOff } from "lucide-react";
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
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@novacal/ui/table";
import { CodeBlockCopy } from "../../../../components/CodeBlockCopy";

// ─── Types ───

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

// ─── Component ───

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  /** Fetch existing API keys. */
  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const res = await fetch("/api/v1/api-keys");
        const data = await res.json();
        setKeys(data.keys ?? []);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    };
    fetchKeys();
  }, []);

  /** Create a new API key. */
  const handleCreate = useCallback(async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();

      // Add the key (with prefix) to the list
      setKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          prefix: data.prefix,
          createdAt: data.createdAt,
          lastUsedAt: null,
          revoked: false,
        },
        ...prev,
      ]);

      // Reveal the full key once (never stored again)
      setNewKeyValue(data.fullKey ?? data.apiKey);
      setNewKeyName("");
    } catch {
      // Handle silently
    }
  }, [newKeyName]);

  /** Revoke an API key. */
  const handleRevoke = useCallback(async (keyId: string) => {
    try {
      await fetch(`/api/v1/api-keys/${keyId}`, { method: "DELETE" });
      setKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, revoked: true } : k)),
      );
    } catch {
      // Handle silently
    }
  }, []);

  /** Copy full key to clipboard. */
  const handleCopyKey = useCallback(async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      // Clipboard may not be available
    }
  }, []);

  /** Format date. */
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

  // ─── Loading ───
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
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
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[--text-primary]">API Keys</h1>
          <p className="mt-0.5 text-xs text-[--text-secondary]">
            Generate and revoke REST API keys for programmatic access.
          </p>
        </div>

        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) setNewKeyValue(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus size={14} />
              Create Key
            </Button>
          </DialogTrigger>

          <DialogContent>
            {!newKeyValue ? (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Give your key a descriptive name. The full key will be shown once.
                  </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                  <Input
                    placeholder="e.g., CI/CD Pipeline"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    autoFocus
                  />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={!newKeyName.trim()}>
                    Generate
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Key Created</DialogTitle>
                  <DialogDescription>
                    Copy this key now. You will not be able to see it again.
                  </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                  <CodeBlockCopy code={newKeyValue} language="text" />
                </div>

                <DialogFooter>
                  <Button
                    onClick={() => {
                      handleCopyKey(newKeyValue);
                      setCreateDialogOpen(false);
                      setNewKeyValue(null);
                    }}
                  >
                    <Check size={14} className="mr-2" />
                    Copied & Done
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Keys table */}
      <div className="overflow-hidden rounded-[--radius-base] border border-[--border-subtle]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {keys.map((key) => (
                <motion.tr
                  key={key.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className={`border-b border-[--border-subtle] hover:bg-[--ghost-hover] ${
                    key.revoked ? "opacity-40" : ""
                  }`}
                >
                  <TableCell className="font-medium text-[--text-primary]">
                    <div className="flex items-center gap-2">
                      {key.name}
                      {key.revoked && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Revoked
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[--text-secondary]">
                    {key.prefix}...
                  </TableCell>
                  <TableCell className="text-sm text-[--text-secondary]">
                    {formatDate(key.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-[--text-secondary]">
                    {formatDate(key.lastUsedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Reveal full key (reconstructed from prefix for display) */}
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedId(revealedId === key.id ? null : key.id)
                        }
                        className="rounded-[--radius-base] p-1.5 text-[--text-muted] transition-none hover:bg-[--ghost-hover] hover:text-[--text-primary]"
                      >
                        {revealedId === key.id ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>

                      {!key.revoked && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(key.id)}
                          className="rounded-[--radius-base] p-1.5 text-[--destructive] transition-none hover:bg-[--destructive]/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </AnimatePresence>

            {keys.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-[--text-muted]">
                  No API keys yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
