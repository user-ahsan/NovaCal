"use client"

import { useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

// ─── Auth Callback — Invisible Redirect Handler ───
// Source: docs/05-route-map-web-mobile.md §1 — /auth/callback
//
// System route. No UI rendered.
// Receives a session token via query parameter, persists it to localStorage,
// then redirects to /calendar.
//
// Expected query params:
//   ?sessionToken=<string>  — The session token from the auth provider
//   ?redirect=<path>        — Optional custom redirect (default: /calendar)

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const processedRef = useRef(false)

  useEffect(() => {
    // Guard: prevent double-processing in StrictMode
    if (processedRef.current) return
    processedRef.current = true

    const sessionToken = searchParams.get("sessionToken")
    const redirectTo = searchParams.get("redirect") || "/calendar"

    if (sessionToken) {
      // Persist the session token
      localStorage.setItem("sessionToken", sessionToken)
    }

    // Redirect — replace so the callback URL is removed from history
    router.replace(redirectTo)
  }, [router, searchParams])

  // Render nothing visible — invisible handler
  return null
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackHandler />
    </Suspense>
  )
}
