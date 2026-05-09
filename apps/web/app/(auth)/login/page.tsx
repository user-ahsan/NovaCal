"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { FloatingLabelInput } from "../../../components/FloatingLabelInput"
import { MagneticButton } from "../../../components/MagneticButton"

// ─── Item Variants (responds to parent stagger from AuthLayout) ───

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

// ─── Email/Password Login Page ───
// Source: docs/05-route-map-web-mobile.md §1 — /login
//
// Renders a centered auth card with:
//   - Email + Password fields (FloatingLabelInput, borderless)
//   - MagneticButton with radial glow
//   - Link to /login/qr (QR bridge)
//   - Stagger entrance animation per field
//   - Error display on 401

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // ── Submit handler ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || "Invalid email or password")
      }

      // Store session token and redirect to calendar
      localStorage.setItem("sessionToken", data.sessionToken)
      router.push("/calendar")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-[32px] font-semibold text-white">Welcome back</h1>
        <p className="mt-2 text-[13px] text-zinc-400">Sign in to your account</p>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div
          variants={itemVariants}
          className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
        >
          {error}
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <motion.div variants={itemVariants}>
          <FloatingLabelInput
            label="Email"
            value={email}
            onChange={setEmail}
            fontSize="16px"
            type="email"
            name="email"
            autoComplete="email"
            required
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <FloatingLabelInput
            label="Password"
            value={password}
            onChange={setPassword}
            fontSize="16px"
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </motion.div>

        <motion.div variants={itemVariants} className="flex flex-col gap-4 pt-2">
          <MagneticButton
            type="submit"
            disabled={loading || !email || !password}
            className="w-full"
          >
            {loading ? "Signing in…" : "Sign in"}
          </MagneticButton>

          {/* QR bridge link */}
          <Link
            href="/login/qr"
            className="text-center text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Sign in with QR code instead
          </Link>
        </motion.div>
      </form>
    </div>
  )
}
