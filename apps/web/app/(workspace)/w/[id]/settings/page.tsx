"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@novacal/ui/button";
import { Input } from "@novacal/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@novacal/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@novacal/ui/dialog";

// ─── Helpers ───

function getTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

// ─── Component ───

export default function WorkspaceSettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workspaceId = params.id;

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const timezones = getTimezones();

  /** Fetch current workspace settings. */
  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const res = await fetch(`/api/v1/workspaces/${workspaceId}`);
        const data = await res.json();
        setName(data.name ?? "");
        setTimezone(data.defaultTimezone ?? "UTC");
      } catch {
        // Fallback
        setName("Workspace");
      }
    };
    fetchWorkspace();
  }, [workspaceId]);

  /** Save workspace settings. */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, defaultTimezone: timezone }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Handle silently
    } finally {
      setSaving(false);
    }
  }, [workspaceId, name, timezone]);

  /** Delete the workspace (Owner only). */
  const handleDelete = useCallback(async () => {
    try {
      await fetch(`/api/v1/workspaces/${workspaceId}`, { method: "DELETE" });
      router.push("/calendar");
    } catch {
      // Handle silently
    }
  }, [workspaceId, router]);

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">Workspace Settings</h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Configure this workspace&apos;s name, branding, and defaults.
        </p>
      </div>

      {/* Workspace name */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[--text-primary]">Workspace Name</label>
        <Input
          placeholder="My Workspace"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Default timezone */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[--text-primary]">Default Timezone</label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a timezone" />
          </SelectTrigger>
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saved ? "Saved" : saving ? "Saving…" : "Save"}
        </Button>
        {saved && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-[--success]"
          >
            Workspace updated
          </motion.span>
        )}
      </div>

      <hr className="border-[--border-subtle]" />

      {/* ─── Danger Zone ─── */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-[--destructive]">Danger Zone</h2>
        <p className="text-sm text-[--text-secondary]">
          Deleting a workspace is irreversible. All events, calendars, and member data will be
          permanently removed. This action can only be performed by the workspace Owner.
        </p>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="gap-2">
              <Trash2 size={16} />
              Delete Workspace
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-[--destructive]" />
                Delete &ldquo;{name}&rdquo;?
              </DialogTitle>
              <DialogDescription>
                This action is permanent and cannot be undone. Type{" "}
                <strong className="text-[--text-primary]">{name}</strong> below to confirm.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Input
                placeholder={`Type "${name}" to confirm`}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirm !== name}
                onClick={handleDelete}
              >
                Permanently Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
