"use client"

import { useEffect, useRef } from "react"
import type p5 from "p5"

interface P5SketchProps {
  sketch: (p: p5) => void
  className?: string
}

export function P5Sketch({ sketch, className }: P5SketchProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const p5InstanceRef = useRef<p5 | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Prevent default scroll behavior on the container
    const container = containerRef.current
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
    }
    container.addEventListener("wheel", handleWheel, { passive: false })

    // Prevent default behavior for backspace/delete keys when sketch is focused
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault()
      }
    }
    container.addEventListener("keydown", handleKeyDown)

    // Make container focusable and focus it
    container.setAttribute("tabindex", "0")
    container.style.outline = "none"
    container.focus()

    // Dynamic import p5 to avoid SSR issues
    import("p5").then((p5Module) => {
      const P5 = p5Module.default

      // Clean up any existing instance
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove()
      }

      // Create new p5 instance
      p5InstanceRef.current = new P5(sketch, containerRef.current!)
    })

    return () => {
      container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("keydown", handleKeyDown)
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove()
        p5InstanceRef.current = null
      }
    }
  }, [sketch])

  return <div ref={containerRef} className={`flex items-center justify-center ${className}`} />
}
