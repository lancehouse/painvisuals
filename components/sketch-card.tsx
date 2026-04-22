"use client"

import { useEffect, useRef, useState } from "react"
import type p5 from "p5"
import { Expand } from "lucide-react"

interface SketchCardProps {
  id: string
  title: string
  description: string
  sketch: (p: p5) => void
  onExpand: () => void
}

export function SketchCard({ title, description, sketch, onExpand }: SketchCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const p5InstanceRef = useRef<p5 | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    // Create a modified sketch that fits the card dimensions
    const cardSketch = (p: p5) => {
      const originalSketch = sketch(p)

      // Override setup to use fixed card size
      const originalSetup = p.setup
      p.setup = () => {
        p.createCanvas(400, 300)
        if (originalSetup) {
          // Call original setup logic after canvas creation
        }
      }

      // Disable window resize for card view
      p.windowResized = () => {}

      return originalSketch
    }

    import("p5").then((p5Module) => {
      const P5 = p5Module.default

      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove()
      }

      // Create a simplified version of the sketch for preview
      const previewSketch = (p: p5) => {
        sketch(p)
        const originalSetup = p.setup
        p.setup = () => {
          p.createCanvas(400, 300)
        }
        p.windowResized = () => {}
      }

      p5InstanceRef.current = new P5(previewSketch, containerRef.current!)
    })

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove()
        p5InstanceRef.current = null
      }
    }
  }, [sketch])

  return (
    <div
      className="group relative overflow-hidden rounded-xl bg-card border border-border transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div ref={containerRef} className="aspect-[4/3] overflow-hidden" />
      
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      <button
        onClick={onExpand}
        className="absolute top-3 right-3 p-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:border-primary"
        aria-label={`View ${title} fullscreen`}
      >
        <Expand className="w-4 h-4" />
      </button>
    </div>
  )
}
