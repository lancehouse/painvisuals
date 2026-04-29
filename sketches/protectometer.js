// Protectometer — v5
// Visual fixes vs v4:
//   • Canvas 25px wider each side (1000→1050) — all X positions adjusted
//   • Modern panelBg removed (was causing the blue box top-left)
//   • Menu icons larger (28→40) and moved above attribution text
//   • "On Alert" raised to same Y as "No Pain" / "Pain"
//   • Lorenz readout and Output readout spaced further apart
//   • circleSpacing auto-recalculates from new width — VU lights no longer clip edges

// ---------------------- TWEAKABLE SETTINGS ----------------------
const CANVAS_WIDTH  = 1050;
const CANVAS_HEIGHT = 680;

const NUM_CHANNELS = 5;

const NUM_CIRCLES  = 20;
const CIRCLE_DIAM  = 30;
const VU_Y         = 80;

const SLIDER_TRACK_TOP    = 200;
const SLIDER_TRACK_BOTTOM = 440;
const SLIDER_MIDPOINT     = 0.5;

const SLIDER_WIDTH         = 42;
const SLIDER_HEIGHT        = 20;
const SLIDER_CENTER_MARK   = 8;
const SLIDER_X_SPACING     = 140;

const KNOB_Y         = 560;
const BASE_START_DEG = 225;
const BASE_END_DEG   = 315;
const ROT            = Math.PI;
const KNOB_RADIUS    = 24;
const HANDLE_SIZE    = 8;
const CLICK_PAD      = KNOB_RADIUS + 4;

const SLIDER_LABEL_SIZE     = 20;
const BIG_LABEL_SIZE        = 36;
const HEADER_SIZE           = 40;
const SLIDER_LABEL_X_OFFSET = -(SLIDER_WIDTH / 2 + 2);

const VU_SENSITIVITY = 2.1;

// ---------------------- LORENZ SETTINGS ----------------------
const LORENZ_TO_VU_FACTOR  = 0.8;
const LORENZ_OUTPUT_OFFSET = 0.0;
let   SHOW_LORENZ_SCOPE    = true;

const LZ_OUTPUT_MIN   = -100;
const LZ_OUTPUT_MAX   =  100;
const LZ_OUTPUT_RANGE =   10;
const LZ_OUTPUT_SCALE =  0.4;

const lz_sigma = 10, lz_rho = 28, lz_beta = 8 / 3;
let lx = 0.1, ly = 1.0, lz_z = 1.05;
const lz_dt       = 0.005;
const LZ_NUM_POINTS = 800;
let lzWaveform = new Array(LZ_NUM_POINTS).fill(0);

const LZ_KNOB_RADIUS = KNOB_RADIUS;
const LZ_CLICK_PAD   = CLICK_PAD;
const LZ_SCOPE_W     = 120;
const LZ_SCOPE_H     = 75;

// =====================================================================
// THEME SYSTEM
// =====================================================================
const THEMES = {
  classic: {
    name: 'Classic',
    bg:              [238, 220, 48],
    trackColor:      [40, 28, 10],
    trackWeight:     7,
    midMarkColor:    [120, 90, 40],
    sliderFill:      [245, 238, 210],
    arcColor:        [60, 45, 20],
    knobFill:        [28, 20, 12],
    knobIndicator:   [240, 230, 190],
    tickColor:       [80, 60, 20],
    scopeBg:         null,
    scopeZeroLine:   [80, 160, 60],
    scopeTrace:      [60, 200, 80],
    vuOff:           [120, 100, 30],
    vuGreen:         [60, 230, 60],
    vuOrange:        [255, 155, 20],
    vuRed:           [240, 45, 45],
    labelColor:      [35, 22, 8],
    outputTextColor: [35, 22, 8],
    lorenzTextColor: [35, 22, 8],
    menuBg:          [210, 190, 60],
    menuBorder:      [140, 110, 30],
    menuText:        [35, 22, 8],
    menuHighlight:   [255, 248, 170],
    panelBg:         null,
  },
  modern: {
    name: 'Modern',
    bg:              [18, 22, 34],
    trackColor:      [80, 90, 120],
    trackWeight:     5,
    midMarkColor:    [60, 70, 100],
    sliderFill:      [99, 179, 237],
    arcColor:        [50, 60, 90],
    knobFill:        [38, 46, 68],
    knobIndicator:   [99, 179, 237],
    tickColor:       [80, 100, 140],
    scopeBg:         [26, 32, 50],
    scopeZeroLine:   [60, 200, 120],
    scopeTrace:      [80, 230, 140],
    vuOff:           [35, 42, 62],
    vuGreen:         [80, 220, 100],
    vuOrange:        [240, 160, 60],
    vuRed:           [240, 70, 70],
    labelColor:      [180, 195, 230],
    outputTextColor: [99, 179, 237],
    lorenzTextColor: [120, 200, 140],
    menuBg:          [30, 38, 58],
    menuBorder:      [60, 80, 120],
    menuText:        [180, 195, 230],
    menuHighlight:   [50, 65, 100],
    panelBg:         null,
  },
};

let currentTheme = 'classic';
let T = THEMES[currentTheme];

function setTheme(name) { currentTheme = name; T = THEMES[name]; }

// =====================================================================
// MENU LAYOUT
// =====================================================================
const MENU_ICON_SIZE  = 40;
const MENU_ICON_GAP   = 14;
const ICON_Y      = 614;
const ICON_APP_X  = 30;
const ICON_TEXT_X = ICON_APP_X + MENU_ICON_SIZE + MENU_ICON_GAP;

const DROP_W     = 148;
const DROP_H     = 36;
const DROP_X     = ICON_APP_X - 8;
const DROP_ITEMS = ['classic', 'modern'];

let menuAppOpen  = false;
let menuTextOpen = false;
let currentTextPreset = 'NOI Pain';

const TEXT_PRESETS = {
  'NOI Pain': {
    label: 'NOI Pain',
    values: ['No Pain', 'Pain', 'DIMS', 'SIMS',
             'Current Environment', 'Beliefs', 'Behaviours', 'Past Experiences', 'General Health']
  },
  'Pain': {
    label: 'Pain',
    values: ['No Pain', 'Pain', 'Danger events', 'Safety events',
             'Current Environment', 'Beliefs', 'Behaviours', 'Past Experiences', 'General Health']
  },
  'Anxiety': {
    label: 'Anxiety',
    values: ['Calm', 'Anxious', 'Scary events', 'Calming events',
             'Current Environment', 'Beliefs', 'Behaviours', 'Past Experiences', 'General Health']
  },
  'Fatigue': {
    label: 'Fatigue',
    values: ['Energy', 'Fatigue', 'Tiring events', 'Energising events',
             'Current Environment', 'Beliefs', 'Behaviours', 'Past Experiences', 'General Health']
  },
  'PTSD': {
    label: 'PTSD',
    values: ['Calm', 'Stressed', 'Danger events', 'Safety events',
             'Current Environment', 'Beliefs', 'Behaviours', 'Past Experiences', 'General Health']
  },
};

const PRESET_LABEL_INDICES = [0, 2, 3, 4, 5, 6, 7, 8, 9];

function applyTextPreset(key) {
  currentTextPreset = key;
  const vals = TEXT_PRESETS[key].values;
  for (let i = 0; i < PRESET_LABEL_INDICES.length; i++) {
    editableLabels[PRESET_LABEL_INDICES[i]].text = vals[i];
  }
}

// =====================================================================
// STATE
// =====================================================================
let sliders        = [];
let circleSpacing;
let editableLabels = [];
let lorenzKnob;
let activeTouches  = [];

let vuLightValues  = new Array(NUM_CIRCLES).fill(0);
let vuTargetValues = new Array(NUM_CIRCLES).fill(0);

// =====================================================================
// MATH HELPERS
// =====================================================================
function normalizeAngle(a) { a = a % TWO_PI; return a < 0 ? a + TWO_PI : a; }
function isInForbiddenArc(a, start, forbidden) {
  const d = (a - start + TWO_PI) % TWO_PI;
  return d > 1e-12 && d < forbidden - 1e-12;
}
function clampToAllowed(a, start, end, forbidden) {
  if (!isInForbiddenArc(a, start, forbidden)) return a;
  return Math.abs(a - start) <= Math.abs(a - end) ? start : end;
}
function percentToAngle(pct, start, forbidden, allowed) {
  return normalizeAngle(start + forbidden + pct * allowed);
}
function angleToPercent(a) {
  a = normalizeAngle(a);
  const baseStart = normalizeAngle(radians(BASE_START_DEG) + ROT);
  const baseEnd   = normalizeAngle(radians(BASE_END_DEG)   + ROT);
  const forbidden = (baseEnd - baseStart + TWO_PI) % TWO_PI;
  const allowed   = TWO_PI - forbidden;
  const d = (a - baseStart + TWO_PI) % TWO_PI;
  if (d < forbidden + 1e-12) return 0;
  return constrain(((d - forbidden) / allowed) * 100, 0, 100);
}

// =====================================================================
// SETUP
// =====================================================================
function setup() {
  createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  angleMode(RADIANS);
  textFont('Helvetica');

  const VU_MARGIN = 60;
  circleSpacing = (width - 2 * VU_MARGIN - CIRCLE_DIAM) / (NUM_CIRCLES - 1);
  window._vuStartX = VU_MARGIN + CIRCLE_DIAM / 2;

  const startX = (width - (NUM_CHANNELS - 1) * SLIDER_X_SPACING) / 2 + 50;

  const baseStart = normalizeAngle(radians(BASE_START_DEG) + ROT);
  const baseEnd   = normalizeAngle(radians(BASE_END_DEG)   + ROT);
  const forbidden = (baseEnd - baseStart + TWO_PI) % TWO_PI;
  const allowed   = TWO_PI - forbidden;

  const knobStartAngle = percentToAngle(0.50, baseStart, forbidden, allowed);
  const sliderStartY   = map(SLIDER_MIDPOINT, 0, 1, SLIDER_TRACK_BOTTOM, SLIDER_TRACK_TOP);

  for (let i = 0; i < NUM_CHANNELS; i++) {
    sliders.push({
      x: startX + i * SLIDER_X_SPACING,
      y: sliderStartY,
      knobAngle: knobStartAngle,
      START: baseStart, END: baseEnd, FORBIDDEN: forbidden, ALLOWED: allowed,
      draggingSlider: false, draggingKnob: false
    });
  }

  const lorenzX = startX - SLIDER_X_SPACING;
  const lorenzY = (SLIDER_TRACK_TOP + SLIDER_TRACK_BOTTOM) / 2;

  lorenzKnob = {
    x: lorenzX, y: lorenzY,
    angle: percentToAngle(0.0, baseStart, forbidden, allowed),
    START: baseStart, END: baseEnd, FORBIDDEN: forbidden, ALLOWED: allowed,
    dragging: false
  };

  const greenMidX = window._vuStartX + Math.floor((0 + 8) / 2) * circleSpacing;
  const redMidX   = window._vuStartX + Math.floor((11 + 19) / 2) * circleSpacing;

  editableLabels.push(new EditableLabel("No Pain",  greenMidX, VU_Y - 50, BIG_LABEL_SIZE, { center: true }));
  editableLabels.push(new EditableLabel("On Alert", width / 2, VU_Y - 50, 20, { center: true, locked: true }));
  editableLabels.push(new EditableLabel("Pain",     redMidX,   VU_Y - 50, BIG_LABEL_SIZE, { center: true }));
  editableLabels.push(new EditableLabel("DIMS",     width / 2, SLIDER_TRACK_TOP    - 50, HEADER_SIZE, { center: true }));
  editableLabels.push(new EditableLabel("SIMS",     width / 2, SLIDER_TRACK_BOTTOM + 50, HEADER_SIZE, { center: true }));

  const sliderNames = ["Current Environment", "Beliefs", "Behaviours", "Past Experiences", "General Health"];
  for (let i = 0; i < NUM_CHANNELS; i++) {
    editableLabels.push(new EditableLabel(
      sliderNames[i], sliders[i].x + SLIDER_LABEL_X_OFFSET, SLIDER_TRACK_BOTTOM,
      SLIDER_LABEL_SIZE, { vertical: true, alignBottom: true }
    ));
  }

  editableLabels.push(new EditableLabel("Sensitivity",     width / 2,    KNOB_Y + KNOB_RADIUS + 40,       20, { center: true, locked: true }));
  editableLabels.push(new EditableLabel("Uncertainty (u)", lorenzKnob.x, lorenzKnob.y - KNOB_RADIUS - 20, 18, { center: true, locked: true }));
  editableLabels.push(new EditableLabel(
    "Inspired and based on Moseley and Butler's Original Protectometer as Published by NOIGroup",
    245, KNOB_Y + KNOB_RADIUS + 70, 10, { center: true, locked: true }
  ));

  const cnv = document.querySelector('canvas');
  cnv.addEventListener('touchstart',  onTouchStart, { passive: false });
  cnv.addEventListener('touchmove',   onTouchMove,  { passive: false });
  cnv.addEventListener('touchend',    onTouchEnd,   { passive: false });
  cnv.addEventListener('touchcancel', onTouchEnd,   { passive: false });
}

// =====================================================================
// DRAW
// =====================================================================
function draw() {
  background(...T.bg);

  let avgValueFromChannels = sliders.reduce((sum, s) => {
    const sliderNorm = map(s.y, SLIDER_TRACK_BOTTOM, SLIDER_TRACK_TOP, 0, 1);
    const knobNorm   = angleToPercent(s.knobAngle) / 100;
    return sum + sliderNorm * knobNorm;
  }, 0) / NUM_CHANNELS * VU_SENSITIVITY;

  const dx = lz_sigma * (ly - lx)         * lz_dt;
  const dy = (lx * (lz_rho - lz_z) - ly) * lz_dt;
  const dz = (lx * ly - lz_beta * lz_z)  * lz_dt;
  lx += dx; ly += dy; lz_z += dz;

  const l_amp = angleToPercent(lorenzKnob.angle) / 100.0 * 0.8;
  lzWaveform.push(lx * l_amp);
  if (lzWaveform.length > LZ_NUM_POINTS) lzWaveform.shift();

  let rawLorenz = map(lx * l_amp, -LZ_OUTPUT_RANGE, LZ_OUTPUT_RANGE, LZ_OUTPUT_MIN, LZ_OUTPUT_MAX);
  rawLorenz = constrain(rawLorenz, LZ_OUTPUT_MIN, LZ_OUTPUT_MAX) * LZ_OUTPUT_SCALE;

  if (SHOW_LORENZ_SCOPE) {
    const scopeX = lorenzKnob.x - LZ_SCOPE_W / 2;
    const scopeY = lorenzKnob.y + KNOB_RADIUS + 10;
    if (T.scopeBg) {
      noStroke(); fill(...T.scopeBg);
      rect(scopeX - 6, scopeY - 4, LZ_SCOPE_W + 12, LZ_SCOPE_H + 8, 6);
    }
    push();
    translate(scopeX, scopeY);
    stroke(...T.scopeZeroLine); strokeWeight(1);
    line(0, LZ_SCOPE_H / 2, LZ_SCOPE_W, LZ_SCOPE_H / 2);
    noFill();
    stroke(...T.scopeTrace); strokeWeight(1.5);
    beginShape();
    for (let i = 0; i < lzWaveform.length; i++) {
      vertex(map(i, 0, LZ_NUM_POINTS - 1, 0, LZ_SCOPE_W), LZ_SCOPE_H / 2 - lzWaveform[i] * 10);
    }
    endShape();
    pop();
    noStroke(); fill(...T.lorenzTextColor);
    textAlign(CENTER, TOP); textSize(12);
    text("Lorenz: " + nf(rawLorenz, 1, 2), lorenzKnob.x, lorenzKnob.y + KNOB_RADIUS + 10 + LZ_SCOPE_H + 6);
  }

  drawKnob(lorenzKnob.x, lorenzKnob.y, lorenzKnob.angle, lorenzKnob.START, lorenzKnob.END);

  const lorenzCentered = (rawLorenz - LORENZ_OUTPUT_OFFSET) / (LZ_OUTPUT_MAX - LZ_OUTPUT_MIN);
  let combinedVU = constrain(avgValueFromChannels + lorenzCentered * LORENZ_TO_VU_FACTOR, 0, 1);
  const litThreshold = combinedVU * NUM_CIRCLES;

  for (let i = 0; i < NUM_CIRCLES; i++) {
    vuTargetValues[i] = i < litThreshold ? 255 : 0;
    vuLightValues[i] += (vuTargetValues[i] - vuLightValues[i]) * 0.05;
    const x = window._vuStartX + i * circleSpacing;
    const alpha = vuLightValues[i];
    let cOn;
    if (i < 9) cOn = T.vuGreen; else if (i < 11) cOn = T.vuOrange; else cOn = T.vuRed;

    noStroke(); fill(...T.vuOff); ellipse(x, VU_Y, CIRCLE_DIAM);

    if (currentTheme === 'modern') {
      if (alpha > 0) {
        fill(cOn[0], cOn[1], cOn[2], alpha * 0.18); ellipse(x, VU_Y, CIRCLE_DIAM + 10);
        fill(cOn[0], cOn[1], cOn[2], alpha * 0.35); ellipse(x, VU_Y, CIRCLE_DIAM + 4);
        fill(cOn[0], cOn[1], cOn[2], alpha);        ellipse(x, VU_Y, CIRCLE_DIAM);
        fill(255, 255, 255, alpha * 0.28);           ellipse(x - 4, VU_Y - 4, 7);
      }
    } else if (currentTheme === 'classic') {
      noStroke(); fill(55, 40, 12); ellipse(x, VU_Y, CIRCLE_DIAM + 4);
      fill(T.vuOff[0], T.vuOff[1], T.vuOff[2]); ellipse(x, VU_Y, CIRCLE_DIAM);
      if (alpha > 0) {
        fill(cOn[0], cOn[1], cOn[2], alpha * 0.12); ellipse(x, VU_Y, CIRCLE_DIAM + 18);
        fill(cOn[0], cOn[1], cOn[2], alpha * 0.25); ellipse(x, VU_Y, CIRCLE_DIAM + 10);
        fill(cOn[0], cOn[1], cOn[2], alpha * 0.50); ellipse(x, VU_Y, CIRCLE_DIAM + 4);
        fill(cOn[0], cOn[1], cOn[2], alpha);         ellipse(x, VU_Y, CIRCLE_DIAM);
        fill(255, 248, 220, alpha * 0.55);            ellipse(x - 4, VU_Y - 4, 7);
      }
    } else {
      for (let g = 1; g <= 3; g++) { fill(cOn[0], cOn[1], cOn[2], alpha / (g * 2)); ellipse(x, VU_Y, CIRCLE_DIAM + g * 6); }
      fill(cOn[0], cOn[1], cOn[2], alpha); ellipse(x, VU_Y, CIRCLE_DIAM);
    }
  }

  sliders.forEach(s => drawSliderAndKnob(s));

  noStroke(); fill(...T.outputTextColor);
  textSize(16); textAlign(CENTER, CENTER);
  text("Output: " + (combinedVU * 100).toFixed(1) + "%",
       lorenzKnob.x, lorenzKnob.y + KNOB_RADIUS + 10 + LZ_SCOPE_H + 38);

  editableLabels.forEach(lbl => lbl.display());
  drawMenuIcons();
  if (menuAppOpen)  drawAppearanceDropdown();
  if (menuTextOpen) drawTextDropdown();
}

// =====================================================================
// DRAW HELPERS
// =====================================================================
function drawSliderAndKnob(s) {
  const midY = (SLIDER_TRACK_TOP + SLIDER_TRACK_BOTTOM) / 2;
  stroke(...T.trackColor); strokeWeight(T.trackWeight);
  line(s.x, SLIDER_TRACK_TOP, s.x, SLIDER_TRACK_BOTTOM);

  const trackRange = (SLIDER_TRACK_BOTTOM - SLIDER_TRACK_TOP) / 2;
  const deviation  = (midY - s.y) / trackRange;
  let gr, gg, gb;
  const absD = abs(deviation);
  if (deviation >= 0) {
    const orange = T.vuOrange, red = T.vuRed;
    gr = lerp(orange[0], red[0], absD); gg = lerp(orange[1], red[1], absD); gb = lerp(orange[2], red[2], absD);
  } else {
    const orange = T.vuOrange, green = T.vuGreen;
    gr = lerp(orange[0], green[0], absD); gg = lerp(orange[1], green[1], absD); gb = lerp(orange[2], green[2], absD);
  }
  const glowAlpha = map(absD, 0, 1, 60, 220);
  const glowTop = min(midY, s.y), glowBot = max(midY, s.y);
  if (glowBot - glowTop > 2) {
    stroke(gr, gg, gb, glowAlpha * 0.30); strokeWeight(14); line(s.x, glowTop, s.x, glowBot);
    stroke(gr, gg, gb, glowAlpha * 0.55); strokeWeight(8);  line(s.x, glowTop, s.x, glowBot);
    stroke(gr, gg, gb, glowAlpha);        strokeWeight(3);  line(s.x, glowTop, s.x, glowBot);
  }
  stroke(...T.midMarkColor); strokeWeight(2);
  line(s.x - 20, midY, s.x + 20, midY);

  noStroke();
  if (currentTheme === 'modern') {
    fill(...T.sliderFill); rectMode(CENTER); rect(s.x, s.y, SLIDER_WIDTH, SLIDER_HEIGHT, SLIDER_HEIGHT / 2);
    fill(255, 255, 255, 40); rect(s.x, s.y - SLIDER_HEIGHT * 0.18, SLIDER_WIDTH - 6, SLIDER_HEIGHT * 0.45, SLIDER_HEIGHT / 2);
  } else if (currentTheme === 'classic') {
    fill(40, 28, 10, 80); rectMode(CENTER); rect(s.x + 2, s.y + 2, SLIDER_WIDTH, SLIDER_HEIGHT, 5);
    fill(...T.sliderFill); rect(s.x, s.y, SLIDER_WIDTH, SLIDER_HEIGHT, 5);
    fill(255, 255, 255, 70); rect(s.x, s.y - SLIDER_HEIGHT * 0.22, SLIDER_WIDTH - 4, SLIDER_HEIGHT * 0.38, 5);
    fill(180, 160, 120, 90); rect(s.x, s.y + SLIDER_HEIGHT * 0.22, SLIDER_WIDTH - 4, SLIDER_HEIGHT * 0.28, 3);
  } else {
    fill(...T.sliderFill); rectMode(CENTER); rect(s.x, s.y, SLIDER_WIDTH, SLIDER_HEIGHT, 6);
  }
  rectMode(CORNER);

  if (currentTheme === 'classic') {
    noFill(); strokeWeight(10); stroke(30, 20, 8);
    arc(s.x, KNOB_Y, KNOB_RADIUS * 2.3, KNOB_RADIUS * 2.3, s.END, s.START + TWO_PI);
    strokeWeight(4); stroke(200, 185, 140);
    arc(s.x, KNOB_Y, KNOB_RADIUS * 2.3, KNOB_RADIUS * 2.3, s.END, s.START + TWO_PI);
  } else {
    noFill(); strokeWeight(8); stroke(...T.arcColor);
    arc(s.x, KNOB_Y, KNOB_RADIUS * 2.2, KNOB_RADIUS * 2.2, s.END, s.START + TWO_PI);
  }
  drawKnobBody(s.x, KNOB_Y, s.knobAngle, s.START, s.END);
}

function drawKnob(cx, cy, angle, START, END) {
  if (currentTheme === 'classic') {
    noFill(); strokeWeight(10); stroke(30, 20, 8);
    arc(cx, cy, KNOB_RADIUS * 2.3, KNOB_RADIUS * 2.3, END, START + TWO_PI);
    strokeWeight(4); stroke(200, 185, 140);
    arc(cx, cy, KNOB_RADIUS * 2.3, KNOB_RADIUS * 2.3, END, START + TWO_PI);
  } else {
    noFill(); strokeWeight(8); stroke(...T.arcColor);
    arc(cx, cy, KNOB_RADIUS * 2.2, KNOB_RADIUS * 2.2, END, START + TWO_PI);
  }
  drawKnobBody(cx, cy, angle, START, END);
}

function drawKnobBody(cx, cy, angle, START, END) {
  noStroke();
  if (currentTheme === 'modern') {
    fill(50, 62, 90); circle(cx, cy, KNOB_RADIUS * 2 + 6);
    fill(...T.knobFill); circle(cx, cy, KNOB_RADIUS * 2);
    fill(255, 255, 255, 22); ellipse(cx - 4, cy - 5, KNOB_RADIUS * 0.9, KNOB_RADIUS * 0.6);
  } else if (currentTheme === 'classic') {
    fill(20, 12, 4, 120); circle(cx + 2, cy + 3, KNOB_RADIUS * 2 + 6);
    fill(175, 162, 128); circle(cx, cy, KNOB_RADIUS * 2 + 6);
    fill(80, 65, 40, 160); arc(cx, cy, KNOB_RADIUS * 2 + 6, KNOB_RADIUS * 2 + 6, PI * 0.2, PI * 1.2);
    fill(...T.knobFill); circle(cx, cy, KNOB_RADIUS * 2);
    fill(220, 200, 150, 55); ellipse(cx - KNOB_RADIUS * 0.35, cy - KNOB_RADIUS * 0.38, KNOB_RADIUS * 0.8, KNOB_RADIUS * 0.5);
    fill(240, 225, 180, 90); ellipse(cx - KNOB_RADIUS * 0.42, cy - KNOB_RADIUS * 0.44, KNOB_RADIUS * 0.28, KNOB_RADIUS * 0.18);
  } else {
    fill(...T.knobFill); circle(cx, cy, KNOB_RADIUS * 2);
  }

  const indWeight = currentTheme === 'classic' ? 3 : currentTheme === 'modern' ? 3 : 4;
  const tipSize   = currentTheme === 'classic' ? 6 : currentTheme === 'modern' ? 7 : HANDLE_SIZE;
  stroke(...T.knobIndicator); strokeWeight(indWeight);
  const ix = cx + KNOB_RADIUS * 0.78 * cos(angle);
  const iy = cy + KNOB_RADIUS * 0.78 * sin(angle);
  line(cx, cy, ix, iy);
  noStroke(); fill(...T.knobIndicator); circle(ix, iy, tipSize);
  drawTick(cx, cy, START, KNOB_RADIUS, 10);
  drawTick(cx, cy, END,   KNOB_RADIUS, 10);
}

// =====================================================================
// MENU DRAWING
// =====================================================================
const PREVIEW_W = 90, PREVIEW_H = 70, PREVIEW_GAP = 10, PREVIEW_LABEL_H = 20;

function drawMenuIcons() {
  const r = MENU_ICON_SIZE / 2;
  const ax = ICON_APP_X, ay = ICON_Y;
  const isHoverApp = dist(mouseX, mouseY, ax, ay) <= r + 6;
  noStroke();
  fill(menuAppOpen ? [...T.menuHighlight] : isHoverApp ? [...T.menuHighlight, 200] : [...T.menuBg]);
  rect(ax - r, ay - r, MENU_ICON_SIZE, MENU_ICON_SIZE, 8);
  const dc = [[210,70,70],[70,170,70],[70,110,210]];
  const dp = [[-6,4],[6,4],[0,-7]];
  for (let i = 0; i < 3; i++) { fill(...dc[i]); noStroke(); ellipse(ax + dp[i][0], ay + dp[i][1], 7, 7); }
  stroke(...T.menuText); strokeWeight(1.5); noFill();
  arc(ax + 7, ay + 7, 8, 8, PI, PI * 1.75);
  noStroke();
  fill(...T.menuText); textSize(10); textAlign(CENTER, TOP); text('LOOK', ax, ay + r + 3);

  const tx = ICON_TEXT_X, ty = ICON_Y;
  const isHoverText = dist(mouseX, mouseY, tx, ty) <= r + 6;
  noStroke();
  const mh2 = T.menuHighlight, mb3 = T.menuBg;
  fill(menuTextOpen ? mh2[0] : isHoverText ? mh2[0] : mb3[0],
       menuTextOpen ? mh2[1] : isHoverText ? mh2[1] : mb3[1],
       menuTextOpen ? mh2[2] : isHoverText ? mh2[2] : mb3[2]);
  rect(tx - r, ty - r, MENU_ICON_SIZE, MENU_ICON_SIZE, 8);
  stroke(...T.menuText); strokeWeight(2);
  line(tx - 8, ty - 6, tx + 8, ty - 6);
  line(tx - 8, ty,     tx + 8, ty);
  line(tx - 8, ty + 6, tx + 5, ty + 6);
  noStroke();
  fill(...T.menuText); textSize(10); textAlign(CENTER, TOP); text('TEXT', tx, ty + r + 3);
}

function drawAppearanceDropdown() {
  push(); rectMode(CORNER);
  const numCards = DROP_ITEMS.length;
  const panelW = numCards * PREVIEW_W + (numCards + 1) * PREVIEW_GAP;
  const panelH = PREVIEW_H + PREVIEW_LABEL_H + 16;
  const panelX = ICON_APP_X - 8;
  const panelY = ICON_Y - MENU_ICON_SIZE / 2 - panelH - 6;
  const mb = T.menuBg;
  noStroke(); fill(mb[0], mb[1], mb[2], 240); rect(panelX, panelY, panelW, panelH, 10);
  const mbr = T.menuBorder; stroke(mbr[0], mbr[1], mbr[2]); strokeWeight(1); noFill(); rect(panelX, panelY, panelW, panelH, 10); noStroke();

  for (let i = 0; i < numCards; i++) {
    const key = DROP_ITEMS[i], th = THEMES[key];
    const cardX = panelX + PREVIEW_GAP + i * (PREVIEW_W + PREVIEW_GAP);
    const cardY = panelY + 8;
    const isSel = currentTheme === key;
    const isHov = mouseX >= cardX && mouseX <= cardX + PREVIEW_W && mouseY >= cardY && mouseY <= cardY + PREVIEW_H + PREVIEW_LABEL_H;
    if (isSel) { const sf = th.sliderFill; stroke(sf[0], sf[1], sf[2]); strokeWeight(3); }
    else if (isHov) { const mb2 = T.menuBorder; stroke(mb2[0], mb2[1], mb2[2]); strokeWeight(1.5); }
    else { noStroke(); }
    fill(th.bg[0], th.bg[1], th.bg[2]); rect(cardX, cardY, PREVIEW_W, PREVIEW_H, 6); noStroke();
    const dotR = 3.5, dotSpacing = (PREVIEW_W - 8) / 7;
    for (let d = 0; d < 8; d++) {
      const dx = cardX + 4 + d * dotSpacing, dy = cardY + 11;
      let col; if (d < 4) col = th.vuGreen; else if (d < 6) col = th.vuOrange; else col = th.vuRed;
      const c = d < 5 ? col : th.vuOff; fill(c[0], c[1], c[2]); ellipse(dx, dy, dotR * 2, dotR * 2);
    }
    const sTrackX = cardX + PREVIEW_W * 0.72, sTop = cardY + 20, sBot = cardY + PREVIEW_H - 8;
    const tc = th.trackColor; stroke(tc[0], tc[1], tc[2]); strokeWeight(2); line(sTrackX, sTop, sTrackX, sBot); noStroke();
    const sc = th.sliderFill; fill(sc[0], sc[1], sc[2]); rectMode(CORNER); rect(sTrackX - 6, lerp(sTop, sBot, 0.4) - 5, 12, 10, 4);
    const kx = cardX + PREVIEW_W * 0.32, ky = cardY + PREVIEW_H * 0.65, kr = 9;
    const kf = th.knobFill; noStroke(); fill(kf[0], kf[1], kf[2]); circle(kx, ky, kr * 2);
    const ki = th.knobIndicator; stroke(ki[0], ki[1], ki[2]); strokeWeight(1.5); line(kx, ky, kx + kr * 0.7 * cos(-0.9), ky + kr * 0.7 * sin(-0.9)); noStroke();
    const mt = isSel ? th.sliderFill : T.menuText; fill(mt[0], mt[1], mt[2]); textSize(11); textAlign(CENTER, TOP); text(th.name, cardX + PREVIEW_W / 2, cardY + PREVIEW_H + 3);
    if (isSel) { fill(255, 255, 255, 200); textSize(12); textAlign(RIGHT, TOP); text('✓', cardX + PREVIEW_W - 3, cardY + 3); }
  }
  pop();
}

function drawTextDropdown() {
  push(); rectMode(CORNER);
  const presetKeys = Object.keys(TEXT_PRESETS), numCards = presetKeys.length;
  const panelW = numCards * PREVIEW_W + (numCards + 1) * PREVIEW_GAP;
  const panelH = PREVIEW_H + PREVIEW_LABEL_H + 16;
  const panelX = ICON_TEXT_X - MENU_ICON_SIZE / 2 - 8;
  const panelY = ICON_Y - MENU_ICON_SIZE / 2 - panelH - 6;
  const mb = T.menuBg; noStroke(); fill(mb[0], mb[1], mb[2], 240); rect(panelX, panelY, panelW, panelH, 10);
  const mbr = T.menuBorder; stroke(mbr[0], mbr[1], mbr[2]); strokeWeight(1); noFill(); rect(panelX, panelY, panelW, panelH, 10); noStroke();

  for (let i = 0; i < numCards; i++) {
    const key = presetKeys[i], pdata = TEXT_PRESETS[key];
    const cardX = panelX + PREVIEW_GAP + i * (PREVIEW_W + PREVIEW_GAP), cardY = panelY + 8;
    const isSel = currentTextPreset === key;
    const isHov = mouseX >= cardX && mouseX <= cardX + PREVIEW_W && mouseY >= cardY && mouseY <= cardY + PREVIEW_H + PREVIEW_LABEL_H;
    if (isSel) { const sf = T.sliderFill; stroke(sf[0], sf[1], sf[2]); strokeWeight(3); }
    else if (isHov) { const mbr2 = T.menuBorder; stroke(mbr2[0], mbr2[1], mbr2[2]); strokeWeight(1.5); }
    else { noStroke(); }
    const bg = T.bg; fill(bg[0], bg[1], bg[2]); rect(cardX, cardY, PREVIEW_W, PREVIEW_H, 6); noStroke();
    fill(T.vuGreen[0], T.vuGreen[1], T.vuGreen[2]); textSize(10); textAlign(LEFT, TOP); text(pdata.values[0], cardX + 5, cardY + 6);
    fill(T.vuRed[0], T.vuRed[1], T.vuRed[2]); textAlign(RIGHT, TOP); text(pdata.values[1], cardX + PREVIEW_W - 5, cardY + 6);
    const mt = T.menuText; fill(mt[0], mt[1], mt[2]); textSize(9); textAlign(CENTER, TOP);
    text(pdata.values[2], cardX + PREVIEW_W / 2, cardY + 22);
    text(pdata.values[3], cardX + PREVIEW_W / 2, cardY + 34);
    const mc = T.midMarkColor; stroke(mc[0], mc[1], mc[2]); strokeWeight(1); line(cardX + 4, cardY + 46, cardX + PREVIEW_W - 4, cardY + 46); noStroke();
    fill(mt[0], mt[1], mt[2]); textSize(8); textAlign(LEFT, TOP);
    text(pdata.values[4], cardX + 5, cardY + 50);
    text(pdata.values[5], cardX + 5, cardY + 60);
    const labelCol = isSel ? T.sliderFill : T.menuText; fill(labelCol[0], labelCol[1], labelCol[2]); textSize(11); textAlign(CENTER, TOP); text(pdata.label, cardX + PREVIEW_W / 2, cardY + PREVIEW_H + 3);
    if (isSel) { fill(255, 255, 255, 200); textSize(12); textAlign(RIGHT, TOP); text('✓', cardX + PREVIEW_W - 3, cardY + 3); }
  }
  pop();
}

// =====================================================================
// POINTER HELPERS
// =====================================================================
function applyPointerToKnob(s, px, py, cy) {
  const a = normalizeAngle(atan2(py - cy, px - s.x));
  s.knobAngle = clampToAllowed(a, s.START, s.END, s.FORBIDDEN);
}
function applyPointerToLorenz(px, py) {
  const a = normalizeAngle(atan2(py - lorenzKnob.y, px - lorenzKnob.x));
  lorenzKnob.angle = clampToAllowed(a, lorenzKnob.START, lorenzKnob.END, lorenzKnob.FORBIDDEN);
}
function applyPointerToSlider(s, py) { s.y = constrain(py, SLIDER_TRACK_TOP, SLIDER_TRACK_BOTTOM); }

function findHitTarget(px, py) {
  if (dist(px, py, lorenzKnob.x, lorenzKnob.y) <= LZ_KNOB_RADIUS + LZ_CLICK_PAD) return { type: 'lorenz' };
  for (let s of sliders) {
    if (dist(px, py, s.x, KNOB_Y) <= KNOB_RADIUS + CLICK_PAD) return { type: 'knob', slider: s };
    if (px > s.x - SLIDER_WIDTH / 2 && px < s.x + SLIDER_WIDTH / 2 && py > SLIDER_TRACK_TOP && py < SLIDER_TRACK_BOTTOM) return { type: 'slider', slider: s };
  }
  return null;
}

function applyHit(hit, px, py) {
  if      (hit.type === 'lorenz') applyPointerToLorenz(px, py);
  else if (hit.type === 'knob')   applyPointerToKnob(hit.slider, px, py, KNOB_Y);
  else if (hit.type === 'slider') applyPointerToSlider(hit.slider, py);
}

function handlePointerDown(px, py) {
  const hit = findHitTarget(px, py);
  if (!hit) return;
  applyHit(hit, px, py);
  if      (hit.type === 'lorenz') lorenzKnob.dragging       = true;
  else if (hit.type === 'knob')   hit.slider.draggingKnob   = true;
  else if (hit.type === 'slider') hit.slider.draggingSlider = true;
}

function handlePointerMove(px, py) {
  if (lorenzKnob.dragging) applyPointerToLorenz(px, py);
  sliders.forEach(s => {
    if (s.draggingKnob)   applyPointerToKnob(s, px, py, KNOB_Y);
    if (s.draggingSlider) applyPointerToSlider(s, py);
  });
}

// =====================================================================
// MOUSE EVENTS
// =====================================================================
function mousePressed() {
  if (menuAppOpen) {
    const panelH1 = PREVIEW_H + PREVIEW_LABEL_H + 16, panelX1 = ICON_APP_X - 8;
    const panelY1 = ICON_Y - MENU_ICON_SIZE / 2 - panelH1 - 6;
    for (let i = 0; i < DROP_ITEMS.length; i++) {
      const cardX = panelX1 + PREVIEW_GAP + i * (PREVIEW_W + PREVIEW_GAP), cardY = panelY1 + 8;
      if (mouseX >= cardX && mouseX <= cardX + PREVIEW_W && mouseY >= cardY && mouseY <= cardY + PREVIEW_H + PREVIEW_LABEL_H) {
        setTheme(DROP_ITEMS[i]); menuAppOpen = false; return;
      }
    }
    menuAppOpen = false; return;
  }
  if (menuTextOpen) {
    const presetKeys = Object.keys(TEXT_PRESETS);
    const panelX2 = ICON_TEXT_X - MENU_ICON_SIZE / 2 - 8, panelH2 = PREVIEW_H + PREVIEW_LABEL_H + 16;
    const panelY2 = ICON_Y - MENU_ICON_SIZE / 2 - panelH2 - 6;
    for (let i = 0; i < presetKeys.length; i++) {
      const cardX = panelX2 + PREVIEW_GAP + i * (PREVIEW_W + PREVIEW_GAP), cardY = panelY2 + 8;
      if (mouseX >= cardX && mouseX <= cardX + PREVIEW_W && mouseY >= cardY && mouseY <= cardY + PREVIEW_H + PREVIEW_LABEL_H) {
        applyTextPreset(presetKeys[i]); menuTextOpen = false; return;
      }
    }
    menuTextOpen = false; return;
  }
  if (dist(mouseX, mouseY, ICON_APP_X, ICON_Y) < MENU_ICON_SIZE / 2 + 6) { menuAppOpen = !menuAppOpen; menuTextOpen = false; return; }
  if (dist(mouseX, mouseY, ICON_TEXT_X, ICON_Y) < MENU_ICON_SIZE / 2 + 6) { menuTextOpen = !menuTextOpen; menuAppOpen = false; return; }
  for (let lbl of editableLabels) {
    if (lbl.isOver(mouseX, mouseY) && !lbl.locked) { lbl.startEditing(); editableLabels.forEach(o => { if (o !== lbl) o.stopEditing(); }); return; }
    else { lbl.stopEditing(); }
  }
  handlePointerDown(mouseX, mouseY);
}

function mouseReleased() { sliders.forEach(s => s.draggingSlider = s.draggingKnob = false); lorenzKnob.dragging = false; }
function mouseDragged() { handlePointerMove(mouseX, mouseY); }

function mouseWheel(event) {
  const knobStep = event.deltaY > 0 ? -0.015 : 0.015;
  const sliderStep = event.deltaY > 0 ? 10 : -10;
  let handled = false;
  for (let s of sliders) {
    if (dist(mouseX, mouseY, s.x, KNOB_Y) <= KNOB_RADIUS + CLICK_PAD) {
      const pct = angleToPercent(s.knobAngle) / 100 + knobStep;
      s.knobAngle = percentToAngle(constrain(pct, 0, 1), s.START, s.FORBIDDEN, s.ALLOWED);
      handled = true; break;
    }
    if (mouseX > s.x - SLIDER_WIDTH / 2 && mouseX < s.x + SLIDER_WIDTH / 2 && mouseY > SLIDER_TRACK_TOP && mouseY < SLIDER_TRACK_BOTTOM) {
      s.y = constrain(s.y + sliderStep, SLIDER_TRACK_TOP, SLIDER_TRACK_BOTTOM); handled = true; break;
    }
  }
  if (!handled && dist(mouseX, mouseY, lorenzKnob.x, lorenzKnob.y) <= LZ_KNOB_RADIUS + LZ_CLICK_PAD) {
    const pct = angleToPercent(lorenzKnob.angle) / 100 + knobStep;
    lorenzKnob.angle = percentToAngle(constrain(pct, 0, 1), lorenzKnob.START, lorenzKnob.FORBIDDEN, lorenzKnob.ALLOWED);
    handled = true;
  }
  if (handled) return false;
}

// =====================================================================
// TOUCH EVENTS
// =====================================================================
function touchCanvasPos(touch) {
  const cnv = document.querySelector('canvas'), rect = cnv.getBoundingClientRect();
  const scaleX = width / rect.width, scaleY = height / rect.height;
  return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
}
function onTouchStart(e) {
  e.preventDefault();
  for (const t of e.changedTouches) { const {x,y} = touchCanvasPos(t); const hit = findHitTarget(x,y); if (hit) { applyHit(hit,x,y); activeTouches.push({id:t.identifier,hit}); } }
}
function onTouchMove(e) {
  e.preventDefault();
  for (const t of e.changedTouches) { const rec = activeTouches.find(r=>r.id===t.identifier); if (rec) { const {x,y} = touchCanvasPos(t); applyHit(rec.hit,x,y); } }
}
function onTouchEnd(e) { e.preventDefault(); for (const t of e.changedTouches) { activeTouches = activeTouches.filter(r=>r.id!==t.identifier); } }

// =====================================================================
// KEY HANDLING
// =====================================================================
function keyTyped() { for (let lbl of editableLabels) { if (lbl.editing && !lbl.locked && key.length === 1) lbl.appendChar(key); } }
function keyPressed() {
  if (key === 'u' || key === 'U') SHOW_LORENZ_SCOPE = !SHOW_LORENZ_SCOPE;
  for (let lbl of editableLabels) {
    if (!lbl.editing) continue;
    if (keyCode === BACKSPACE) { lbl.backspace(); return false; }
    if (keyCode === ENTER || keyCode === RETURN) lbl.stopEditing();
  }
}

// =====================================================================
// UTILS
// =====================================================================
function drawTick(cx, cy, ang, radius, len) {
  stroke(...T.tickColor); strokeWeight(3);
  const x1 = cx + radius * 0.88 * cos(ang), y1 = cy + radius * 0.88 * sin(ang);
  const x2 = cx + (radius * 0.88 + len) * cos(ang), y2 = cy + (radius * 0.88 + len) * sin(ang);
  line(x1, y1, x2, y2); noStroke();
}

// =====================================================================
// EDITABLE LABEL CLASS
// =====================================================================
class EditableLabel {
  constructor(text, x, y, size = 16, options = {}) {
    this.text = text; this.x = x; this.y = y; this.size = size;
    this.center = !!options.center; this.locked = !!options.locked;
    this.vertical = !!options.vertical; this.alignBottom = !!options.alignBottom;
    this.editing = false;
  }
  display() {
    fill(...T.labelColor); noStroke(); textSize(this.size);
    const t = this.text + (this.editing ? "|" : "");
    if (this.vertical) { push(); translate(this.x, this.y); rotate(-HALF_PI); textAlign(LEFT, BOTTOM); text(t, 0, 0); pop(); }
    else if (this.center) { textAlign(CENTER, CENTER); text(t, this.x, this.y); }
    else if (this.alignBottom) { textAlign(LEFT, BOTTOM); text(t, this.x, this.y); }
    else { textAlign(LEFT, CENTER); text(t, this.x, this.y); }
  }
  isOver(mx, my) {
    if (this.locked) return false;
    textSize(this.size);
    const w = textWidth(this.text) + 10, h = this.size + 8;
    if (this.vertical) return mx > this.x - h && mx < this.x && my > this.y - w && my < this.y;
    else if (this.center) return mx > this.x - w/2 && mx < this.x + w/2 && my > this.y - h/2 && my < this.y + h/2;
    else if (this.alignBottom) return mx > this.x && mx < this.x + w && my > this.y - h && my < this.y;
    else return mx > this.x && mx < this.x + w && my > this.y - h/2 && my < this.y + h/2;
  }
  startEditing() { if (!this.locked) this.editing = true; }
  stopEditing()  { this.editing = false; }
  appendChar(c)  { if (!this.locked) this.text += c; }
  backspace()    { if (!this.locked) this.text = this.text.slice(0, -1); }
}
