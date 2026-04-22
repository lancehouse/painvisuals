import { SketchGallery } from "@/components/sketch-gallery"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            Pain Visuals
          </h1>
          <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto text-balance">
            Interactive visualizations for pain education. Click any sketch to view it fullscreen.
          </p>
        </header>

        <SketchGallery />

        <footer className="mt-16 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            Built with p5.js and Next.js
          </p>
        </footer>
      </div>
    </main>
  )
}
