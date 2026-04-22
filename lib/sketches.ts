import type p5 from "p5"

export interface Sketch {
  id: string
  title: string
  description: string
  sketch: (p: p5) => void
}

// Example sketches - replace these with your Open Processing scripts
// Each sketch function receives the p5 instance and should define setup() and draw()

export const sketches: Sketch[] = [
  {
    id: "case-formulations",
    title: "Case Formulations",
    description: "Interactive pain network builder",
    sketch: (p: p5) => {
      interface Node {
        id: number
        label: string
        x: number
        y: number
        col: p5.Color
        r: number
        group: string
      }
      interface Edge {
        from: number
        to: number
        weight: number
      }

      let nodes: Node[] = []
      let edges: Edge[] = []
      let dragging: Node | null = null
      let phase = 0
      let inputBox: p5.Element
      let submitBtn: p5.Element
      let promptLabel: p5.Element
      let originNode: Node | null = null

      const COLORS = {
        origin: [220, 90, 90],
        affect: [100, 160, 220],
      }

      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight)

        promptLabel = p.createP("")
        promptLabel.style("font-family", "Georgia, serif")
        promptLabel.style("font-size", "20px")
        promptLabel.style("color", "#2a2a3a")
        promptLabel.style("margin", "0 0 10px 0")
        promptLabel.position(40, p.height - 110)

        inputBox = p.createInput("")
        inputBox.size(340, 38)
        inputBox.style("font-size", "17px")
        inputBox.style("font-family", "Georgia, serif")
        inputBox.style("padding", "6px 12px")
        inputBox.style("border", "2px solid #8888bb")
        inputBox.style("border-radius", "8px")
        inputBox.style("outline", "none")
        inputBox.position(40, p.height - 68)

        submitBtn = p.createButton("Add →")
        submitBtn.size(90, 42)
        submitBtn.style("font-size", "16px")
        submitBtn.style("font-family", "Georgia, serif")
        submitBtn.style("background", "#5566bb")
        submitBtn.style("color", "white")
        submitBtn.style("border", "none")
        submitBtn.style("border-radius", "8px")
        submitBtn.style("cursor", "pointer")
        submitBtn.position(396, p.height - 68)
        submitBtn.mousePressed(handleSubmit)

        inputBox.elt.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter") handleSubmit()
        })

        setPhase(0)
      }

      function setPhase(ph: number) {
        phase = ph
        if (ph === 0) {
          promptLabel.html("How did your pain begin?")
        } else if (ph === 1) {
          promptLabel.html("What does this affect?")
        }
        inputBox.value("")
        ;(inputBox.elt as HTMLInputElement).focus()
      }

      function handleSubmit() {
        const val = (inputBox.value() as string).trim()
        if (val === "") return

        if (phase === 0) {
          const n = makeNode(val, p.width / 2, p.height / 2 - 60, COLORS.origin, "origin")
          originNode = n
          nodes.push(n)
          setPhase(1)
        } else if (phase === 1 && originNode) {
          const angle = (nodes.length - 1) * 72 * (p.PI / 180)
          const r = 160
          const x = originNode.x + p.cos(angle) * r
          const y = originNode.y + p.sin(angle) * r

          const n = makeNode(val, x, y, COLORS.affect, "affect")
          nodes.push(n)
          edges.push({ from: originNode.id, to: n.id, weight: 0.8 })
          setPhase(1)
        }
      }

      function makeNode(label: string, x: number, y: number, col: number[], group: string): Node {
        return {
          id: nodes.length,
          label: label,
          x: x,
          y: y,
          col: p.color(col[0], col[1], col[2]),
          r: 28 + p.min(label.length * 1.5, 20),
          group: group,
        }
      }

      function getNode(id: number): Node | undefined {
        return nodes.find((n) => n.id === id)
      }

      function drawWrappedText(txt: string, x: number, y: number, maxW: number) {
        const words = txt.split(" ")
        const lines: string[] = []
        let current = ""
        p.textSize(12)
        for (const w of words) {
          const test = current ? current + " " + w : w
          if (p.textWidth(test) > maxW && current !== "") {
            lines.push(current)
            current = w
          } else {
            current = test
          }
        }
        if (current) lines.push(current)

        const lineH = 15
        const startY = y - ((lines.length - 1) * lineH) / 2
        for (let i = 0; i < lines.length; i++) {
          p.text(lines[i], x, startY + i * lineH)
        }
      }

      p.draw = () => {
        p.background(246, 246, 252)

        p.stroke(200, 200, 220, 80)
        p.strokeWeight(1.5)
        for (let x = 30; x < p.width; x += 40) {
          for (let y = 30; y < p.height - 130; y += 40) {
            p.point(x, y)
          }
        }

        for (const e of edges) {
          const a = getNode(e.from)
          const b = getNode(e.to)
          if (!a || !b) continue
          const w = e.weight
          const thickness = p.map(p.abs(w), 0, 1, 1, 7)
          const alpha = p.map(p.abs(w), 0, 1, 80, 200)
          p.stroke(80, 100, 200, alpha)
          p.strokeWeight(thickness)
          p.line(a.x, a.y, b.x, b.y)
        }

        for (const n of nodes) {
          p.noStroke()
          p.fill(0, 0, 0, 20)
          p.ellipse(n.x + 3, n.y + 5, (n.r + 6) * 2)

          p.stroke(255, 255, 255, 180)
          p.strokeWeight(3)
          p.fill(n.col)
          p.ellipse(n.x, n.y, n.r * 2)

          p.noStroke()
          p.fill(255)
          p.textAlign(p.CENTER, p.CENTER)
          p.textSize(12)
          p.textStyle(p.BOLD)
          drawWrappedText(n.label, n.x, n.y, n.r * 1.7)
        }

        p.noStroke()
        p.fill(50, 50, 80)
        p.textSize(18)
        p.textStyle(p.BOLD)
        p.textAlign(p.LEFT, p.TOP)
        p.text("Pain Network", 18, 18)

        p.stroke(180, 180, 210, 150)
        p.strokeWeight(1)
        p.line(0, p.height - 130, p.width, p.height - 130)
      }

      p.mousePressed = () => {
        for (const n of nodes) {
          if (p.dist(p.mouseX, p.mouseY, n.x, n.y) < n.r) {
            dragging = n
            break
          }
        }
      }

      p.mouseDragged = () => {
        if (dragging) {
          dragging.x = p.mouseX
          dragging.y = p.mouseY
        }
      }

      p.mouseReleased = () => {
        dragging = null
      }

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight)
        promptLabel.position(40, p.height - 110)
        inputBox.position(40, p.height - 68)
        submitBtn.position(396, p.height - 68)
      }
    },
  },
  {
    id: "protectometer",
    title: "Protectometer",
    description: "Interactive pain sensitivity meter with Lorenz system",
    sketch: (p: p5) => {
      // Canvas
      const CANVAS_WIDTH = 1000
      const CANVAS_HEIGHT = 680

      // Channels
      const NUM_CHANNELS = 5

      // VU meter
      const NUM_CIRCLES = 20
      const CIRCLE_DIAM = 30
      const VU_Y = 80

      // Slider track
      const SLIDER_TRACK_TOP = 200
      const SLIDER_TRACK_BOTTOM = 440
      const SLIDER_MIDPOINT = 0.5

      // Slider visuals
      const SLIDER_WIDTH = 42
      const SLIDER_HEIGHT = 20
      const SLIDER_X_SPACING = 140

      // Knob visuals
      const KNOB_Y = 560
      const DEFAULT_KNOB = 0.5
      const BASE_START_DEG = 225
      const BASE_END_DEG = 315
      const ROT = Math.PI
      const KNOB_RADIUS = 24
      const HANDLE_SIZE = 8
      const CLICK_PAD = 12

      // Label sizes
      const SLIDER_LABEL_SIZE = 20
      const BIG_LABEL_SIZE = 36
      const HEADER_SIZE = 40

      // Sensitivity
      const VU_SENSITIVITY = 2.1

      // Lorenz settings
      const LORENZ_TO_VU_FACTOR = 0.8
      const LORENZ_OUTPUT_OFFSET = 0.0
      let SHOW_LORENZ_SCOPE = true

      const LZ_OUTPUT_MIN = -100
      const LZ_OUTPUT_MAX = 100
      const LZ_OUTPUT_RANGE = 10
      const LZ_OUTPUT_SCALE = 0.4

      const lz_sigma = 10, lz_rho = 28, lz_beta = 8 / 3
      let lx = 0.1, ly = 1.0, lz = 1.05
      const lz_dt = 0.005
      const LZ_NUM_POINTS = 800
      let lzWaveform: number[] = new Array(LZ_NUM_POINTS).fill(0)

      const LZ_SCOPE_W = 120, LZ_SCOPE_H = 75

      interface Slider {
        x: number
        y: number
        knobAngle: number
        START: number
        END: number
        FORBIDDEN: number
        ALLOWED: number
        draggingSlider: boolean
        draggingKnob: boolean
      }

      interface LorenzKnob {
        x: number
        y: number
        angle: number
        START: number
        END: number
        FORBIDDEN: number
        ALLOWED: number
        dragging: boolean
      }

      interface EditableLabel {
        text: string
        x: number
        y: number
        size: number
        center: boolean
        locked: boolean
        vertical: boolean
        alignBottom: boolean
        editing: boolean
      }

      let sliders: Slider[] = []
      let circleSpacing: number
      let editableLabels: EditableLabel[] = []
      let lorenzKnob: LorenzKnob
      let draggingLorenz = false
      let vuLightValues: number[] = new Array(NUM_CIRCLES).fill(0)
      let vuTargetValues: number[] = new Array(NUM_CIRCLES).fill(0)

      function normalizeAngle(a: number): number {
        a = a % p.TWO_PI
        return a < 0 ? a + p.TWO_PI : a
      }

      function isInForbiddenArc(a: number, start: number, forbidden: number): boolean {
        const distFromStart = (a - start + p.TWO_PI) % p.TWO_PI
        const EPS = 1e-12
        return distFromStart > EPS && distFromStart < forbidden - EPS
      }

      function clampToAllowed(a: number, start: number, end: number, forbidden: number): number {
        if (!isInForbiddenArc(a, start, forbidden)) return a
        const dToStart = Math.abs(a - start)
        const dToEnd = Math.abs(a - end)
        return dToStart <= dToEnd ? start : end
      }

      function angleToPercent(a: number): number {
        a = normalizeAngle(a)
        const baseStart = normalizeAngle(p.radians(BASE_START_DEG) + ROT)
        const baseEnd = normalizeAngle(p.radians(BASE_END_DEG) + ROT)
        const forbidden = (baseEnd - baseStart + p.TWO_PI) % p.TWO_PI
        const allowed = p.TWO_PI - forbidden
        const dist = (a - baseStart + p.TWO_PI) % p.TWO_PI
        if (dist < forbidden + 1e-12) return 0.0
        const distAlongAllowed = dist - forbidden
        const pct = (distAlongAllowed / allowed) * 100.0
        return p.constrain(pct, 0, 100)
      }

      function makeLabel(text: string, x: number, y: number, size: number, options: Partial<EditableLabel> = {}): EditableLabel {
        return {
          text,
          x,
          y,
          size,
          center: !!options.center,
          locked: !!options.locked,
          vertical: !!options.vertical,
          alignBottom: !!options.alignBottom,
          editing: false,
        }
      }

      function displayLabel(lbl: EditableLabel) {
        p.fill(0)
        p.noStroke()
        p.textSize(lbl.size)

        if (lbl.vertical) {
          p.push()
          p.translate(lbl.x, lbl.y)
          p.rotate(-p.HALF_PI)
          p.textAlign(p.LEFT, p.BOTTOM)
          p.text(lbl.text + (lbl.editing ? "|" : ""), 0, 0)
          p.pop()
        } else if (lbl.center) {
          p.textAlign(p.CENTER, p.CENTER)
          p.text(lbl.text + (lbl.editing ? "|" : ""), lbl.x, lbl.y)
        } else if (lbl.alignBottom) {
          p.textAlign(p.LEFT, p.BOTTOM)
          p.text(lbl.text + (lbl.editing ? "|" : ""), lbl.x, lbl.y)
        } else {
          p.textAlign(p.LEFT, p.CENTER)
          p.text(lbl.text + (lbl.editing ? "|" : ""), lbl.x, lbl.y)
        }
      }

      function isOverLabel(lbl: EditableLabel, mx: number, my: number): boolean {
        if (lbl.locked) return false
        p.textSize(lbl.size)
        if (lbl.vertical) {
          const w = p.textWidth(lbl.text) + 10
          const h = lbl.size + 8
          const lx = lbl.x - h
          const ly = lbl.y - w
          return mx > lx && mx < lx + h && my > ly && my < ly + w
        } else if (lbl.center) {
          const w = p.textWidth(lbl.text)
          const h = lbl.size
          return mx > lbl.x - w / 2 && mx < lbl.x + w / 2 && my > lbl.y - h / 2 && my < lbl.y + h / 2
        } else {
          const w = p.textWidth(lbl.text)
          const h = lbl.size
          return mx > lbl.x && mx < lbl.x + w && my > lbl.y - h / 2 && my < lbl.y + h / 2
        }
      }

      p.setup = () => {
        p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)
        p.angleMode(p.RADIANS)
        p.textFont("Helvetica")

        circleSpacing = (p.width - CIRCLE_DIAM) / (NUM_CIRCLES - 1)
        const startX = (p.width - (NUM_CHANNELS - 1) * SLIDER_X_SPACING) / 2 + 50

        // Build sliders
        for (let i = 0; i < NUM_CHANNELS; i++) {
          const x = startX + i * SLIDER_X_SPACING
          const baseStart = normalizeAngle(p.radians(BASE_START_DEG) + ROT)
          const baseEnd = normalizeAngle(p.radians(BASE_END_DEG) + ROT)
          const forbidden = (baseEnd - baseStart + p.TWO_PI) % p.TWO_PI
          const allowed = p.TWO_PI - forbidden
          const y = p.map(SLIDER_MIDPOINT, 0, 1, SLIDER_TRACK_BOTTOM, SLIDER_TRACK_TOP)
          const INITIAL_ANGLE_OFFSET = p.radians(-180)

          sliders.push({
            x,
            y,
            knobAngle: p.map(DEFAULT_KNOB, 0, 1, baseStart, baseEnd) + INITIAL_ANGLE_OFFSET,
            START: baseStart,
            END: baseEnd,
            FORBIDDEN: forbidden,
            ALLOWED: allowed,
            draggingSlider: false,
            draggingKnob: false,
          })
        }

        // Build Lorenz knob
        const lorenzX = startX - SLIDER_X_SPACING
        const lorenzY = (SLIDER_TRACK_TOP + SLIDER_TRACK_BOTTOM) / 2
        const lbaseStart = normalizeAngle(p.radians(BASE_START_DEG) + ROT)
        const lbaseEnd = normalizeAngle(p.radians(BASE_END_DEG) + ROT)
        const lforbidden = (lbaseEnd - lbaseStart + p.TWO_PI) % p.TWO_PI
        const lallowed = p.TWO_PI - lforbidden

        lorenzKnob = {
          x: lorenzX,
          y: lorenzY,
          angle: p.map(DEFAULT_KNOB, 0, 1, lbaseStart, lbaseEnd),
          START: lbaseStart,
          END: lbaseEnd,
          FORBIDDEN: lforbidden,
          ALLOWED: lallowed,
          dragging: false,
        }

        // Labels
        const greenMidIndex = Math.floor((0 + 8) / 2)
        const greenMidX = greenMidIndex * circleSpacing + CIRCLE_DIAM / 2
        editableLabels.push(makeLabel("No Pain", greenMidX, VU_Y - 50, BIG_LABEL_SIZE, { center: true }))
        editableLabels.push(makeLabel("On Alert", p.width / 2, VU_Y - 30, 20, { center: true, locked: true }))

        const redMidIndex = Math.floor((11 + 19) / 2)
        const redMidX = redMidIndex * circleSpacing + CIRCLE_DIAM / 2
        editableLabels.push(makeLabel("Pain", redMidX, VU_Y - 50, BIG_LABEL_SIZE, { center: true }))
        editableLabels.push(makeLabel("DIMS", p.width / 2, SLIDER_TRACK_TOP - 50, HEADER_SIZE, { center: true }))
        editableLabels.push(makeLabel("SIMS", p.width / 2, SLIDER_TRACK_BOTTOM + 50, HEADER_SIZE, { center: true }))

        const sliderNames = ["Current Environment", "Beliefs", "Behaviours", "Past Experiences", "General Health"]
        for (let i = 0; i < NUM_CHANNELS; i++) {
          const labelX = sliders[i].x - (SLIDER_WIDTH / 2 + 2)
          editableLabels.push(makeLabel(sliderNames[i], labelX, SLIDER_TRACK_BOTTOM, SLIDER_LABEL_SIZE, { vertical: true, alignBottom: true }))
        }

        editableLabels.push(makeLabel("Sensitivity", p.width / 2, KNOB_Y + KNOB_RADIUS + 40, 20, { center: true, locked: true }))
        editableLabels.push(makeLabel("Uncertainty (u)", lorenzKnob.x, lorenzKnob.y + 60, 18, { center: true, locked: true }))
        editableLabels.push(makeLabel("Inspired and based on Moseley and Butler's Original Protectometer as Published by NOIGroup", 220, KNOB_Y + KNOB_RADIUS + 70, 10, { center: true, locked: true }))
      }

      function drawTick(cx: number, cy: number, ang: number, radius: number, len: number) {
        p.stroke(80)
        p.strokeWeight(3)
        const x1 = cx + radius * 0.88 * p.cos(ang)
        const y1 = cy + radius * 0.88 * p.sin(ang)
        const x2 = cx + (radius * 0.88 + len) * p.cos(ang)
        const y2 = cy + (radius * 0.88 + len) * p.sin(ang)
        p.line(x1, y1, x2, y2)
        p.noStroke()
      }

      function drawSliderAndKnob(s: Slider) {
        p.stroke(0)
        p.strokeWeight(6)
        p.line(s.x, SLIDER_TRACK_TOP, s.x, SLIDER_TRACK_BOTTOM)

        p.stroke(150)
        p.strokeWeight(2)
        p.line(s.x - 20, (SLIDER_TRACK_TOP + SLIDER_TRACK_BOTTOM) / 2, s.x + 20, (SLIDER_TRACK_TOP + SLIDER_TRACK_BOTTOM) / 2)

        p.noStroke()
        p.fill(100, 150, 250)
        p.rectMode(p.CENTER)
        p.rect(s.x, s.y, SLIDER_WIDTH, SLIDER_HEIGHT, 6)

        const cx = s.x
        const cy = KNOB_Y

        p.noFill()
        p.strokeWeight(8)
        p.stroke(200)
        p.arc(cx, cy, KNOB_RADIUS * 2.2, KNOB_RADIUS * 2.2, s.END, s.START + p.TWO_PI)

        p.noStroke()
        p.fill(210)
        p.circle(cx, cy, KNOB_RADIUS * 2)

        p.stroke(40)
        p.strokeWeight(4)
        const ix = cx + KNOB_RADIUS * 0.78 * p.cos(s.knobAngle)
        const iy = cy + KNOB_RADIUS * 0.78 * p.sin(s.knobAngle)
        p.line(cx, cy, ix, iy)
        p.noStroke()
        p.fill(40)
        p.circle(ix, iy, HANDLE_SIZE)

        drawTick(cx, cy, s.START, KNOB_RADIUS, 10)
        drawTick(cx, cy, s.END, KNOB_RADIUS, 10)
      }

      function drawKnob(cx: number, cy: number, angle: number, START: number, END: number) {
        p.noFill()
        p.strokeWeight(8)
        p.stroke(200)
        p.arc(cx, cy, KNOB_RADIUS * 2.2, KNOB_RADIUS * 2.2, END, START + p.TWO_PI)

        p.noStroke()
        p.fill(210)
        p.circle(cx, cy, KNOB_RADIUS * 2)

        p.stroke(40)
        p.strokeWeight(4)
        const ix = cx + KNOB_RADIUS * 0.78 * p.cos(angle)
        const iy = cy + KNOB_RADIUS * 0.78 * p.sin(angle)
        p.line(cx, cy, ix, iy)
        p.noStroke()
        p.fill(40)
        p.circle(ix, iy, HANDLE_SIZE)

        drawTick(cx, cy, START, KNOB_RADIUS, 10)
        drawTick(cx, cy, END, KNOB_RADIUS, 10)
      }

      p.draw = () => {
        p.background(245, 245, 55)

        // VU meter calculation
        let avgValueFromChannels = sliders.reduce((sum, s) => {
          const sliderNorm = p.map(s.y, SLIDER_TRACK_BOTTOM, SLIDER_TRACK_TOP, 0, 1)
          const knobNorm = angleToPercent(s.knobAngle) / 100
          return sum + sliderNorm * knobNorm
        }, 0) / NUM_CHANNELS * VU_SENSITIVITY

        // Lorenz integration
        const dx = lz_sigma * (ly - lx) * lz_dt
        const dy = (lx * (lz_rho - lz) - ly) * lz_dt
        const dz = (lx * ly - lz_beta * lz) * lz_dt
        lx += dx; ly += dy; lz += dz

        const l_amp = angleToPercent(lorenzKnob.angle) / 100.0 * 0.8
        lzWaveform.push(lx * l_amp)
        if (lzWaveform.length > LZ_NUM_POINTS) lzWaveform.shift()

        let rawLorenz = p.map(lx * l_amp, -LZ_OUTPUT_RANGE, LZ_OUTPUT_RANGE, LZ_OUTPUT_MIN, LZ_OUTPUT_MAX)
        rawLorenz = p.constrain(rawLorenz, LZ_OUTPUT_MIN, LZ_OUTPUT_MAX)
        rawLorenz *= LZ_OUTPUT_SCALE

        // Lorenz scope
        if (SHOW_LORENZ_SCOPE) {
          p.push()
          p.translate(lorenzKnob.x - LZ_SCOPE_W / 2, lorenzKnob.y + 30)
          p.stroke(50, 200, 50)
          p.line(0, LZ_SCOPE_H / 2, LZ_SCOPE_W, LZ_SCOPE_H / 2)
          p.noFill()
          p.stroke(0, 255, 100)
          p.beginShape()
          for (let i = 0; i < lzWaveform.length; i++) {
            const px = p.map(i, 0, LZ_NUM_POINTS - 1, 0, LZ_SCOPE_W)
            const py = LZ_SCOPE_H / 2 - lzWaveform[i] * 10
            p.vertex(px, py)
          }
          p.endShape()
          p.pop()

          p.noStroke()
          p.fill(0)
          p.textAlign(p.CENTER, p.TOP)
          p.textSize(14)
          p.text("Uncertainty (Lorenz): " + p.nf(rawLorenz, 1, 2), lorenzKnob.x, lorenzKnob.y + LZ_SCOPE_H + 220)
        }

        const lorenzCentered = (rawLorenz - LORENZ_OUTPUT_OFFSET) / (LZ_OUTPUT_MAX - LZ_OUTPUT_MIN)
        let combinedVU = avgValueFromChannels + lorenzCentered * LORENZ_TO_VU_FACTOR
        combinedVU = p.constrain(combinedVU, 0, 1)

        const litThreshold = combinedVU * NUM_CIRCLES

        // VU meter circles
        for (let i = 0; i < NUM_CIRCLES; i++) {
          vuTargetValues[i] = i < litThreshold ? 255 : 0
          vuLightValues[i] += (vuTargetValues[i] - vuLightValues[i]) * 0.05

          const x = i * circleSpacing + CIRCLE_DIAM / 2
          const y = VU_Y
          let col: p5.Color
          if (i < 9) col = p.color(50, 250, 50)
          else if (i < 11) col = p.color(250, 150, 50)
          else col = p.color(250, 50, 50)

          const alpha = vuLightValues[i]

          p.fill(180)
          p.ellipse(x, y, CIRCLE_DIAM)

          for (let g = 1; g <= 3; g++) {
            p.fill(p.red(col), p.green(col), p.blue(col), alpha / (g * 2))
            p.ellipse(x, y, CIRCLE_DIAM + g * 6)
          }
          p.fill(p.red(col), p.green(col), p.blue(col), alpha)
          p.ellipse(x, y, CIRCLE_DIAM)
        }

        // Draw sliders and knobs
        sliders.forEach(s => drawSliderAndKnob(s))
        drawKnob(lorenzKnob.x, lorenzKnob.y, lorenzKnob.angle, lorenzKnob.START, lorenzKnob.END)

        // Output display
        p.fill(0)
        p.textSize(16)
        p.textAlign(p.CENTER, p.CENTER)
        p.text("Output " + (combinedVU * 100).toFixed(1) + "%", lorenzKnob.x, lorenzKnob.y + 260)

        // Labels
        editableLabels.forEach(lbl => displayLabel(lbl))
      }

      p.mousePressed = () => {
        // Check labels first
        let clickedLabel = false
        for (const lbl of editableLabels) {
          if (isOverLabel(lbl, p.mouseX, p.mouseY) && !lbl.locked) {
            lbl.editing = true
            editableLabels.forEach(o => { if (o !== lbl) o.editing = false })
            clickedLabel = true
            break
          } else {
            lbl.editing = false
          }
        }
        if (clickedLabel) return

        // Sliders and knobs
        sliders.forEach(s => {
          if (Math.abs(p.mouseX - s.x) < SLIDER_WIDTH / 2 && Math.abs(p.mouseY - s.y) < SLIDER_HEIGHT / 2) {
            s.draggingSlider = true
          }
          if (p.dist(p.mouseX, p.mouseY, s.x, KNOB_Y) <= KNOB_RADIUS + CLICK_PAD) {
            s.draggingKnob = true
          }
        })

        // Lorenz knob
        if (p.dist(p.mouseX, p.mouseY, lorenzKnob.x, lorenzKnob.y) <= KNOB_RADIUS + CLICK_PAD) {
          draggingLorenz = true
        }
      }

      p.mouseReleased = () => {
        sliders.forEach(s => { s.draggingSlider = false; s.draggingKnob = false })
        draggingLorenz = false
      }

      p.mouseDragged = () => {
        sliders.forEach(s => {
          if (s.draggingSlider) s.y = p.constrain(p.mouseY, SLIDER_TRACK_TOP, SLIDER_TRACK_BOTTOM)
          if (s.draggingKnob) {
            let a = p.atan2(p.mouseY - KNOB_Y, p.mouseX - s.x)
            a = normalizeAngle(a)
            s.knobAngle = clampToAllowed(a, s.START, s.END, s.FORBIDDEN)
          }
        })

        if (draggingLorenz) {
          let a = p.atan2(p.mouseY - lorenzKnob.y, p.mouseX - lorenzKnob.x)
          a = normalizeAngle(a)
          lorenzKnob.angle = clampToAllowed(a, lorenzKnob.START, lorenzKnob.END, lorenzKnob.FORBIDDEN)
        }
      }

      p.keyPressed = () => {
        if (p.key === "u" || p.key === "U") SHOW_LORENZ_SCOPE = !SHOW_LORENZ_SCOPE

        for (const lbl of editableLabels) {
          if (!lbl.editing) continue
          if (p.keyCode === p.BACKSPACE || p.keyCode === p.DELETE) {
            lbl.text = lbl.text.slice(0, -1)
            return false // Prevent default browser behavior
          } else if (p.keyCode === p.ENTER) {
            lbl.editing = false
            return false
          }
        }
        return true
      }

      p.keyTyped = () => {
        for (const lbl of editableLabels) {
          if (lbl.editing && !lbl.locked) {
            if (p.key && p.key.length === 1) {
              lbl.text += p.key
              return false // Prevent default
            }
          }
        }
        return true
      }
    },
  },
  {
    id: "sweet-zone",
    title: "Sweet Zone",
    description: "Vintage VU-style half-moon meter with editable labels",
    sketch: (p: p5) => {
      // Canvas
      const canvasW = 920, canvasH = 660
      const dialRadius = 340
      let dialCenterX: number, dialCenterY: number
      let canvasElem: p5.Element

      // Colors
      const FRAME_COLOR = '#0c0c0c'
      const DIAL_BG: [number, number, number] = [245, 230, 150]
      const Z_TOO_LITTLE: [number, number, number] = [250, 230, 160]
      const Z_SWEET: [number, number, number] = [240, 70, 120]
      const Z_TOO_MUCH: [number, number, number] = [250, 210, 110]
      const TICK_COLOR = '#111'
      const NEEDLE_COLOR = '#222'

      // Scale & zones (0..100)
      let lowBoundary = 30
      let highBoundary = 70

      // Needle value (0..100)
      let needleValue = 28

      // Dragging state
      let draggingNeedle = false
      let draggingLow = false
      let draggingHigh = false

      // Editable text state
      let uncertaintyText = "DEMAND ON THE SYSTEM"
      let inputUnc: p5.Element
      let editingUnc = false

      p.setup = () => {
        canvasElem = p.createCanvas(canvasW, canvasH)
        p.angleMode(p.DEGREES)
        p.textAlign(p.CENTER, p.CENTER)
        p.textFont("cursive")

        dialCenterX = p.width / 2
        dialCenterY = p.height / 2 + 60
        p.noSmooth()

        // Create invisible input for editing the curved word
        inputUnc = p.createInput(uncertaintyText)
        inputUnc.hide()
        inputUnc.style("background", "rgba(0,0,0,0)")
        inputUnc.style("border", "none")
        inputUnc.style("outline", "none")
        inputUnc.style("color", "white")
        inputUnc.style("text-align", "center")
        inputUnc.style("font-family", "cursive")
        inputUnc.style("padding", "0px")
        inputUnc.style("margin", "0px")

        inputUnc.elt.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter") {
            finishEditingUnc()
          } else if (e.key === "Escape") {
            cancelEditingUnc()
          }
        })
        inputUnc.elt.addEventListener("blur", () => {
          finishEditingUnc()
        })
      }

      function drawArcWord(str: string, centerAng: number, radius: number, txtSize: number, col: p5.Color) {
        p.push()
        p.translate(dialCenterX, dialCenterY)
        p.textSize(txtSize)
        p.textAlign(p.CENTER, p.CENTER)
        p.fill(col)
        p.noStroke()

        const totalW = p.textWidth(str)
        const arcSpan = p.degrees(totalW / radius)
        let startAng = centerAng - arcSpan / 2

        for (let i = 0; i < str.length; i++) {
          const letter = str[i]
          const lw = p.textWidth(letter)
          const midAng = startAng + p.degrees(lw / 2 / radius)

          const x = p.cos(midAng) * radius
          const y = p.sin(midAng) * radius
          p.push()
          p.translate(x, y)
          p.rotate(midAng + 90)
          p.text(letter, 0, 0)
          p.pop()

          startAng += p.degrees(lw / radius)
        }
        p.pop()
      }

      p.draw = () => {
        p.background(18)

        drawFrame()

        // Dial background
        p.noStroke()
        p.fill(DIAL_BG)
        p.arc(dialCenterX, dialCenterY, dialRadius * 2, dialRadius * 2, -180, 0, p.PIE)

        drawZones()
        drawTicks()
        drawLowerScoops()
        drawNeedle()

        // Center hub
        p.fill(20)
        p.ellipse(dialCenterX, dialCenterY, 22)

        drawLabels()
        drawHandles()
      }

      function drawFrame() {
        p.push()
        p.translate(p.width / 2, p.height / 2)
        p.noStroke()
        p.fill(FRAME_COLOR)
        p.rectMode(p.CENTER)
        p.rect(0, 0, 380, 380, 8)

        p.fill(40)
        p.rect(0, 0, 380, 360, 6)
        p.pop()

        p.stroke(0, 60)
        p.strokeWeight(2)
        p.noFill()
        p.ellipse(dialCenterX, dialCenterY, (dialRadius * 2) + 6)
        p.noStroke()
      }

      function drawZones() {
        const startAng = -180
        const lowAng = p.map(lowBoundary, 0, 100, -180, 0)
        const highAng = p.map(highBoundary, 0, 100, -180, 0)

        p.noStroke()
        p.fill(Z_TOO_LITTLE)
        p.arc(dialCenterX, dialCenterY, dialRadius * 2, dialRadius * 2, startAng, lowAng, p.PIE)

        p.fill(Z_SWEET)
        p.arc(dialCenterX, dialCenterY, dialRadius * 2, dialRadius * 2, lowAng, highAng, p.PIE)

        p.fill(Z_TOO_MUCH)
        p.arc(dialCenterX, dialCenterY, dialRadius * 2, dialRadius * 2, highAng, 0, p.PIE)
      }

      function drawTicks() {
        p.push()
        p.translate(dialCenterX, dialCenterY)
        p.stroke(TICK_COLOR)

        const major = 10
        p.strokeWeight(2)
        for (let i = 0; i <= major; i++) {
          const ang = p.map(i, 0, major, -180, 0)
          const rOut = dialRadius - 8
          const rIn = dialRadius - 32
          const x1 = p.cos(ang) * rOut
          const y1 = p.sin(ang) * rOut
          const x2 = p.cos(ang) * rIn
          const y2 = p.sin(ang) * rIn
          p.line(x1, y1, x2, y2)

          p.noStroke()
          p.fill(10)
          p.textSize(12)
          const labelR = dialRadius - 56
          p.text(Math.floor(p.map(i, 0, major, 0, 100)), p.cos(ang) * labelR, p.sin(ang) * labelR)
          p.stroke(TICK_COLOR)
        }

        p.strokeWeight(1)
        const minorPerMajor = 4
        for (let i = 0; i <= major * minorPerMajor; i++) {
          const ang = p.map(i, 0, major * minorPerMajor, -180, 0)
          if (i % minorPerMajor === 0) continue
          const rOut = dialRadius - 8
          const rIn = dialRadius - 22
          p.line(p.cos(ang) * rOut, p.sin(ang) * rOut, p.cos(ang) * rIn, p.sin(ang) * rIn)
        }
        p.pop()
      }

      function drawLowerScoops() {
        p.push()
        p.translate(dialCenterX, dialCenterY)
        p.noStroke()
        p.fill(18)
        p.ellipse(-50, dialRadius * 0.34, 70, 46)
        p.ellipse(50, dialRadius * 0.34, 70, 46)
        p.fill(80)
        p.arc(0, dialRadius * 0.42, 120, 60, 180, 360, p.CHORD)
        p.pop()
      }

      function drawNeedle() {
        const ang = p.map(p.constrain(needleValue, 0, 100), 0, 100, -90, +90)

        p.push()
        p.translate(dialCenterX, dialCenterY)
        p.rotate(ang)

        p.noStroke()
        p.fill(NEEDLE_COLOR)
        p.beginShape()
        p.vertex(-8, 8)
        p.vertex(8, 8)
        p.vertex(3, -(dialRadius - 50))
        p.vertex(-3, -(dialRadius - 50))
        p.endShape(p.CLOSE)

        p.stroke(255, 80)
        p.strokeWeight(1)
        p.line(0, 6, 0, -(dialRadius - 56))
        p.noStroke()
        p.pop()
      }

      function drawLabels() {
        p.push()
        p.fill(240, 70, 120)
        p.textSize(32)
        p.text('RETRAINING FOR CHANGE', dialCenterX, dialCenterY + 85)

        p.textSize(22)
        p.text('+', dialCenterX + dialRadius - 28, dialCenterY - 8)
        p.text('–', dialCenterX - dialRadius + 28, dialCenterY - 8)

        // Zone labels
        p.textSize(25)
        p.noStroke()
        p.fill(10, 180)

        const lowMid = lowBoundary / 2
        const sweetMid = (lowBoundary + highBoundary) / 2
        const highMid = (highBoundary + 100) / 2

        const lowAng = p.map(lowMid, 0, 100, -180, 0)
        const sweetAng = p.map(sweetMid, 0, 100, -180, 0)
        const highAng = p.map(highMid, 0, 100, -180, 0)

        const labelR = dialRadius * 0.50

        p.text('TOO LITTLE', dialCenterX + p.cos(lowAng) * labelR, dialCenterY + p.sin(lowAng) * labelR)
        p.text('SWEET ZONE', dialCenterX + p.cos(sweetAng) * labelR, dialCenterY + p.sin(sweetAng) * labelR)
        p.text('TOO MUCH', dialCenterX + p.cos(highAng) * labelR, dialCenterY + p.sin(highAng) * labelR)

        // Outer arc words
        const outerR = dialRadius + 20
        drawArcWord("LESS", -160, outerR, 28, p.color(220, 90, 50))
        drawArcWord(uncertaintyText, -90, outerR, 32, p.color(255))
        drawArcWord("MORE", -20, outerR, 28, p.color(220, 90, 50))

        p.pop()
      }

      function drawHandles() {
        // Low boundary handle
        const lowAng = p.map(lowBoundary, 0, 100, -180, 0)
        const lx = dialCenterX + p.cos(lowAng) * dialRadius
        const ly = dialCenterY + p.sin(lowAng) * dialRadius

        p.fill(230, 200, 80)
        p.noStroke()
        p.ellipse(lx, ly, 12)

        // High boundary handle
        const highAng = p.map(highBoundary, 0, 100, -180, 0)
        const hx = dialCenterX + p.cos(highAng) * dialRadius
        const hy = dialCenterY + p.sin(highAng) * dialRadius

        p.fill(200, 80, 80)
        p.ellipse(hx, hy, 12)
      }

      function hitTestArcWord(str: string, centerAng: number, radius: number, txtSize: number, mx: number, my: number): boolean {
        p.push()
        p.textSize(txtSize)
        const totalW = p.textWidth(str)
        const arcSpan = p.degrees(totalW / radius)
        let startAng = centerAng - arcSpan / 2

        for (let i = 0; i < str.length; i++) {
          const letter = str[i]
          const lw = p.textWidth(letter)
          const midAng = startAng + p.degrees(lw / 2 / radius)

          const x = dialCenterX + p.cos(midAng) * radius
          const y = dialCenterY + p.sin(midAng) * radius

          const hitR = Math.max(18, txtSize * 0.6)
          if (p.dist(mx, my, x, y) < hitR) {
            p.pop()
            return true
          }
          startAng += p.degrees(lw / radius)
        }
        p.pop()
        return false
      }

      function startInteraction(x: number, y: number) {
        if (editingUnc) return

        const d = p.dist(x, y, dialCenterX, dialCenterY)
        if (d < dialRadius + 8 && y < dialCenterY + 20) {
          draggingNeedle = true
          updateNeedleFromPos(x, y)
        }

        // Check handles
        const lowAng = p.map(lowBoundary, 0, 100, -180, 0)
        const lx = dialCenterX + p.cos(lowAng) * dialRadius
        const ly = dialCenterY + p.sin(lowAng) * dialRadius
        if (p.dist(x, y, lx, ly) < 14) {
          draggingLow = true
        }

        const highAng = p.map(highBoundary, 0, 100, -180, 0)
        const hx = dialCenterX + p.cos(highAng) * dialRadius
        const hy = dialCenterY + p.sin(highAng) * dialRadius
        if (p.dist(x, y, hx, hy) < 14) {
          draggingHigh = true
        }
      }

      function dragInteraction(x: number, y: number) {
        if (draggingNeedle) updateNeedleFromPos(x, y)
        if (draggingLow) updateBoundaryFromPos(x, y, 'low')
        if (draggingHigh) updateBoundaryFromPos(x, y, 'high')
      }

      function endInteraction() {
        draggingNeedle = false
        draggingLow = false
        draggingHigh = false
      }

      p.mousePressed = () => {
        const outerR = dialRadius + 20
        if (hitTestArcWord(uncertaintyText, -90, outerR, 32, p.mouseX, p.mouseY)) {
          startEditingUnc()
          return
        }
        startInteraction(p.mouseX, p.mouseY)
      }

      p.mouseDragged = () => {
        dragInteraction(p.mouseX, p.mouseY)
      }

      p.mouseReleased = () => {
        endInteraction()
      }

      p.touchStarted = () => {
        const outerR = dialRadius + 20
        if (p.touches.length > 0) {
          const t = p.touches[0] as { x: number; y: number }
          if (hitTestArcWord(uncertaintyText, -90, outerR, 32, t.x, t.y)) {
            startEditingUnc()
            return false
          }
          startInteraction(t.x, t.y)
        }
        return false
      }

      p.touchMoved = () => {
        if (p.touches.length > 0) {
          const t = p.touches[0] as { x: number; y: number }
          dragInteraction(t.x, t.y)
        }
        return false
      }

      p.touchEnded = () => {
        endInteraction()
        return false
      }

      function updateNeedleFromPos(mx: number, my: number) {
        let ang = p.atan2(my - dialCenterY, mx - dialCenterX)
        ang = p.constrain(ang, -180, 0)
        needleValue = p.map(ang, -180, 0, 0, 100)
        needleValue = p.constrain(needleValue, 0, 100)
      }

      function updateBoundaryFromPos(mx: number, my: number, which: string) {
        let ang = p.atan2(my - dialCenterY, mx - dialCenterX)
        ang = p.constrain(ang, -180, 0)
        const val = p.map(ang, -180, 0, 0, 100)

        if (which === 'low') {
          lowBoundary = p.constrain(val, 0, highBoundary - 5)
        } else if (which === 'high') {
          highBoundary = p.constrain(val, lowBoundary + 5, 100)
        }
      }

      function startEditingUnc() {
        if (editingUnc) return
        editingUnc = true
        inputUnc.value(uncertaintyText)
        inputUnc.show()

        p.textSize(32)
        const w = Math.max(80, p.textWidth(uncertaintyText) + 20)
        inputUnc.size(w, 36)
        inputUnc.style("font-size", "32px")

        const outerR = dialRadius + 20
        const centerAng = -90
        const cx = dialCenterX + p.cos(centerAng) * outerR
        const cy = dialCenterY + p.sin(centerAng) * outerR

        const rect = (canvasElem.elt as HTMLCanvasElement).getBoundingClientRect()
        const pageX = rect.left + cx
        const pageY = rect.top + cy - 16

        inputUnc.position(pageX - w / 2, pageY - 18)
        ;(inputUnc.elt as HTMLInputElement).focus()
        ;(inputUnc.elt as HTMLInputElement).select()
      }

      function finishEditingUnc() {
        if (!editingUnc) return
        uncertaintyText = inputUnc.value() as string
        editingUnc = false
        inputUnc.hide()
      }

      function cancelEditingUnc() {
        editingUnc = false
        inputUnc.hide()
      }

      p.keyPressed = () => {
        const step = 2
        const minWidth = 10

        const center = (lowBoundary + highBoundary) / 2
        let half = (highBoundary - lowBoundary) / 2

        if (p.keyCode === p.RIGHT_ARROW) {
          const maxMove = 100 - highBoundary
          const move = Math.min(step, maxMove)
          lowBoundary += move
          highBoundary += move
        } else if (p.keyCode === p.LEFT_ARROW) {
          const maxMove = lowBoundary
          const move = Math.min(step, maxMove)
          lowBoundary -= move
          highBoundary -= move
        } else if (p.keyCode === p.DOWN_ARROW) {
          const desiredHalf = half + step / 2.0
          const maxHalf = Math.min(center, 100 - center)
          const newHalf = Math.min(desiredHalf, maxHalf)
          lowBoundary = center - newHalf
          highBoundary = center + newHalf
        } else if (p.keyCode === p.UP_ARROW) {
          const desiredHalf = half - step / 2.0
          const minHalf = minWidth / 2.0
          let newHalf = Math.max(desiredHalf, minHalf)
          const maxHalf = Math.min(center, 100 - center)
          newHalf = p.constrain(newHalf, minHalf, maxHalf)
          lowBoundary = center - newHalf
          highBoundary = center + newHalf
        }
      }

      p.mouseWheel = (event: WheelEvent) => {
        needleValue = p.constrain(needleValue - event.deltaY / 50, 0, 100)
        return false
      }
    },
  },
]
