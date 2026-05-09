"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { DynamicQRCode } from "../../../../components/DynamicQRCode"
import { QR_TTL_SECONDS } from "@novacal/shared"

// ─── Item Variants (responds to parent stagger from AuthLayout) ───

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

// ─── QR Auth Page ───
// Source: docs/05-route-map-web-mobile.md §1 — /login/qr
//        docs/07-component-animation-guide.md §1 — QR Code Animations
//        AGENTS.md Rule 55-56 — QR Auth Bridge
//
// Renders a dynamic QR code for the mobile auth bridge.
//   - DynamicQRCode component handles QR generation, WebSocket subscription,
//     sweep-line animation, scan-success shrink-to-green, and circle reveal.
//   - Shows countdown timer until next QR refresh (QR_TTL_SECONDS = 60).
//   - Text: "Awaiting Mobile Connection…" while idle.
//   - On scan: redirects to /calendar.
//
// WebSocket flow:
//   1. Browser connects to the realtime server via WS
//   2. Server broadcasts LOGIN_SUCCESS on mobile approval
//   3. DynamicQRCode detects event → triggers scan animation → calls onScanApproved
//   4. We store the session token (passed via WS message data) and redirect

export default function QrLoginPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(QR_TTL_SECONDS)
  const [wsUrl, setWsUrl] = useState<string>("")
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Determine WebSocket URL on mount ──
  useEffect(() => {
    // Use window.location to derive WS URL:
    //   http:// → ws://,  https:// → wss://
    // Append /realtime path (per AGENTS.md container architecture)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    // The realtime server runs on port 3001 internally, but in dev/proxy
    // it's accessible through the same origin at /realtime
    setWsUrl(`${protocol}//${host}/realtime`)
  }, [])

  // ── Countdown timer for QR refresh ──
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return QR_TTL_SECONDS
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Reset countdown when QR refreshes
  useEffect(() => {
    setCountdown(QR_TTL_SECONDS)
  }, [])

  // ── Scan approved handler ──
  const handleScanApproved = () => {
    // The DynamicQRCode component handles the circle-reveal animation.
    // After animation completes, redirect to the calendar dashboard.
    // The session token is received via WebSocket in DynamicQRCode's WS handler.
    setTimeout(() => {
      router.push("/calendar")
    }, 200)
  }

  // ── Render ──
  return (
    <div className="flex flex-col items-center gap-8 py-8" ref={containerRef}>
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-[32px] font-semibold text-white">QR Sign In</h1>
        <p className="mt-2 text-[13px] text-zinc-400">
          Scan with the NovaCal mobile app
        </p>
      </motion.div>

      {/* QR Code */}
      <motion.div variants={itemVariants} className="flex flex-col items-center gap-4">
        {wsUrl && (
          <DynamicQRCode wsUrl={wsUrl} onScanApproved={handleScanApproved} />
        )}

        {!wsUrl && (
          <div className="flex h-[180px] w-[180px] items-center justify-center rounded-xl bg-zinc-900">
            <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-800" />
          </div>
        )}
      </motion.div>

      {/* Status text — outside the DynamicQRCode's full-screen overlay */}
      <motion.div variants={itemVariants} className="text-center">
        <p className="text-sm font-medium text-zinc-400">
          Awaiting Mobile Connection…
        </p>
        <p className="mt-1 text-xs text-zinc-600">Scan to bypass</p>
      </motion.div>

      {/* Countdown / refresh */}
      <motion.div variants={itemVariants} className="text-center">
        <p className="text-xs text-zinc-600">
          Code refreshes in{" "}
          <span className="font-mono text-zinc-400">{countdown}s</span>
        </p>
      </motion.div>

      {/* Fallback link */}
      <motion.div variants={itemVariants}>
        <a
          href="/login"
          className="text-xs text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-300"
        >
          Sign in with password instead
        </a>
      </motion.div>
    </div>
  )
}
