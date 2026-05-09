"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { FloatingLabelInput } from "../../../components/FloatingLabelInput"
import { MagneticButton } from "../../../components/MagneticButton"

// ─── Item Variants (responds to parent stagger from AuthLayout) ───

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

// ─── Instance Admin Setup — First-Run Wizard ───
// Source: docs/05-route-map-web-mobile.md §1 — /setup
//
// Triggers once on first Docker boot. Checks DB for existing users.
// If any user exists → redirects to /login.
// Otherwise renders the Instance Admin creation form.
// On submit: POST /api/auth/register → creates user + POST /api/workspaces → default workspace.
// Uses FloatingLabelInput (borderless) + MagneticButton (radial glow).

export default function SetupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // ── Check if setup is needed ──
  useEffect(() => {
    async function checkSetupStatus() {
      try {
        // Check if any session/user exists by probing health endpoint
        const res = await fetch("/api/system/health")
        if (!res.ok) {
          // DB might not be ready yet — show setup anyway
          setChecking(false)
          return
        }

        // Try to see if users exist by calling register check
        // If users exist, redirect to login
        const checkRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "__check__@novacal.internal",
            password: "placeholder",
            name: "check",
          }),
        })

        if (checkRes.status === 409) {
          // User limit reached or already has users — setup done
          router.push("/login")
          return
        }
      } catch {
        // DB/API not ready — show setup form
      } finally {
        setChecking(false)
      }
    }

    checkSetupStatus()
  }, [router])

  // ── Submit handler ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // Step 1: Register the first user
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      })

      const registerData = await registerRes.json()

      if (!registerRes.ok) {
        throw new Error(registerData.error?.message || "Failed to create admin account")
      }

      // Step 2: Create a default workspace as OWNER
      const sessionToken = registerData.sessionToken

      await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: "My Workspace",
          slug: "my-workspace",
        }),
      })

      // Step 3: Store session token and redirect to login
      localStorage.setItem("sessionToken", sessionToken)
      router.push("/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  // ── Loading state ──
  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-800" />
        <p className="text-sm text-zinc-500">Checking setup status…</p>
      </div>
    )
  }

  // ── Render form ──
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-[32px] font-semibold text-white">Welcome to NovaCal</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
          Create your Instance Admin account to get started.
          <br />
          This is a one-time setup.
        </p>
      </motion.div>

      {/* Error message */}
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
            label="Name"
            value={name}
            onChange={setName}
            fontSize="16px"
            name="name"
            autoComplete="name"
            required
          />
        </motion.div>

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
            autoComplete="new-password"
            required
          />
        </motion.div>

        <motion.div variants={itemVariants} className="pt-2">
          <MagneticButton
            type="submit"
            disabled={loading || !email || !password || !name}
            className="w-full"
          >
            {loading ? "Creating Admin Account…" : "Create Admin Account"}
          </MagneticButton>
        </motion.div>
      </form>
    </div>
  )
}
