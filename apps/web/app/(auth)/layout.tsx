"use client"

import { type ReactNode } from "react"
import { motion } from "framer-motion"

// ─── Variants ───

const layoutVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

const layoutTransition = {
  staggerChildren: 0.05,
  delayChildren: 0.1,
  type: "spring" as const,
  stiffness: 250,
  damping: 25,
}

// ─── Auth Layout — Minimal Centered Card ───
// Source: docs/05-route-map-web-mobile.md §1, docs/06-design-specification.md, docs/07-component-animation-guide.md §1
//
// Renders a centered card with no sidebar/nav on an OLED black background.
// Children stagger in with 0.05s delay (spring entrance).
// Used by: /setup, /login, /login/qr, /auth/callback

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000000]">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={layoutVariants}
        transition={layoutTransition}
        className="w-full max-w-md mx-auto px-6"
      >
        {children}
      </motion.div>
    </div>
  )
}

export default AuthLayout
