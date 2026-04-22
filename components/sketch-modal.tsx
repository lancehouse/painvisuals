"use client"

import { useEffect, useCallback } from "react"
import { X } from "lucide-react"
import type p5 from "p5"
import { P5Sketch } from "./p5-sketch"

interface SketchModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  sketch: (p: p5) => void
}

export function SketchModal({ isOpen, onClose, title, description, sketch }: SketchModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm" onClick={onClose} />
      
      <div className="absolute inset-0">
        <P5Sketch sketch={sketch} className="w-full h-full" />
      </div>

      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-10 p-3 rounded-lg bg-background/80 backdrop-blur-sm border border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
        aria-label="Close fullscreen view"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
        <p className="text-sm text-muted-foreground bg-background/60 backdrop-blur-sm px-4 py-2 rounded-full border border-border">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">Esc</kbd> to close
        </p>
      </div>
    </div>
  )
}
