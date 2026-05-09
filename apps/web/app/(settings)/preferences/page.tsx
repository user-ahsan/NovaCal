"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@novacal/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@novacal/ui/select";
import { SPRING_SWIFT } from "@novacal/shared";

// ─── Types ───

type ThemeMode = "dark" | "light" | "system";
type StartOfWeek = "monday" | "sunday";
type DefaultView = "day" | "week" | "month";
type TimeFormat = "12h" | "24h";

// ─── SwitchToggle Component ───

function SwitchToggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between py-3">
      <span className="text-sm text-[--text-primary]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[--background] ${
          enabled ? "bg-[--primary-accent]" : "bg-[--surface-elevated]"
        }`}
      >
        <motion.span
          layout
          transition={SPRING_SWIFT}
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

// ─── Theme Option ───

function ThemeOption({
  value,
  selected,
  onSelect,
  label,
}: {
  value: ThemeMode;
  selected: ThemeMode;
  onSelect: (v: ThemeMode) => void;
  label: string;
}) {
  const isActive = value === selected;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`relative rounded-[--radius-base] border px-4 py-3 text-sm font-medium transition-none ${
        isActive
          ? "border-[--primary-accent] bg-[--primary-accent]/10 text-[--text-primary]"
          : "border-[--border-subtle] text-[--text-secondary] hover:bg-[--ghost-hover]"
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="theme-pill"
          className="absolute inset-0 rounded-[--radius-base] bg-[--ghost-active]"
          transition={SPRING_SWIFT}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

// ─── Page Component ───

export default function PreferencesPage() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [startOfWeek, setStartOfWeek] = useState<StartOfWeek>("monday");
  const [defaultView, setDefaultView] = useState<DefaultView>("week");
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("24h");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /** Persist preferences to the backend. */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/v1/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, startOfWeek, defaultView, timeFormat }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Handle silently
    } finally {
      setSaving(false);
    }
  }, [theme, startOfWeek, defaultView, timeFormat]);

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">Preferences</h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Customise your calendar experience.
        </p>
      </div>

      {/* ─── Theme ─── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[--text-primary]">Theme</h2>
        <div className="flex gap-2">
          <ThemeOption value="dark" selected={theme} onSelect={setTheme} label="Dark" />
          <ThemeOption value="light" selected={theme} onSelect={setTheme} label="Light" />
          <ThemeOption value="system" selected={theme} onSelect={setTheme} label="System" />
        </div>
      </section>

      <hr className="border-[--border-subtle]" />

      {/* ─── Start of Week ─── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[--text-primary]">Start of Week</h2>
        <div className="flex gap-2">
          <ThemeOption value="monday" selected={startOfWeek} onSelect={(v) => setStartOfWeek(v as StartOfWeek)} label="Monday" />
          <ThemeOption value="sunday" selected={startOfWeek} onSelect={(v) => setStartOfWeek(v as StartOfWeek)} label="Sunday" />
        </div>
      </section>

      <hr className="border-[--border-subtle]" />

      {/* ─── Default Calendar View ─── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[--text-primary]">Default Calendar View</h2>
        <Select value={defaultView} onValueChange={(v) => setDefaultView(v as DefaultView)}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <hr className="border-[--border-subtle]" />

      {/* ─── Time Format ─── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[--text-primary]">Time Format</h2>
        <Select value={timeFormat} onValueChange={(v) => setTimeFormat(v as TimeFormat)}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24-hour (14:00)</SelectItem>
            <SelectItem value="12h">12-hour (2:00 PM)</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {/* ─── Save ─── */}
      <div className="flex items-center gap-3 pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saved ? "Saved" : saving ? "Saving…" : "Save Preferences"}
        </Button>
        {saved && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-[--success]"
          >
            Preferences saved
          </motion.span>
        )}
      </div>
    </div>
  );
}
