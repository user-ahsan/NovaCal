"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Save, Upload } from "lucide-react";
import { Button } from "@novacal/ui/button";
import { Input } from "@novacal/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@novacal/ui/avatar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@novacal/ui/select";
import { Card, CardContent } from "@novacal/ui/card";

// ─── Helpers ───

/** All IANA timezone names (supported by the runtime environment). */
function getTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    // Fallback for environments without Intl.supportedValuesOf
    return Intl.DateTimeFormat().resolvedOptions().timeZone
      ? [Intl.DateTimeFormat().resolvedOptions().timeZone]
      : ["UTC"];
  }
}

// ─── Component ───

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const timezones = getTimezones();

  /** Handle avatar file selection. */
  const handleAvatarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    },
    [],
  );

  /** Persist profile settings to the backend. */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // POST to the profile update endpoint
      await fetch("/api/v1/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone, avatarUrl: avatarPreview }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Error handled silently — a toast would appear in production
    } finally {
      setSaving(false);
    }
  }, [name, timezone, avatarPreview]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">Profile</h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Manage your personal information and display preferences.
        </p>
      </div>

      {/* Avatar section */}
      <Card>
        <CardContent className="flex items-center gap-6 p-6">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarPreview ?? undefined} alt="Your avatar" />
              <AvatarFallback className="text-lg">
                {name ? name.charAt(0).toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
            {/* Upload overlay */}
            <label
              htmlFor="avatar-upload"
              className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100"
            >
              <Upload size={18} className="text-white" />
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-[--text-primary]">Avatar</p>
            <p className="text-xs text-[--text-muted]">
              PNG, JPG or WEBP. Square recommended.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Name field */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[--text-primary]">Display Name</label>
        <Input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Timezone selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[--text-primary]">Timezone</label>
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

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          <motion.span
            key={saved ? "saved" : "save"}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2"
          >
            <Save size={16} />
            {saved ? "Saved" : saving ? "Saving…" : "Save"}
          </motion.span>
        </Button>
        {saved && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-[--success]"
          >
            Profile updated
          </motion.span>
        )}
      </div>
    </div>
  );
}
