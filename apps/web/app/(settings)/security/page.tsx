"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Key, Copy, Check } from "lucide-react";
import { Button } from "@novacal/ui/button";
import { Input } from "@novacal/ui/input";
import { cn } from "@novacal/ui/lib/utils";

// ─── Component ───

export default function SecurityPage() {
  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // 2FA
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpQr, setTotpQr] = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [totpCopied, setTotpCopied] = useState(false);

  /** Handle password change form submission. */
  const handleChangePassword = useCallback(async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPasswordError(data.message ?? "Failed to change password.");
        return;
      }

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("Network error. Please try again.");
    }
  }, [currentPassword, newPassword, confirmPassword]);

  /** Enable TOTP 2FA — fetch the secret + QR code from the server. */
  const handleEnableTotp = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      setTotpSecret(data.secret);
      setTotpQr(data.qrCode);
    } catch {
      // Handle silently
    }
  }, []);

  /** Verify and activate TOTP. */
  const handleVerifyTotp = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      if (res.ok) {
        setTotpEnabled(true);
        setTotpSecret(null);
        setTotpQr(null);
        setTotpCode("");
      }
    } catch {
      // Handle silently
    }
  }, [totpCode]);

  /** Disable TOTP 2FA. */
  const handleDisableTotp = useCallback(async () => {
    try {
      await fetch("/api/v1/auth/2fa/disable", { method: "POST" });
      setTotpEnabled(false);
      setTotpSecret(null);
      setTotpQr(null);
    } catch {
      // Handle silently
    }
  }, []);

  /** Copy the TOTP secret to clipboard. */
  const handleCopySecret = useCallback(async () => {
    if (!totpSecret) return;
    try {
      await navigator.clipboard.writeText(totpSecret);
      setTotpCopied(true);
      setTimeout(() => setTotpCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [totpSecret]);

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">Security</h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Manage your password and two-factor authentication.
        </p>
      </div>

      {/* ─── Change Password ─── */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-[--text-primary]">Change Password</h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-[--text-primary]">Current Password</label>
            <Input
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[--text-primary]">New Password</label>
            <Input
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[--text-primary]">Confirm New Password</label>
            <Input
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        {passwordError && (
          <p className="text-xs text-[--destructive]">{passwordError}</p>
        )}

        <Button onClick={handleChangePassword} disabled={!currentPassword || !newPassword || !confirmPassword}>
          <Key size={16} className="mr-2" />
          Change Password
        </Button>

        {passwordSuccess && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-[--success]"
          >
            Password changed successfully.
          </motion.p>
        )}
      </section>

      <hr className="border-[--border-subtle]" />

      {/* ─── Two-Factor Authentication (TOTP) ─── */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-[--text-primary]">
          Two-Factor Authentication
        </h2>

        {!totpEnabled && !totpSecret && (
          <div className="space-y-3">
            <p className="text-sm text-[--text-secondary]">
              Add an extra layer of security to your account using a TOTP authenticator app.
            </p>
            <Button onClick={handleEnableTotp}>Set up 2FA</Button>
          </div>
        )}

        {/* TOTP setup — QR code display */}
        {totpSecret && totpQr && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4 rounded-[--radius-base] border border-[--border-subtle] bg-[--surface-elevated] p-6"
          >
            <p className="text-sm text-[--text-secondary]">
              Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy).
            </p>

            {/* QR code image */}
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={totpQr}
                alt="TOTP QR Code"
                className="h-48 w-48 rounded-[--radius-base]"
              />
            </div>

            {/* Manual entry secret */}
            <div className="space-y-2">
              <p className="text-xs text-[--text-muted]">
                Or manually enter this secret:
              </p>
              <div className="flex items-center gap-2">
                <code
                  className={cn(
                    "flex-1 rounded-[--radius-base] border border-[--border-subtle] bg-[--background] px-3 py-2 text-xs font-mono text-[--text-primary]",
                    "select-all",
                  )}
                >
                  {totpSecret}
                </code>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="flex items-center gap-1 rounded-[--radius-base] px-2 py-2 text-xs text-[--text-secondary] transition-none hover:bg-[--ghost-hover] hover:text-[--text-primary]"
                >
                  {totpCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Verification code input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[--text-primary]">
                Verification Code
              </label>
              <div className="flex items-center gap-3">
                <Input
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="max-w-[160px] font-mono text-center tracking-widest"
                />
                <Button onClick={handleVerifyTotp} disabled={totpCode.length !== 6}>
                  Verify & Activate
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 2FA active state */}
        {totpEnabled && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[--success]" />
              <span className="text-sm text-[--success]">Two-factor authentication is active</span>
            </div>
            <Button variant="outline" onClick={handleDisableTotp}>
              Disable 2FA
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
