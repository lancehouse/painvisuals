"use client"

import { useState } from "react"
import { sketches } from "@/lib/sketches"
import { SketchCard } from "./sketch-card"
import { SketchModal } from "./sketch-modal"

export function SketchGallery() {
  const [selectedSketch, setSelectedSketch] = useState<(typeof sketches)[0] | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sketches.map((sketch) => (
          <SketchCard
            key={sketch.id}
            id={sketch.id}
            title={sketch.title}
            description={sketch.description}
            sketch={sketch.sketch}
            onExpand={() => setSelectedSketch(sketch)}
          />
        ))}
      </div>

      {selectedSketch && (
        <SketchModal
          isOpen={!!selectedSketch}
          onClose={() => setSelectedSketch(null)}
          title={selectedSketch.title}
          description={selectedSketch.description}
          sketch={selectedSketch.sketch}
        />
      )}
    </>
  )
}
