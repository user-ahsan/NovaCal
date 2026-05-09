"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Link } from "lucide-react";
import { Button } from "@novacal/ui/button";
import { Badge } from "@novacal/ui/badge";
import { Avatar, AvatarFallback } from "@novacal/ui/avatar";
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
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@novacal/ui/table";
import { CodeBlockCopy } from "../../../../../components/CodeBlockCopy";
import { WORKSPACE_ROLES, type WorkspaceRole } from "@novacal/shared";

// ─── Types ───

interface WorkspaceMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

// ─── Component ───

export default function WorkspaceMembersPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  /** Fetch workspace members. */
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch(`/api/v1/workspaces/${workspaceId}/members`);
        const data = await res.json();
        setMembers(data.members ?? []);
      } catch {
        // Fallback empty
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [workspaceId]);

  /** Change a member's role. */
  const handleRoleChange = useCallback(
    async (userId: string, newRole: WorkspaceRole) => {
      try {
        await fetch(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        });
        setMembers((prev) =>
          prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)),
        );
      } catch {
        // Handle silently
      }
    },
    [workspaceId],
  );

  /** Remove a member from the workspace. */
  const handleRemoveMember = useCallback(
    async (userId: string) => {
      try {
        await fetch(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
          method: "DELETE",
        });
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      } catch {
        // Handle silently
      }
    },
    [workspaceId],
  );

  /** Generate a one-time invite link. */
  const handleGenerateInvite = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/invite`, {
        method: "POST",
      });
      const data = await res.json();
      setInviteLink(data.inviteUrl ?? `${window.location.origin}/invite/${data.inviteCode}`);
    } catch {
      setInviteLink("Failed to generate link.");
    }
  }, [workspaceId]);

  /** Format date string. */
  const formatDate = (dateStr: string) => {
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

  /** Role display label. */
  const roleLabel = (role: WorkspaceRole) => {
    const labels: Record<WorkspaceRole, string> = {
      OWNER: "Owner",
      ADMIN: "Admin",
      EDITOR: "Editor",
      VIEWER: "Viewer",
      FREE_BUSY: "Free/Busy",
    };
    return labels[role] ?? role;
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[--surface-elevated]" />
        <div className="h-10 w-40 animate-pulse rounded bg-[--surface-elevated]" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded bg-[--surface-elevated]" />
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
          <h1 className="text-2xl font-semibold text-[--text-primary]">Members</h1>
          <p className="mt-1 text-sm text-[--text-secondary]">
            Manage who has access to this workspace.
          </p>
        </div>

        {/* Invite button */}
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus size={16} />
              Invite Member
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
              <DialogDescription>
                Generate a one-time invitation link to share with your team member.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {!inviteLink ? (
                <Button onClick={handleGenerateInvite} className="w-full">
                  <Link size={16} className="mr-2" />
                  Generate Invite Link
                </Button>
              ) : (
                <CodeBlockCopy code={inviteLink} language="url" />
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setInviteDialogOpen(false);
                  setInviteLink(null);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Members table with AnimatePresence for smooth add/remove */}
      <div className="overflow-hidden rounded-[--radius-base] border border-[--border-subtle]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {members.map((member) => (
                <motion.tr
                  key={member.userId}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, height: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="border-b border-[--border-subtle] hover:bg-[--ghost-hover]"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {member.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-[--text-primary]">{member.name}</p>
                        <p className="text-xs text-[--text-muted]">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={member.role}
                      onValueChange={(v) => handleRoleChange(member.userId, v as WorkspaceRole)}
                      disabled={member.role === "OWNER"}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue>{roleLabel(member.role)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {WORKSPACE_ROLES.filter((r) => r !== "OWNER").map((role) => (
                          <SelectItem key={role} value={role}>
                            {roleLabel(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-[--text-secondary]">
                    {formatDate(member.joinedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {member.role !== "OWNER" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-xs text-[--destructive] hover:text-[--destructive]"
                      >
                        Remove
                      </Button>
                    )}
                  </TableCell>
                </motion.tr>
              ))}
            </AnimatePresence>

            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-sm text-[--text-muted]">
                  No members in this workspace yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
