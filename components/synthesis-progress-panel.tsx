"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, AlertCircle, X, ChevronUp } from "lucide-react"
import type { CallTiming } from "@/lib/synthesis"
import { formatDuration } from "@/lib/synthesis"

interface SynthesisProgressPanelProps {
  calls: CallTiming[]
  isActive: boolean
  totalStartMs?: number
  isDialogOpen: boolean
  onPillClick: () => void
  onDialogClose: () => void
  container?: HTMLElement
}

// ── Elapsed timer for running calls ──────────────────────────────────────────

function useElapsed(active: boolean): number {
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

// ── Single call row ───────────────────────────────────────────────────────────

function CallRow({ call, now }: { call: CallTiming; now: number }) {
  const elapsed = call.startTime ? now - call.startTime : 0

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {/* Status icon */}
      <div className="w-4 shrink-0 flex items-center justify-center">
        {call.status === "done" && (
          <CheckCircle className="h-3.5 w-3.5 text-emerald-400/80" />
        )}
        {call.status === "error" && (
          <AlertCircle className="h-3.5 w-3.5 text-red-400/80" />
        )}
        {call.status === "running" && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="h-3 w-3 rounded-full border border-white/20 border-t-white/70"
          />
        )}
        {call.status === "pending" && (
          <div className="h-2 w-2 rounded-full bg-white/15" />
        )}
      </div>

      {/* Label */}
      <span className={`font-mono text-[10px] flex-1 leading-snug truncate ${
        call.status === "done"    ? "text-white/60" :
        call.status === "error"   ? "text-red-400/80" :
        call.status === "running" ? "text-white/85" :
        "text-white/25"
      }`}>
        {call.isParallel && <span className="text-white/25 mr-1">∥</span>}
        {call.label}
      </span>

      {/* Duration */}
      <span className="font-mono text-[9px] shrink-0 tabular-nums text-white/35">
        {call.status === "done"    && call.durationMs != null ? formatDuration(call.durationMs) :
         call.status === "running" && call.startTime           ? `${Math.round(elapsed / 1000)}s…` :
         call.status === "error"   ? "error" :
         "—"}
      </span>
    </div>
  )
}

// ── Progress dialog ───────────────────────────────────────────────────────────

function ProgressDialog({
  calls,
  isActive,
  totalStartMs,
  onClose,
}: {
  calls: CallTiming[]
  isActive: boolean
  totalStartMs?: number
  onClose: () => void
}) {
  const now    = useElapsed(isActive)
  const doneCount    = calls.filter(c => c.status === "done").length
  const totalCount   = calls.length
  const totalElapsed = totalStartMs ? now - totalStartMs : 0

  // Group: parallel calls together, sequential separate
  const parallelCalls    = calls.filter(c => c.isParallel)
  const sequentialCalls  = calls.filter(c => !c.isParallel)

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="fixed inset-0 z-[201] flex items-end justify-center pb-20 px-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-sm rounded-xl bg-[#0f0f0f] border border-white/10 shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div>
              <p className="font-mono text-[11px] font-semibold text-white/80">
                {isActive ? "Synthesis in progress" : "Synthesis complete"}
              </p>
              <p className="font-mono text-[9px] text-white/35 mt-0.5">
                {isActive
                  ? `${doneCount} of ${totalCount} calls done · ${Math.round(totalElapsed / 1000)}s elapsed`
                  : `${doneCount} calls · ${formatDuration(totalElapsed)}`
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-white/25 hover:text-white/55 hover:bg-white/5 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Call list */}
          <div className="px-4 py-3 max-h-72 overflow-y-auto">
            {parallelCalls.length > 0 && (
              <>
                <p className="font-mono text-[8px] uppercase tracking-widest text-white/25 mb-1">
                  Parallel calls
                </p>
                {parallelCalls.map(c => <CallRow key={c.id} call={c} now={now} />)}
              </>
            )}
            {parallelCalls.length > 0 && sequentialCalls.length > 0 && (
              <div className="my-2 border-t border-white/6" />
            )}
            {sequentialCalls.length > 0 && (
              <>
                <p className="font-mono text-[8px] uppercase tracking-widest text-white/25 mb-1">
                  Sequential calls
                </p>
                {sequentialCalls.map(c => <CallRow key={c.id} call={c} now={now} />)}
              </>
            )}
          </div>

          {/* Legend */}
          <div className="px-4 py-2 border-t border-white/6 flex items-center gap-3">
            <span className="font-mono text-[8px] text-white/20">∥ parallel</span>
            <span className="font-mono text-[8px] text-white/20">· sequential</span>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ── Bottom pill ───────────────────────────────────────────────────────────────

export function SynthesisProgressPanel({
  calls,
  isActive,
  totalStartMs,
  isDialogOpen,
  onPillClick,
  onDialogClose,
  container,
}: SynthesisProgressPanelProps) {
  const now        = useElapsed(isActive)
  const doneCount  = calls.filter(c => c.status === "done").length
  const totalCount = calls.length
  const hasError   = calls.some(c => c.status === "error")

  const [dismissed, setDismissed] = React.useState(false)

  // Reset dismissed state when a new synthesis starts
  React.useEffect(() => {
    if (isActive) setDismissed(false)
  }, [isActive])

  const pillLabel = hasError
    ? "Synthesis error — click for details"
    : isActive
      ? totalCount > 0
        ? `Synthesising — ${doneCount}/${totalCount} calls done`
        : "Synthesising…"
      : `Synthesis done — ${totalStartMs ? formatDuration(now - totalStartMs) : ""}`

  const showPill = calls.length > 0 && !dismissed

  const panel = (
    <>
      {/* Bottom pill */}
      <AnimatePresence>
        {showPill && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute bottom-[104px] left-1/2 -translate-x-1/2 z-[130] flex items-center gap-1 bg-black/90 border border-white/15 backdrop-blur-md shadow-xl rounded-sm"
          >
            <button
              onClick={onPillClick}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] transition-colors group rounded-l-sm"
            >
              {isActive && !hasError && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  className="h-2.5 w-2.5 rounded-full border border-white/30 border-t-white/80 shrink-0"
                />
              )}
              {hasError && <AlertCircle className="h-2.5 w-2.5 text-red-400/80 shrink-0" />}
              {!isActive && !hasError && <CheckCircle className="h-2.5 w-2.5 text-emerald-400/70 shrink-0" />}
              <span className="font-mono text-[10px] text-white/70 tracking-tight whitespace-nowrap">
                {pillLabel}
              </span>
              <ChevronUp className="h-2.5 w-2.5 text-white/30 group-hover:text-white/55 transition-colors" />
            </button>
            {/* Dismiss — only shown when not active */}
            {!isActive && (
              <button
                onClick={() => setDismissed(true)}
                className="px-1.5 py-1.5 text-white/25 hover:text-white/55 hover:bg-white/[0.04] transition-colors rounded-r-sm border-l border-white/8"
                aria-label="Dismiss"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress dialog */}
      <AnimatePresence>
        {isDialogOpen && (
          <ProgressDialog
            calls={calls}
            isActive={isActive}
            totalStartMs={totalStartMs}
            onClose={onDialogClose}
          />
        )}
      </AnimatePresence>
    </>
  )

  return container ? createPortal(panel, container) : panel
}
