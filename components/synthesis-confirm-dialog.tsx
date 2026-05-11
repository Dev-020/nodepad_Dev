"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, BookOpen, CheckSquare, Square, X } from "lucide-react"
import type { TextBlock } from "@/components/tile-card"

interface SynthesisConfirmDialogProps {
  isOpen: boolean
  sourceAnchors: TextBlock[]
  blockCount: number
  onConfirm: (enablePolish: boolean) => void
  onCancel: () => void
  container?: HTMLElement
}

export function SynthesisConfirmDialog({
  isOpen,
  sourceAnchors,
  blockCount,
  onConfirm,
  onCancel,
  container,
}: SynthesisConfirmDialogProps) {
  const [enablePolish, setEnablePolish] = React.useState(false)

  // Reset polish toggle when dialog re-opens
  React.useEffect(() => {
    if (isOpen) setEnablePolish(false)
  }, [isOpen])

  if (!isOpen) return null

  const hasAnchors = sourceAnchors.length > 0

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-md rounded-xl bg-[#0f0f0f] border border-white/10 shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div>
                  <h2 className="font-mono text-[13px] font-semibold text-white/90 tracking-tight">
                    Generate Synthesis Document
                  </h2>
                  <p className="font-mono text-[10px] text-white/40 mt-0.5">
                    {blockCount} note{blockCount !== 1 ? "s" : ""} · {hasAnchors ? `${sourceAnchors.length} source anchor${sourceAnchors.length !== 1 ? "s" : ""} detected` : "no source anchors"}
                  </p>
                </div>
                <button
                  onClick={onCancel}
                  className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">

                {/* Source anchors */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen className="h-3 w-3 text-white/40" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                      Source Anchors
                    </span>
                  </div>
                  {hasAnchors ? (
                    <ul className="space-y-1">
                      {sourceAnchors.map(a => (
                        <li key={a.id} className="font-mono text-[11px] text-white/70 pl-2 border-l border-white/10">
                          {a.text.length > 80 ? a.text.slice(0, 80) + "…" : a.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/8 border border-amber-500/20">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400/80 shrink-0 mt-0.5" />
                      <p className="font-mono text-[10px] text-amber-300/70 leading-relaxed">
                        No source reference nodes detected. Adding a{" "}
                        <span className="text-amber-300/90">reference</span> node naming your
                        source material significantly improves output quality. You can proceed
                        without one or cancel to add one first.
                      </p>
                    </div>
                  )}
                </div>

                {/* Polish toggle */}
                <div>
                  <button
                    onClick={() => setEnablePolish(p => !p)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/8 hover:border-white/15 hover:bg-white/[0.03] transition-all text-left group"
                  >
                    {enablePolish
                      ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      : <Square className="h-4 w-4 text-white/30 group-hover:text-white/50 shrink-0" />
                    }
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-white/80">
                        Enable AI Final Polish (Call D)
                      </p>
                      <p className="font-mono text-[9px] text-white/35 mt-0.5 break-words">
                        One additional sequential AI call that refines cross-section flow.
                        Produces a second polished file alongside the raw output.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Warnings */}
                <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.02] border border-white/6">
                  <p className="font-mono text-[9px] text-white/35 leading-relaxed">
                    <span className="text-white/50">·</span>{" "}
                    Notes added after clicking Generate will not be included in this synthesis.
                  </p>
                  <p className="font-mono text-[9px] text-white/35 leading-relaxed">
                    <span className="text-white/50">·</span>{" "}
                    Multiple parallel and sequential AI calls will fire simultaneously — expect
                    a spike in provider activity and corresponding token costs.
                  </p>
                  <p className="font-mono text-[9px] text-white/35 leading-relaxed">
                    <span className="text-white/50">·</span>{" "}
                    Estimated time varies by provider and model. Expect ~5 minutes for the
                    raw document{enablePolish ? ", longer with polish enabled" : ""}.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/8">
                <button
                  onClick={onCancel}
                  className="px-3 py-1.5 rounded-md font-mono text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onConfirm(enablePolish)}
                  className="px-4 py-1.5 rounded-md font-mono text-[11px] bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
                >
                  Generate
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return container ? createPortal(content, container) : content
}
