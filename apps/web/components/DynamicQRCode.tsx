"use client"

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SPRING_SWIFT, QR_TTL_SECONDS, WS_EVENTS } from "@novacal/shared"

// ─── Types ───

interface DynamicQRCodeProps {
  /** WebSocket URL for the realtime server (e.g. wss://ws.example.com/realtime) */
  wsUrl: string
  /** Callback fired when a scan is approved and the reveal animation completes */
  onScanApproved: () => void
}

type QRState = "idle" | "scanning" | "approved"

// ─── QR Code Matrix Generation ───

const QR_VERSION = 1 // 21×21 matrix
const MATRIX_SIZE = 21
const MODULE_PX = 4 // SVG rect size per module

/**
 * Simple string hash used to seed QR data area.
 * Deterministic — same input always produces the same pattern.
 */
function hashSeed(text: string): number[] {
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0
  }
  const values: number[] = []
  let seed = Math.abs(h) || 1
  for (let i = 0; i < 200; i++) {
    seed = (seed * 16807) % 2147483647
    values.push(seed / 2147483647)
  }
  return values
}

function isFinderRegion(row: number, col: number): boolean {
  // Top-left finder: rows 0-6, cols 0-6
  // Top-right finder: rows 0-6, cols 14-20
  // Bottom-left finder: rows 14-20, cols 0-6
  const inTopLeft = row < 7 && col < 7
  const inTopRight = row < 7 && col >= 14
  const inBottomLeft = row >= 14 && col < 7
  return inTopLeft || inTopRight || inBottomLeft
}

function isTimingPattern(row: number, col: number): boolean {
  // Horizontal timing: row 6, cols 8-12
  // Vertical timing: rows 8-12, col 6
  if (row === 6 && col >= 8 && col <= 12) return true
  if (col === 6 && row >= 8 && row <= 12) return true
  return false
}

function isFormatInfo(row: number, col: number): boolean {
  // Format info is around the top-left finder
  // Row 8, cols 0-5 (dark module at 8,8 is always black)
  // Row 0-5, col 8
  // Also along timing patterns
  if (row === 8 && col >= 0 && col <= 5) return true
  if (row >= 0 && row <= 5 && col === 8) return true
  // Around bottom-right of top-left finder
  if (row === 7 && col === 8) return true
  if (row === 8 && col === 7) return true
  if (row === 8 && col === 8) return true // dark module
  return false
}

function drawFinderPattern(matrix: boolean[][], startRow: number, startCol: number): void {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const isOuterRing = r === 0 || r === 6 || c === 0 || c === 6
      const isInnerRing = (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      // Outer ring and inner square are black; separator is white
      matrix[startRow + r][startCol + c] = isOuterRing || isInnerRing
    }
  }
}

function generateQRMatrix(challenge: string): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: MATRIX_SIZE }, () =>
    Array(MATRIX_SIZE).fill(false)
  )

  // 1. Finder patterns (3 corners)
  drawFinderPattern(matrix, 0, 0)    // top-left
  drawFinderPattern(matrix, 0, 14)   // top-right
  drawFinderPattern(matrix, 14, 0)   // bottom-left

  // 2. Timing patterns — alternating black/white
  for (let i = 8; i <= 12; i++) {
    matrix[6][i] = i % 2 === 0
    matrix[i][6] = i % 2 === 0
  }

  // 3. Dark module (always black)
  matrix[13][8] = true

  // 4. Format info (simplified — fixed pattern)
  const formatBits = [true, false, true, false, true, true, false, true, false, false, true, false, true, true, false]
  let fi = 0
  for (let c = 0; c <= 5; c++) {
    if (c === 0) continue // skip row 8 col 0? actually place carefully
  }
  for (let c = 0; c <= 7; c++) {
    const col = c >= 5 ? c + 1 : c
    if (col === 8) continue
    matrix[8][col] = formatBits[fi++] ?? false
  }
  fi = 0
  for (let r = 0; r <= 7; r++) {
    const row = r >= 5 ? r + 1 : r
    if (row === 8) continue
    matrix[row][8] = formatBits[fi++] ?? false
  }

  // 5. Data area — fill with seed-derived pattern
  const seed = hashSeed(challenge)
  let seedIdx = 0
  const dataOrder: Array<[number, number]> = []

  // Collect data module positions (avoiding reserved areas)
  for (let rightCol = MATRIX_SIZE - 1; rightCol >= 0; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5 // skip timing pattern column
    for (let row = MATRIX_SIZE - 1; row >= 0; row--) {
      for (const dc of [0, -1]) {
        const col = rightCol + dc
        if (col < 0 || col >= MATRIX_SIZE) continue
        if (isFinderRegion(row, col)) continue
        if (isTimingPattern(row, col)) continue
        if (isFormatInfo(row, col)) continue
        dataOrder.push([row, col])
      }
    }
  }

  for (const [row, col] of dataOrder) {
    matrix[row]![col] = seed[seedIdx % seed.length] > 0.5
    seedIdx++
  }

  return matrix
}

// ─── Component ───

const DynamicQRCode: React.FC<DynamicQRCodeProps> = ({ wsUrl, onScanApproved }) => {
  const [challenge, setChallenge] = useState<string>("")
  const [qrState, setQrState] = useState<QRState>("idle")
  const [isRevealing, setIsRevealing] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Generate a random challenge
  const generateChallenge = useCallback(() => {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
    setChallenge(hex)
    setQrState("idle")
    setIsRevealing(false)
  }, [])

  // QR matrix derived from challenge
  const qrMatrix = useMemo(() => {
    if (!challenge) return null
    return generateQRMatrix(challenge)
  }, [challenge])

  // WebSocket subscription
  useEffect(() => {
    if (!wsUrl) return

    function connect() {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        // Subscribe to auth events
        ws.send(JSON.stringify({ type: "SUBSCRIBE", channel: "auth" }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === WS_EVENTS.LOGIN_SUCCESS || data.event === WS_EVENTS.LOGIN_SUCCESS) {
            setQrState("scanning")
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        // Auto-reconnect after 3s
        setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [wsUrl])

  // Auto-refresh every QR_TTL_SECONDS
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      generateChallenge()
    }, QR_TTL_SECONDS * 1000)

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [generateChallenge])

  // Initial challenge on mount
  useEffect(() => {
    generateChallenge()
  }, [generateChallenge])

  // Handle scan → redirect animation
  useEffect(() => {
    if (qrState === "scanning") {
      // After a brief moment showing the green scan-success, reveal the dashboard
      revealTimerRef.current = setTimeout(() => {
        setIsRevealing(true)
        // After reveal animation completes, fire callback
        setTimeout(() => {
          onScanApproved()
        }, 600)
      }, 800)

      return () => {
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      }
    }
  }, [qrState, onScanApproved])

  // ─── Rendering ───

  const qrViewBox = `0 0 ${MATRIX_SIZE * MODULE_PX} ${MATRIX_SIZE * MODULE_PX}`

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[--background]"
        initial={false}
        animate={
          isRevealing
            ? {
                clipPath: ["circle(50% at 50% 50%)", "circle(150% at 50% 50%)"],
              }
            : { clipPath: "circle(150% at 50% 50%)" }
        }
        exit={{ clipPath: "circle(0% at 50% 50%)" }}
        transition={SPRING_SWIFT}
        style={{ clipPath: "circle(150% at 50% 50%)" }}
      >
        <motion.div
          className="relative flex flex-col items-center gap-6"
          animate={
            qrState === "scanning"
              ? { scale: 0.8 }
              : { scale: 1.0 }
          }
          transition={SPRING_SWIFT}
        >
          {/* QR Code SVG */}
          <div
            className="relative overflow-hidden rounded-[--radius-lg]"
            style={{
              boxShadow:
                qrState === "scanning"
                  ? "0 0 40px rgba(34, 197, 94, 0.5), 0 0 80px rgba(34, 197, 94, 0.3)"
                  : "0 0 20px rgba(99, 102, 241, 0.2)",
            }}
          >
            <motion.svg
              viewBox={qrViewBox}
              width={180}
              height={180}
              className="block"
              animate={
                qrState === "scanning"
                  ? {
                      filter: [
                        "brightness(1) sepia(0) hue-rotate(0deg)",
                        "brightness(1.15) sepia(0.4) hue-rotate(100deg)",
                        "brightness(1) sepia(0) hue-rotate(0deg)",
                      ],
                    }
                  : {}
              }
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              {/* QR modules */}
              {qrMatrix &&
                qrMatrix.map((row, r) =>
                  row.map((isBlack, c) =>
                    isBlack ? (
                      <rect
                        key={`${r}-${c}`}
                        x={c * MODULE_PX}
                        y={r * MODULE_PX}
                        width={MODULE_PX}
                        height={MODULE_PX}
                        fill={
                          qrState === "scanning" ? "#22C55E" : "#FFFFFF"
                        }
                      />
                    ) : null
                  )
                )}

              {/* Sweep line overlay — glows top-to-bottom */}
              {qrState === "idle" && (
                <motion.rect
                  x={0}
                  y={0}
                  width={MATRIX_SIZE * MODULE_PX}
                  height={MODULE_PX * 3}
                  fill="rgba(99, 102, 241, 0.2)"
                  animate={{ y: ["0%", `${MATRIX_SIZE * MODULE_PX - MODULE_PX * 3}px`, "0%"] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{
                    filter: "blur(4px)",
                  }}
                />
              )}

              {/* Scan-success glow overlay */}
              {qrState === "scanning" && (
                <motion.rect
                  x={0}
                  y={0}
                  width={MATRIX_SIZE * MODULE_PX}
                  height={MATRIX_SIZE * MODULE_PX}
                  fill="rgba(34, 197, 94, 0.15)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </motion.svg>
          </div>

          {/* Status text */}
          <motion.p
            className="text-sm font-medium"
            animate={
              qrState === "scanning"
                ? { color: "#22C55E" }
                : { color: "var(--text-secondary)" }
            }
          >
            {qrState === "idle" && "Awaiting Mobile Connection…"}
            {qrState === "scanning" && "✓ Scan Approved!"}
          </motion.p>

          <p className="text-xs text-[--text-muted]">
            {qrState === "idle" && "Scan to bypass"}
            {qrState === "scanning" && "Redirecting to dashboard…"}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export { DynamicQRCode }
export type { DynamicQRCodeProps }
