// Pain Network — Clinical Network Analysis Tool
// Built iteratively with Claude
//
// ARCHITECTURE OVERVIEW
// ─────────────────────
// This is a single-file p5.js sketch for OpenProcessing.
// It is organised into these logical sections (search for ─── to navigate):
//
//   GLOBALS        — all state variables declared here for visibility
//   PRESETS        — built-in network definitions (nodes + edges)
//   SETUP          — p5 setup(), builds UI elements
//   MENU UI        — Networks dropdown (presets, save, load, export)
//   LOCAL STORAGE  — synchronous save/load helpers (localStorage)
//   MENU PANEL     — rebuilds the Networks dropdown content
//   ANALYSE UI     — Analyse dropdown (belief mode toggle, reset)
//   SERIALISE/LOAD — save/load network to/from JSON
//   PHASES         — guided node-creation prompts at bottom of screen
//   FACTORIES      — makeNode(), makeEdge()
//   SCROLL         — mouse wheel handler (resize nodes, thickness, zoom)
//   ARROW DRAWING  — drawArrow(), drawArrowHead(), bezier curves
//   DELETE NODE    — removes node and all connected edges
//   EDIT MENU      — node double-click popup (rename, colour, links, add child)
//   DRAW           — main p5 draw() loop
//   HELPERS        — geometry, text, hit-testing utilities
//   MOUSE          — mousePressed/Dragged/Released handlers
//   KEYBOARD       — keyPressed handler (belief input)
//   PROPAGATION    — iterative belief propagation algorithm
//   PARTICLES      — animated belief particles along edges

// ─── GLOBALS ─────────────────────────────────────────────────────────────────

// Core network data — arrays of node and edge objects.
// Node shape: { id, label, x, y, col, r, fontSize, group, shape, rw, rh, belief, displayBelief }
// Edge shape: { id, from, to, thickness, linkState, direction, curve }
let nodes = [];
let edges = [];

// ── Interaction state ─────────────────────────────────────────────────────────
let dragging      = null;   // node currently being dragged
let dragMoved     = false;  // did the mouse move during this press?
let pressedNode   = null;   // node pressed (before we know if it's a click or drag)
let lastClickTime = 0;      // timestamp of last click (for double-click detection)
let lastClickNode = null;   // node last clicked
const DBL_CLICK_MS = 300;   // max ms between clicks to count as double-click

let hoveredNode = null;     // node under mouse this frame (world coords)
let hoveredEdge = null;     // edge under mouse this frame

// ── Node creation prompt state ────────────────────────────────────────────────
// phase 0: asking "How did your pain begin?" → creates origin + Pain nodes
// phase 1: asking "What does this affect?" → creates affect nodes off Pain
let phase = 0;
let inputBox, submitBtn, promptLabel, hintLabel;  // bottom-bar DOM elements
let originNode = null;  // reference to the first node created (cause/trigger)
let painNode   = null;  // reference to the central Pain hub node

// ── Node menu (edit popup) ────────────────────────────────────────────────────
let popup       = null;   // the floating node-edit menu DOM element
let popupSource = null;   // the node the menu is currently open for

// ── Networks menu ─────────────────────────────────────────────────────────────
let menuBtn, menuPanel;
let menuOpen  = false;
let nodeShape = "circle"; // default shape for newly created nodes ("circle"|"rect")

// ── Pan / zoom ────────────────────────────────────────────────────────────────
// All node x/y are in world coordinates. The canvas applies translate+scale
// each frame to map world → screen. screenToWorld() inverts this.
let viewX = 0, viewY = 0, viewScale = 1;
let isPanning        = false;  // true while dragging empty canvas to pan
let panStartX        = 0, panStartY = 0;
let draggingEdge     = null;   // edge being curve-dragged (click+drag on a line)
let edgeDragStartCurve = 0;    // edge.curve value at the moment drag started
let edgeDragStartY   = 0;      // perpendicular offset of mouse at drag start

// ── Analyse mode ──────────────────────────────────────────────────────────────
// When analyseMode is true, nodes display belief colours and the pain dial.
// Belief values (0-1) live on each node as n.belief (target) and
// n.displayBelief (animated, used for rendering).
let analyseMode      = false;
let showDebug        = false;  // show propagation debug overlay on canvas
let analyseBtn, analysePanel;
let debugLines = [];                 // strings drawn on canvas when showDebug is on
let analysePanelOpen = false;

// Keyboard signal strengths for belief input (fraction of 0-1 scale per keypress)
const SIG = { low: 0.10, med: 0.20, high: 0.35 };

// Brief visual flash on a node when a belief signal is applied
// { nodeId, frames (countdown), direction ("facilitate"|"inhibit"), strength }
let inputFlash = null;

// Belief animation: displayBelief lerps toward belief each frame
const BELIEF_LERP  = 0.11;   // fraction per frame (0.11 ≈ reaches target in ~30 frames)

// Particle travel speed is a constant PIXELS-per-frame rate, not a fixed
// fraction-of-edge-length-per-frame — otherwise a longer edge's dot visibly
// outruns a shorter edge's dot even though both take the same frame count.
// (80% of the original ~6px/frame speed, per request.)
const PARTICLE_PX_PER_FRAME = 4.8;
let particles = [];           // active particles: { edgeId, forward, t, col, width }

// Cascade scheduling — lets a single keypress animate the FULL sequential
// flow of a signal through the network (hop 1, then hop 2, then hop 3...)
// instead of only showing the first hop out of the node you pressed.
// { frame: frameCount at which to fire, nodeId: node to spawn outward from }
let pendingSpawns    = [];
const WAVE_GAP_FRAMES = 25; // frames between a node lighting up and its neighbours following
                             // (scaled alongside PARTICLE_PX_PER_FRAME, to keep the
                             // relay timing matched to how long a hop actually takes)

// Propagation algorithm tuning constants (see propagateBelief for full explanation)
const PROP_ITERATIONS  = 20;    // max passes to run per keypress; stops early once stable (see CONVERGE_EPS)
const LOOP_DAMPING     = 0.85;  // applied once to all edge weights to prevent feedback loop inflation
                                 // e.g. thickness=5, maxT=5 → raw w=1.0 → damped w=0.85
const RELAX_ALPHA      = 0.35;  // fraction of the way each node moves toward its target belief per pass
                                 // (< 1 so oscillating/cyclic subnetworks damp toward equilibrium instead of overshooting)
const CONVERGE_EPS     = 0.002; // if every node's per-pass change drops below this, propagation has settled

// Set by propagateBelief() after each run — read by the debug overlay and (later) the UI.
let lastPropIterations = 0;     // how many passes actually ran before stopping
let lastPropConverged  = true;  // false if PROP_ITERATIONS was exhausted without settling (oscillation/slow drift)

// How many hops (nodes away) a single keypress is allowed to reach — both in
// the actual belief update and in the particle animation. Infinity = no cap.
// Adjustable from the Analyse panel's "Propagation depth" slider.
let maxPropagationHops = Infinity;

const LINK_COLORS = {
  facilitate: { r: 240, g: 60,  b: 60  },
  inhibit:    { r: 0,   g: 220, b: 220 },
};
// Preset node colours available in the node menu
const PALETTE = [
  { label:"Red",    r:210, g:55,  b:55  },
  { label:"Orange", r:220, g:120, b:30  },
  { label:"Green",  r:45,  g:155, b:80  },
  { label:"Teal",   r:30,  g:160, b:155 },
  { label:"Blue",   r:60,  g:110, b:200 },
];

const NODE_COLORS = {
  origin: [230, 130, 30],
  pain:   [210, 45,  45],
  affect: [90,  140, 210],
};
const DIR_GLYPHS = { to: "→", from: "←", both: "↔" };
const DIR_CYCLE  = { to: "from", from: "both", both: "to" };

// ─── BUILT-IN PRESETS ────────────────────────────────────────────────────────
// Each preset is a plain object matching the serialised network format.
// Positions are expressed as fractions (0–1) of canvas size so they scale.

const PRESETS = [
  {
    name: "Basic Pain",
    shape: "circle",
    nodes: [
      { id:0, label:"Sleep",              x:0.371, y:0.131, group:"origin", r:36, rw:80,  rh:50, fontSize:22, paletteName:"Blue" },
      { id:1, label:"Pain",               x:0.482, y:0.469, group:"pain",   r:36, rw:80,  rh:51, fontSize:24 },
      { id:2, label:"Activity",           x:0.602, y:0.136, group:"affect", r:42, rw:93,  rh:50, fontSize:22, paletteName:"Blue" },
      { id:3, label:"Moods and Thoughts", x:0.606, y:0.842, group:"affect", r:95, rw:210, rh:50, fontSize:22 },
      { id:4, label:"Relationships",      x:0.367, y:0.825, group:"affect", r:66, rw:146, rh:50, fontSize:22 },
    ],
    edges: [
      { id:0, from:0, to:1, thickness:5, linkState:"facilitate", direction:"both", curve:0.000 },
      { id:1, from:2, to:1, thickness:5, linkState:"facilitate", direction:"both", curve:0.000 },
      { id:2, from:3, to:1, thickness:5, linkState:"facilitate", direction:"to",   curve:0.000 },
      { id:3, from:4, to:1, thickness:5, linkState:"facilitate", direction:"both", curve:0.000 },
      { id:4, from:2, to:0, thickness:5, linkState:"facilitate", direction:"both", curve:0.602 },
      { id:5, from:2, to:3, thickness:5, linkState:"facilitate", direction:"both", curve:-0.685 },
      { id:6, from:2, to:4, thickness:5, linkState:"facilitate", direction:"both", curve:1.261 },
      { id:7, from:0, to:3, thickness:5, linkState:"facilitate", direction:"both", curve:-1.131 },
      { id:8, from:0, to:4, thickness:5, linkState:"facilitate", direction:"both", curve:0.949 },
      { id:9, from:4, to:3, thickness:5, linkState:"facilitate", direction:"both", curve:0.704 },
    ],
  },
  {
    name: "Non-nociplastic",
    shape: "rect",
    nodes: [
      { id:0, label:"Injury",                               x:0.500, y:0.970, group:"origin", rw:93,  rh:54, fontSize:24 },
      { id:1, label:"Pain and poor recovery",               x:0.500, y:0.643, group:"pain",   rw:188, rh:87, fontSize:24 },
      { id:2, label:"Reduced strength/capacity",            x:0.503, y:0.188, group:"affect", rw:227, rh:87, fontSize:24 },
      { id:3, label:"Poor pacing and flare ups",            x:0.829, y:0.185, group:"affect", rw:216, rh:87, fontSize:24 },
      { id:4, label:"Inflammation and poor management",     x:0.832, y:0.637, group:"affect", rw:265, rh:82, fontSize:22 },
      { id:5, label:"Avoiding social and physical activity",x:0.201, y:0.180, group:"affect", rw:235, rh:82, fontSize:22 },
      { id:6, label:"Worsening mental health",              x:0.203, y:0.642, group:"affect", rw:236, rh:87, fontSize:24 },
    ],
    edges: [
      { id:0, from:0, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:1, from:1, to:2, thickness:5, linkState:"facilitate", direction:"both" },
      { id:2, from:2, to:3, thickness:5, linkState:"facilitate", direction:"both" },
      { id:3, from:3, to:4, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:4, from:4, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:5, from:2, to:5, thickness:5, linkState:"facilitate", direction:"both" },
      { id:6, from:5, to:6, thickness:5, linkState:"facilitate", direction:"to"   },
    ],
  },
  {
    name: "Non-nociplastic with mood issues",
    shape: "rect",
    nodes: [
      { id:0, label:"Injury",                               x:0.500, y:0.970, group:"origin", rw:93,  rh:54, fontSize:24 },
      { id:1, label:"Pain and poor recovery",               x:0.500, y:0.643, group:"pain",   rw:188, rh:87, fontSize:24 },
      { id:2, label:"Reduced strength/capacity",            x:0.495, y:0.195, group:"affect", rw:227, rh:87, fontSize:24 },
      { id:3, label:"Poor pacing and flare ups",            x:0.812, y:0.185, group:"affect", rw:216, rh:87, fontSize:24 },
      { id:4, label:"Inflammation and poor management",     x:0.816, y:0.651, group:"affect", rw:265, rh:82, fontSize:22 },
      { id:5, label:"Avoiding social and physical activity",x:0.215, y:0.190, group:"affect", rw:235, rh:82, fontSize:22 },
      { id:6, label:"Worsening mental health",              x:0.216, y:0.646, group:"affect", rw:236, rh:87, fontSize:24 },
    ],
    edges: [
      { id:0, from:0, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:1, from:1, to:2, thickness:5, linkState:"facilitate", direction:"both" },
      { id:2, from:2, to:3, thickness:5, linkState:"facilitate", direction:"both" },
      { id:3, from:3, to:4, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:4, from:4, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:5, from:2, to:5, thickness:5, linkState:"facilitate", direction:"both" },
      { id:6, from:1, to:6, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:7, from:6, to:5, thickness:5, linkState:"facilitate", direction:"to"   },
    ],
  },
  {
    name: "Nociplastic without reduced descending inhibition",
    shape: "rect",
    nodes: [
      { id:0, label:"Injury",                               x:0.500, y:0.970, group:"origin", rw:93,  rh:54, fontSize:24 },
      { id:1, label:"Prolonged recovery",                   x:0.500, y:0.643, group:"pain",   rw:188, rh:87, fontSize:24 },
      { id:2, label:"Increased pain sensitivity",           x:0.495, y:0.195, group:"affect", rw:227, rh:87, fontSize:24 },
      { id:3, label:"Poor pacing and flare ups",            x:0.812, y:0.185, group:"affect", rw:216, rh:87, fontSize:24 },
      { id:4, label:"Inflammation and poor management",     x:0.816, y:0.651, group:"affect", rw:265, rh:82, fontSize:22 },
      { id:5, label:"Avoiding social and physical activity",x:0.215, y:0.190, group:"affect", rw:235, rh:82, fontSize:22 },
      { id:6, label:"Worsening mental health",              x:0.216, y:0.646, group:"affect", rw:236, rh:87, fontSize:24 },
    ],
    edges: [
      { id:0, from:0, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:1, from:1, to:2, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:2, from:2, to:5, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:3, from:3, to:2, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:4, from:5, to:3, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:5, from:5, to:6, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:6, from:4, to:2, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:7, from:4, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
    ],
  },
  {
    name: "Nociplastic without reduced descending inhibition - recovery",
    shape: "rect",
    nodes: [
      { id:0, label:"Injury",                                      x:0.506, y:0.970, group:"origin", rw:93,  rh:54, fontSize:24 },
      { id:1, label:"Prolonged recovery",                          x:0.507, y:0.709, group:"pain",   rw:253, rh:54, fontSize:24 },
      { id:2, label:"Increased pain sensitivity",                  x:0.506, y:0.412, group:"affect", rw:196, rh:87, fontSize:24 },
      { id:3, label:"Increasing social and physical activity",     x:0.181, y:0.428, group:"affect", rw:252, rh:82, fontSize:22 },
      { id:4, label:"Improving mental health",                     x:0.175, y:0.889, group:"affect", rw:228, rh:87, fontSize:24 },
      { id:5, label:"Increased strength/capacity",                 x:0.506, y:0.020, group:"affect", rw:227, rh:87, fontSize:24 },
      { id:6, label:"Reduced pain sensitivity",                    x:0.784, y:0.013, group:"affect", rw:185, rh:87, fontSize:24 },
      { id:7, label:"Improved quality of life +/- pain experience",x:0.785, y:0.471, group:"affect", rw:258, rh:79, fontSize:21 },
    ],
    edges: [
      { id:0, from:0, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:1, from:1, to:2, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:2, from:2, to:3, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:3, from:3, to:4, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:4, from:3, to:5, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:5, from:5, to:6, thickness:5, linkState:"facilitate", direction:"both" },
      { id:6, from:6, to:7, thickness:5, linkState:"facilitate", direction:"to"   },
    ],
  },
  {
    name: "Nociplastic with reduced descending inhibition (without contributing factors)",
    shape: "rect",
    nodes: [
      { id:0, label:"Injury",                               x:0.831, y:0.896, group:"origin", rw:93,  rh:54, fontSize:24 },
      { id:1, label:"Prolonged recovery",                   x:0.832, y:0.584, group:"pain",   rw:253, rh:54, fontSize:24 },
      { id:2, label:"Increased pain sensitivity",           x:0.831, y:0.184, group:"affect", rw:196, rh:87, fontSize:24 },
      { id:3, label:"Worsening mental health",              x:0.525, y:-0.002, group:"affect", rw:236, rh:87, fontSize:24 },
      { id:4, label:"Avoiding social and physical activity",x:0.525, y:0.383, group:"affect", rw:235, rh:82, fontSize:22 },
      { id:5, label:"Reduced strength/capacity",            x:0.525, y:0.742, group:"affect", rw:227, rh:87, fontSize:24 },
    ],
    edges: [
      { id:0, from:0, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:1, from:1, to:2, thickness:5, linkState:"facilitate", direction:"both" },
      { id:2, from:2, to:3, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:3, from:3, to:4, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:4, from:4, to:3, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:5, from:4, to:5, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:6, from:5, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:7, from:2, to:4, thickness:5, linkState:"facilitate", direction:"to"   },
    ],
  },
  {
    name: "Nociplastic with reduced descending inhibition (with contributing factors)",
    shape: "rect",
    nodes: [
      { id:0, label:"Injury",                               x:0.644, y:0.970, group:"origin", rw:93,  rh:54, fontSize:24 },
      { id:1, label:"Prolonged recovery",                   x:0.644, y:0.745, group:"pain",   rw:253, rh:54, fontSize:24 },
      { id:2, label:"Increased pain sensitivity",           x:0.644, y:0.277, group:"affect", rw:196, rh:87, fontSize:24 },
      { id:3, label:"Worsening mental health",              x:0.341, y:0.053, group:"affect", rw:236, rh:87, fontSize:24 },
      { id:4, label:"Avoiding social and physical activity",x:0.340, y:0.409, group:"affect", rw:235, rh:82, fontSize:22 },
      { id:5, label:"Reduced strength/capacity",            x:0.337, y:0.757, group:"affect", rw:227, rh:87, fontSize:24 },
      { id:6, label:"Inflammation and poor injury management General health Previous injury Stress", x:0.920, y:0.529, group:"affect", rw:265, rh:143, fontSize:22 },
    ],
    edges: [
      { id:0, from:0, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:1, from:1, to:2, thickness:5, linkState:"facilitate", direction:"both" },
      { id:2, from:2, to:3, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:3, from:3, to:4, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:4, from:4, to:3, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:5, from:4, to:5, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:6, from:5, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:7, from:6, to:2, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:8, from:6, to:1, thickness:5, linkState:"facilitate", direction:"to"   },
      { id:9, from:2, to:4, thickness:5, linkState:"facilitate", direction:"to"   },
    ],
  },
];

// ─── SETUP ───────────────────────────────────────────────────────────────────

function setup() {
  createCanvas(windowWidth, windowHeight);

  buildMenuUI();
  buildAnalyseUI();

  promptLabel = createP("");
  promptLabel.style("font-family","Georgia, serif");
  promptLabel.style("font-size",  "20px");
  promptLabel.style("color",      "#2a2a3a");
  promptLabel.style("margin",     "0 0 10px 0");
  promptLabel.position(40, height - 110);

  hintLabel = createP("");
  hintLabel.style("font-family","Georgia, serif");
  hintLabel.style("font-size",  "13px");
  hintLabel.style("color",      "#888");
  hintLabel.style("margin",     "0");
  hintLabel.position(500, height - 72);

  inputBox = createInput("");
  inputBox.size(340, 38);
  inputBox.style("font-size",    "17px");
  inputBox.style("font-family",  "Georgia, serif");
  inputBox.style("padding",      "6px 12px");
  inputBox.style("border",       "2px solid #8888bb");
  inputBox.style("border-radius","8px");
  inputBox.style("outline",      "none");
  inputBox.position(40, height - 68);

  submitBtn = createButton("Add →");
  submitBtn.size(90, 42);
  submitBtn.style("font-size",    "16px");
  submitBtn.style("font-family",  "Georgia, serif");
  submitBtn.style("background",   "#5566bb");
  submitBtn.style("color",        "white");
  submitBtn.style("border",       "none");
  submitBtn.style("border-radius","8px");
  submitBtn.style("cursor",       "pointer");
  submitBtn.position(396, height - 68);
  submitBtn.mousePressed(handleSubmit);

  inputBox.elt.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSubmit();
  });
  document.addEventListener("wheel", handleWheel, { passive: false });
  setPhase(0);
  initAutosave();
}

// ─── MENU UI ─────────────────────────────────────────────────────────────────

function buildMenuUI() {
  // ── Hamburger / title button ─────────────────────────────────────────────
  menuBtn = createDiv("☰ &nbsp;Networks");
  menuBtn.style("position",      "absolute");
  menuBtn.style("top",           "14px");
  menuBtn.style("left",          "14px");
  menuBtn.style("background",    "#5566bb");
  menuBtn.style("color",         "white");
  menuBtn.style("font-family",   "Georgia, serif");
  menuBtn.style("font-size",     "15px");
  menuBtn.style("padding",       "8px 18px");
  menuBtn.style("border-radius", "10px");
  menuBtn.style("cursor",        "pointer");
  menuBtn.style("box-shadow",    "0 2px 8px rgba(0,0,0,0.18)");
  menuBtn.style("user-select",   "none");
  menuBtn.style("z-index",       "1000");
  menuBtn.elt.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // ── Dropdown panel ───────────────────────────────────────────────────────
  menuPanel = createDiv("");
  menuPanel.style("position",      "absolute");
  menuPanel.style("top",           "54px");
  menuPanel.style("left",          "14px");
  menuPanel.style("background",    "#fafafa");
  menuPanel.style("border",        "2px solid #7788cc");
  menuPanel.style("border-radius", "12px");
  menuPanel.style("padding",       "12px 0 8px 0");
  menuPanel.style("box-shadow",    "0 8px 28px rgba(0,0,0,0.20)");
  menuPanel.style("font-family",   "Georgia, serif");
  menuPanel.style("min-width",     "240px");
  menuPanel.style("z-index",       "1000");
  menuPanel.style("display",       "none");
  menuPanel.elt.addEventListener("mousedown", (e) => e.stopPropagation());
}

// ─── LOCAL STORAGE HELPERS ───────────────────────────────────────────────────
// Simple synchronous wrappers around localStorage — works in OpenProcessing.
// All user networks are stored under the key prefix "painnet:"

function storageList() {
  let keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    let k = localStorage.key(i);
    if (k && k.startsWith("painnet:")) keys.push(k);
  }
  return keys;
}

function storageSave(name, data) {
  localStorage.setItem("painnet:" + name, JSON.stringify(data));
}

function storageLoad(key) {
  let raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

function storageDelete(key) {
  localStorage.removeItem(key);
}

// ─── AUTOSAVE / UNSAVED-WORK PROTECTION ──────────────────────────────────────
// The current network is autosaved continuously so a mis-click (e.g. the mouse
// "back" button) can never lose a formulation that hasn't been saved by name.
//
//   AUTOSAVE_KEY  — the latest state of the current work, rewritten whenever it
//                   changes (checked about once a second, plus on page hide/unload).
//   PREV_KEY      — one older generation: the previous visit's autosave (moved
//                   here on this visit's first write) or work the user confirmed
//                   discarding when loading something else.
//
// Neither key starts with "painnet:", so autosaves never show up in (or get
// deleted from) the "My saved networks" list. Empty networks are never written,
// so opening the page fresh can't wipe the previous autosave.
//
// "Dirty" means the network differs from the last named save / deliberate load.
// While dirty, leaving the page triggers the browser's "Leave site?" prompt.

const AUTOSAVE_KEY         = "painnet-autosave";
const PREV_KEY             = "painnet-autosave-prev";
const AUTOSAVE_EVERY_FRAMES = 60;

let savedBaselineJSON  = null;   // network JSON as of last named save / load
let lastAutosaveJSON   = null;   // network JSON last written to AUTOSAVE_KEY
let lastAutosaveAt     = null;   // Date of last autosave write this visit
let startupAutosave    = null;   // { savedAt, data } found in storage on page load
let startupAutosaveRaw = null;
let movedStartupToPrev = false;
let recoverBanner      = null;

function networkJSON() {
  return JSON.stringify(serialiseNetwork(""));
}

function isDirty() {
  return nodes.length > 0 && networkJSON() !== savedBaselineJSON;
}

function markSaved() {
  savedBaselineJSON = networkJSON();
}

function readAutosave(key) {
  try {
    let raw = localStorage.getItem(key);
    if (!raw) return null;
    let rec = JSON.parse(raw);
    if (!rec || !rec.data || !rec.data.nodes || rec.data.nodes.length === 0) return null;
    return rec;
  } catch (err) { return null; }
}

function writeAutosave(key, json) {
  try {
    localStorage.setItem(key, '{"savedAt":' + Date.now() + ',"data":' + json + '}');
    return true;
  } catch (err) {
    console.warn("Autosave failed:", err);
    return false;
  }
}

function autosaveNow() {
  if (nodes.length === 0) return;
  let json = networkJSON();
  if (json === lastAutosaveJSON) return;
  // An untouched preset or named save needs no autosave — and writing one
  // would push genuinely unsaved work out of the recovery slots.
  if (json === savedBaselineJSON) return;
  // First write this visit: keep the previous visit's autosave as PREV_KEY
  if (!movedStartupToPrev && startupAutosaveRaw) {
    try { localStorage.setItem(PREV_KEY, startupAutosaveRaw); } catch (err) {}
  }
  movedStartupToPrev = true;
  if (writeAutosave(AUTOSAVE_KEY, json)) {
    lastAutosaveJSON = json;
    lastAutosaveAt   = new Date();
  }
}

function autosaveTick() {
  if (frameCount % AUTOSAVE_EVERY_FRAMES === 0) autosaveNow();
}

// Before replacing dirty work with something else, ask — and if confirmed,
// stash the work in PREV_KEY so it is still recoverable from the menu.
function confirmDiscardChanges() {
  if (!isDirty()) return true;
  if (!confirm("This network has unsaved changes.\n\nReplace it anyway? " +
               "(It will be kept as an earlier autosave you can restore from the Networks menu.)")) {
    return false;
  }
  writeAutosave(PREV_KEY, networkJSON());
  return true;
}

function restoreAutosave(rec) {
  if (!confirmDiscardChanges()) return;
  loadNetwork(rec.data);
  // Deliberately leave the baseline alone: restored work is still unsaved,
  // so the leave-page prompt keeps protecting it until it is saved by name.
  hideRecoverBanner();
}

function describeAutosave(rec) {
  let d = new Date(rec.savedAt);
  let when = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) +
             " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return when + " · " + rec.data.nodes.length + " nodes";
}

function initAutosave() {
  markSaved();   // empty network on load = nothing unsaved
  try { startupAutosaveRaw = localStorage.getItem(AUTOSAVE_KEY); } catch (err) {}
  startupAutosave = readAutosave(AUTOSAVE_KEY);
  if (!startupAutosave) startupAutosaveRaw = null;
  if (startupAutosave) showRecoverBanner(startupAutosave);

  window.addEventListener("beforeunload", function(e) {
    autosaveNow();
    if (isDirty()) {
      e.preventDefault();
      e.returnValue = "";   // browsers show their own generic "Leave site?" text
    }
  });
  window.addEventListener("pagehide", autosaveNow);
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "hidden") autosaveNow();
  });

  // Swallow the mouse's back/forward side buttons (3 and 4) on this page.
  // Capture phase on window, because menu elements stopPropagation on mousedown.
  // Not every browser honours this — beforeunload + autosave are the backstop.
  ["mousedown", "mouseup", "auxclick", "pointerdown", "pointerup"].forEach(function(type) {
    window.addEventListener(type, function(e) {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
        if (type === "mouseup") flashNotice("Mouse back/forward is disabled here — use ← Back (top right)");
      }
    }, true);
  });
}

function showRecoverBanner(rec) {
  recoverBanner = createDiv("");
  let s = recoverBanner.elt.style;
  s.position = "fixed"; s.top = "14px"; s.left = "50%"; s.transform = "translateX(-50%)";
  s.zIndex = "2100"; s.background = "#fffbe8"; s.border = "1.5px solid #e0c060";
  s.borderRadius = "10px"; s.padding = "8px 12px 8px 16px";
  s.boxShadow = "0 4px 16px rgba(0,0,0,0.15)"; s.fontFamily = "Georgia, serif";
  s.fontSize = "14px"; s.color = "#443"; s.display = "flex"; s.gap = "10px";
  s.alignItems = "center";
  recoverBanner.elt.addEventListener("mousedown", (e) => e.stopPropagation());

  let msg = document.createElement("span");
  msg.textContent = "Unsaved work from your last visit (" + describeAutosave(rec) + ")";
  recoverBanner.elt.appendChild(msg);

  function bannerBtn(label, primary, onClick) {
    let b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = "font-family:Georgia,serif;font-size:13px;padding:4px 12px;" +
      "border-radius:6px;cursor:pointer;" +
      (primary ? "background:#5566bb;color:white;border:none;"
               : "background:white;color:#555;border:1px solid #ccb;");
    b.addEventListener("click", onClick);
    recoverBanner.elt.appendChild(b);
  }
  bannerBtn("Restore", true, function() { restoreAutosave(rec); });
  bannerBtn("Not now", false, hideRecoverBanner);
}

function hideRecoverBanner() {
  if (recoverBanner) { recoverBanner.remove(); recoverBanner = null; }
}

let noticeTimer = null;
function flashNotice(text) {
  let el = document.getElementById("cf-notice");
  if (!el) {
    el = document.createElement("div");
    el.id = "cf-notice";
    el.style.cssText = "position:fixed;left:50%;bottom:150px;transform:translateX(-50%);" +
      "z-index:2200;background:rgba(40,40,70,0.88);color:white;font-family:Georgia,serif;" +
      "font-size:14px;padding:8px 16px;border-radius:8px;pointer-events:none;";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.display = "block";
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(function() { el.style.display = "none"; }, 2500);
}

// ─── MENU PANEL ───────────────────────────────────────────────────────────────

function rebuildMenuPanel() {
  menuPanel.elt.innerHTML = "";

  // Recover unsaved work (autosaves) — only shown when there is something
  let prevAutosave = readAutosave(PREV_KEY);
  if (prevAutosave && startupAutosave && prevAutosave.savedAt === startupAutosave.savedAt) {
    prevAutosave = null;   // same snapshot, don't list it twice
  }
  if (startupAutosave || prevAutosave) {
    addMenuSection("Recover unsaved work");
    if (startupAutosave) {
      addMenuRow("↺ Last visit — " + describeAutosave(startupAutosave), "action",
        function() { restoreAutosave(startupAutosave); closeMenu(); });
    }
    if (prevAutosave) {
      addMenuRow("↺ Earlier — " + describeAutosave(prevAutosave), "action",
        function() { restoreAutosave(prevAutosave); closeMenu(); });
    }
    addMenuDivider();
  }

  // Built-in presets
  addMenuSection("Built-in presets");
  for (let p of PRESETS) {
    addMenuRow(p.name, "preset", function() {
      if (!confirmDiscardChanges()) return;
      loadNetwork(p); markSaved(); closeMenu();
    });
  }
  addMenuDivider();

  // Saved networks
  addMenuSection("My saved networks");
  let savedKeys = storageList();

  if (savedKeys.length === 0) {
    let empty = createDiv("none saved yet");
    empty.style("font-size","12px"); empty.style("color","#bbb");
    empty.style("padding","4px 20px"); empty.style("font-style","italic");
    empty.parent(menuPanel);
  } else {
    savedKeys.forEach(function(key) {
      let name = key.replace("painnet:", "");
      let row = createDiv("");
      row.style("display","flex"); row.style("align-items","center");
      row.style("justify-content","space-between");
      row.style("padding","0 12px 0 20px");
      row.parent(menuPanel);

      let lbl = createDiv(name);
      lbl.style("font-size","14px"); lbl.style("color","#333");
      lbl.style("cursor","pointer"); lbl.style("flex","1");
      lbl.style("padding","6px 0");
      lbl.parent(row);
      lbl.elt.addEventListener("click", function() {
        let data = storageLoad(key);
        if (data && confirmDiscardChanges()) { loadNetwork(data); markSaved(); closeMenu(); }
      });

      let del = createDiv("✕");
      del.style("font-size","13px"); del.style("color","#c88");
      del.style("cursor","pointer"); del.style("padding","4px 6px");
      del.style("border-radius","4px");
      del.elt.title = "Delete this saved network";
      del.parent(row);
      del.elt.addEventListener("mouseenter", function() { del.style("color","#c00"); });
      del.elt.addEventListener("mouseleave", function() { del.style("color","#c88"); });
      del.elt.addEventListener("click", function() {
        if (!confirm("Delete saved network \"" + name + "\"? This cannot be undone.")) return;
        storageDelete(key);
        rebuildMenuPanel();
      });
    });
  }

  addMenuDivider();

  // Shape toggle
  addMenuSection("Node shape");
  let shapeRow = createDiv("");
  shapeRow.style("display","flex"); shapeRow.style("gap","8px");
  shapeRow.style("padding","4px 20px 8px");
  shapeRow.parent(menuPanel);

  ["circle","rect"].forEach(function(s) {
    let btn = createButton(s === "circle" ? "● Circle" : "▭ Rectangle");
    btn.style("font-family","Georgia, serif"); btn.style("font-size","12px");
    btn.style("padding","4px 10px"); btn.style("border-radius","8px");
    btn.style("cursor","pointer"); btn.style("flex","1");
    btn.style("border", nodeShape === s ? "2px solid #5566bb" : "1.5px solid #ccd");
    btn.style("background", nodeShape === s ? "#eef" : "white");
    btn.style("color", nodeShape === s ? "#5566bb" : "#555");
    btn.style("font-weight", nodeShape === s ? "bold" : "normal");
    btn.parent(shapeRow);
    btn.mousePressed(function() {
      nodeShape = s;
      // Apply to all existing nodes
      nodes.forEach(function(n) {
        n.shape = s;
        if (s === "rect" && n.rw < 2) { n.rw = 120; n.rh = 50; }
      });
      rebuildMenuPanel();
    });
  });

  addMenuDivider();

  // Save current network
  addMenuSection("Save current network");
  let saveRow = createDiv("");
  saveRow.style("display","flex"); saveRow.style("align-items","center");
  saveRow.style("gap","8px"); saveRow.style("padding","6px 16px");
  saveRow.parent(menuPanel);

  let nameIn = createElement("input");
  nameIn.elt.type        = "text";
  nameIn.elt.placeholder = "Name this network...";
  nameIn.style("font-family","Georgia, serif"); nameIn.style("font-size","13px");
  nameIn.style("padding","5px 8px"); nameIn.style("border","1.5px solid #aab");
  nameIn.style("border-radius","6px"); nameIn.style("outline","none");
  nameIn.style("flex","1");
  nameIn.parent(saveRow);
  nameIn.elt.addEventListener("keydown", function(e) {
    e.stopPropagation();
    if (e.key === "Enter") doSave();
  });

  let saveBtn = createButton("Save");
  saveBtn.style("font-family","Georgia, serif"); saveBtn.style("font-size","13px");
  saveBtn.style("padding","5px 12px"); saveBtn.style("background","#5566bb");
  saveBtn.style("color","white"); saveBtn.style("border","none");
  saveBtn.style("border-radius","6px"); saveBtn.style("cursor","pointer");
  saveBtn.style("flex-shrink","0");
  saveBtn.parent(saveRow);

  function doSave() {
    let name = nameIn.elt.value.trim();
    if (!name) { alert("Please enter a name."); return; }
    if (nodes.length === 0) { alert("Nothing to save yet!"); return; }
    if (localStorage.getItem("painnet:" + name) !== null &&
        !confirm("A network called \"" + name + "\" already exists. Overwrite it?")) return;
    storageSave(name, serialiseNetwork(name));
    markSaved();
    nameIn.elt.value = "";
    rebuildMenuPanel();
  }
  saveBtn.mousePressed(doSave);

  let status = createDiv(nodes.length === 0 ? "" :
    (isDirty() ? "Not saved by name yet" : "Saved") +
    (lastAutosaveAt ? " · autosaved " + lastAutosaveAt.toLocaleTimeString(undefined,
      { hour: "2-digit", minute: "2-digit" }) : ""));
  status.style("font-size","11px"); status.style("color","#99a");
  status.style("font-style","italic"); status.style("padding","0 20px 4px");
  status.parent(menuPanel);

  // Export current node positions for preset editing
  addMenuDivider();
  addMenuSection("File — move a case between computers");
  addMenuRow("⬇ Download to file…", "action", function() {
    closeMenu();
    downloadNetworkFile();
  });
  addMenuRow("⬆ Open from file…", "action", function() {
    closeMenu();
    openNetworkFile();
  });

  addMenuDivider();
  addMenuSection("Export");
  addMenuRow("📋 Copy full preset", "action", function() {
    if (nodes.length === 0) { alert("No nodes to export."); return; }

    let topBand = 60, botBand = height - 140;
    let lines = [];

    // Nodes
    lines.push("nodes: [");
    for (let i = 0; i < nodes.length; i++) {
      let n = nodes[i];
      let xf   = (n.x / width).toFixed(3);
      let yRel = ((n.y - topBand) / (botBand - topBand)).toFixed(3);
      // Node colour — find closest palette match or store raw rgb
      let rr = Math.round(red(n.col)), gg = Math.round(green(n.col)), bb = Math.round(blue(n.col));
      let colStr = "";
      for (let pi = 0; pi < PALETTE.length; pi++) {
        let pc = PALETTE[pi];
        if (Math.abs(pc.r-rr)<5 && Math.abs(pc.g-gg)<5 && Math.abs(pc.b-bb)<5) {
          colStr = ", paletteName:\"" + pc.label + "\""; break;
        }
      }
      lines.push("  { id:" + n.id
        + ", label:\"" + n.label + "\""
        + ", x:" + xf
        + ", y:" + yRel
        + ", group:\"" + n.group + "\""
        + ", rw:" + Math.round(n.rw || 160)
        + ", rh:" + Math.round(n.rh || 62)
        + ", fontSize:" + Math.round(n.fontSize || 18)
        + colStr
        + " },"
      );
    }
    lines.push("],");

    // Edges
    lines.push("edges: [");
    for (let i = 0; i < edges.length; i++) {
      let e = edges[i];
      let cv = (e.curve || 0).toFixed(3);
      lines.push("  { id:" + e.id
        + ", from:" + e.from
        + ", to:" + e.to
        + ", thickness:" + Math.round(e.thickness || 5)
        + ", linkState:\"" + (e.linkState || "facilitate") + "\""
        + ", direction:\"" + (e.direction || "to") + "\""
        + ", curve:" + cv
        + " },"
      );
    }
    lines.push("],");

    let txt = lines.join("\n");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(function() {
        alert("Full preset copied to clipboard!");
      }).catch(function() {
        prompt("Copy this:", txt);
      });
    } else {
      prompt("Copy this:", txt);
    }
    closeMenu();
  });

  // New blank network
  addMenuDivider();
  addMenuRow("+ New blank network", "action", function() {
    if (!confirmDiscardChanges()) return;
    nodes = []; edges = [];
    originNode = null; painNode = null;
    particles = []; pendingSpawns = [];
    closePopup(); closeMenu();
    setPhase(0);
  });
}

// ─── FILE DOWNLOAD / OPEN ─────────────────────────────────────────────────────
// Offline copies of a network as a .json file, so a case can be kept outside the
// browser or moved to another computer. The file holds serialiseNetwork()'s
// output plus a small header; a bare serialiseNetwork() object (e.g. copied out
// of localStorage) also opens fine.

const FILE_FORMAT = "painvisuals-case-formulation";

function downloadNetworkFile() {
  if (nodes.length === 0) { alert("Nothing to download yet!"); return; }
  let today = new Date().toISOString().slice(0, 10);
  let name = prompt("Name for this case formulation:", "Case formulation " + today);
  if (name === null) return;
  name = name.trim() || "Case formulation " + today;

  let data = serialiseNetwork(name);
  data.format  = FILE_FORMAT;
  data.version = 1;
  data.savedAt = new Date().toISOString();

  let blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[\\/:*?"<>|]+/g, "-") + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
  // A downloaded copy counts as saved for the leave-page prompt
  markSaved();
}

function openNetworkFile() {
  let input = document.createElement("input");
  input.type   = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", function() {
    let file = input.files && input.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function() {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (err) { alert("That file isn't a readable case formulation (not valid JSON)."); return; }
      if (!isValidNetworkData(data)) {
        alert("That file doesn't look like a case formulation saved from this tool.");
        return;
      }
      if (!confirmDiscardChanges()) return;
      loadNetwork(data);
      markSaved();
      hideRecoverBanner();
      flashNotice("Opened \"" + (data.name || file.name) + "\" — save it by name to keep it in this browser");
    };
    reader.readAsText(file);
  });
  input.click();
}

function isValidNetworkData(data) {
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return false;
  if (data.nodes.length === 0) return false;
  let ids = new Set();
  for (let n of data.nodes) {
    if (!n || n.id === undefined || typeof n.x !== "number" || typeof n.y !== "number") return false;
    ids.add(n.id);
  }
  for (let e of data.edges) {
    if (!e || !ids.has(e.from) || !ids.has(e.to)) return false;
  }
  return true;
}

// ─── MENU HELPERS ────────────────────────────────────────────────────────────
// These three helpers append styled children to a given parent container.
// The parent must be passed explicitly — they do not use the menuPanel global —
// so they can be safely reused for any panel if needed in future.

function addMenuSection(title, parent) {
  parent = parent || menuPanel; // default to Networks panel for brevity
  let s = createDiv(title);
  s.style("font-size",     "10px");
  s.style("font-weight",   "bold");
  s.style("color",         "#99a");
  s.style("text-transform","uppercase");
  s.style("letter-spacing","0.08em");
  s.style("padding",       "4px 20px 2px");
  s.parent(parent);
}

function addMenuRow(label, type, onClick, parent) {
  parent = parent || menuPanel;
  let row = createDiv(label);
  row.style("font-size",   "14px");
  row.style("color",       type === "action" ? "#5566bb" : "#222");
  row.style("padding",     "7px 20px");
  row.style("cursor",      "pointer");
  row.style("transition",  "background 0.1s");
  row.parent(parent);
  row.elt.addEventListener("mouseenter", () => row.style("background","#eef"));
  row.elt.addEventListener("mouseleave", () => row.style("background","transparent"));
  row.elt.addEventListener("click", onClick);
}

function addMenuDivider(parent) {
  parent = parent || menuPanel;
  let d = createDiv("");
  d.style("border-top", "1px solid #eee");
  d.style("margin",     "8px 0");
  d.parent(parent);
}

// ─── ANALYSE UI ───────────────────────────────────────────────────────────────

function buildAnalyseUI() {
  // ── Analyse button — sits below Networks button ───────────────────────────
  analyseBtn = createDiv("⚡ &nbsp;Analyse");
  analyseBtn.style("position",      "absolute");
  analyseBtn.style("top",           "14px");
  analyseBtn.style("left",          "160px");
  analyseBtn.style("background",    "#2a7a6a");
  analyseBtn.style("color",         "white");
  analyseBtn.style("font-family",   "Georgia, serif");
  analyseBtn.style("font-size",     "15px");
  analyseBtn.style("padding",       "8px 18px");
  analyseBtn.style("border-radius", "10px");
  analyseBtn.style("cursor",        "pointer");
  analyseBtn.style("box-shadow",    "0 2px 8px rgba(0,0,0,0.18)");
  analyseBtn.style("user-select",   "none");
  analyseBtn.style("z-index",       "1000");
  analyseBtn.elt.addEventListener("mousedown", function(e) {
    e.stopPropagation();
    toggleAnalysePanel();
  });

  // ── Analyse panel ─────────────────────────────────────────────────────────
  analysePanel = createDiv("");
  analysePanel.style("position",      "absolute");
  analysePanel.style("top",           "58px");
  analysePanel.style("left",          "160px");
  analysePanel.style("background",    "#f0faf8");
  analysePanel.style("border",        "2px solid #2a7a6a");
  analysePanel.style("border-radius", "12px");
  analysePanel.style("padding",       "12px 14px");
  analysePanel.style("box-shadow",    "0 8px 28px rgba(0,0,0,0.18)");
  analysePanel.style("font-family",   "Georgia, serif");
  analysePanel.style("width",         "240px");
  analysePanel.style("z-index",       "1000");
  analysePanel.style("display",       "none");
  analysePanel.elt.addEventListener("mousedown", function(e) { e.stopPropagation(); });

  // Title
  let title = createDiv("Belief Analysis");
  title.style("font-size","13px"); title.style("font-weight","bold");
  title.style("color","#1a5a4a"); title.style("margin-bottom","8px");
  title.style("border-bottom","1px solid #aad"); title.style("padding-bottom","6px");
  title.parent(analysePanel);

  // Mode toggle
  let modeRow = createDiv("");
  modeRow.style("display","flex"); modeRow.style("align-items","center");
  modeRow.style("gap","10px"); modeRow.style("margin-bottom","12px");
  modeRow.parent(analysePanel);

  let modeLabel = createDiv("Analyse mode:");
  modeLabel.style("font-size","12px"); modeLabel.style("color","#444");
  modeLabel.parent(modeRow);

  let toggleBtn = createButton(analyseMode ? "ON" : "OFF");
  toggleBtn.style("font-family","Georgia, serif"); toggleBtn.style("font-size","13px");
  toggleBtn.style("padding","4px 14px"); toggleBtn.style("border-radius","20px");
  toggleBtn.style("border","none"); toggleBtn.style("cursor","pointer");
  toggleBtn.style("font-weight","bold");
  toggleBtn.style("background", analyseMode ? "#2a7a6a" : "#ccc");
  toggleBtn.style("color","white");
  toggleBtn.parent(modeRow);
  toggleBtn.mousePressed(function() {
    analyseMode = !analyseMode;
    toggleBtn.elt.textContent = analyseMode ? "ON" : "OFF";
    toggleBtn.style("background", analyseMode ? "#2a7a6a" : "#ccc");
    if (analyseMode) initBeliefs();
  });

  // Debug toggle — sits next to the ON/OFF button in the same row
  let debugBtn = createButton("🔍");
  debugBtn.style("font-size",     "14px");
  debugBtn.style("padding",       "4px 8px");
  debugBtn.style("border-radius", "20px");
  debugBtn.style("border",        "1.5px solid #aab");
  debugBtn.style("cursor",        "pointer");
  debugBtn.style("background",    showDebug ? "#445" : "transparent");
  debugBtn.style("color",         showDebug ? "white" : "#667");
  debugBtn.elt.title = "Show propagation debug overlay";
  debugBtn.parent(modeRow);
  debugBtn.mousePressed(function() {
    showDebug = !showDebug;
    debugBtn.style("background", showDebug ? "#445" : "transparent");
    debugBtn.style("color",      showDebug ? "white" : "#667");
    if (!showDebug) debugLines = []; // clear overlay when turned off
  });

  // Propagation depth — how many hops a single keypress is allowed to reach,
  // in both the actual belief update and the particle animation.
  const HOP_SLIDER_MAX = 8; // slider's top position means "All" (Infinity), not literally 8

  let hopRow = createDiv("");
  hopRow.style("margin-bottom","12px");
  hopRow.parent(analysePanel);

  let hopLabelRow = createDiv("");
  hopLabelRow.style("display","flex"); hopLabelRow.style("justify-content","space-between");
  hopLabelRow.style("margin-bottom","4px");
  hopLabelRow.parent(hopRow);

  let hopLabel = createDiv("Propagation depth:");
  hopLabel.style("font-size","12px"); hopLabel.style("color","#444");
  hopLabel.parent(hopLabelRow);

  let hopValueLabel = createDiv(
    maxPropagationHops >= HOP_SLIDER_MAX ? "All" : String(maxPropagationHops)
  );
  hopValueLabel.style("font-size","12px"); hopValueLabel.style("color","#2a7a6a");
  hopValueLabel.style("font-weight","bold");
  hopValueLabel.parent(hopLabelRow);

  let hopSlider = createSlider(
    1, HOP_SLIDER_MAX,
    maxPropagationHops >= HOP_SLIDER_MAX ? HOP_SLIDER_MAX : maxPropagationHops,
    1
  );
  hopSlider.style("width","100%");
  hopSlider.parent(hopRow);
  hopSlider.input(function() {
    let v = Number(hopSlider.value());
    maxPropagationHops = (v >= HOP_SLIDER_MAX) ? Infinity : v;
    hopValueLabel.elt.textContent = (v >= HOP_SLIDER_MAX) ? "All" : String(v);
  });

  let hopNote = createDiv("How many nodes away a single + / − keypress is allowed to ripple, in the belief values and the flowing dots alike.");
  hopNote.style("font-size","10px"); hopNote.style("color","#888");
  hopNote.style("margin-top","3px"); hopNote.style("line-height","1.4");
  hopNote.parent(hopRow);

  // Belief scale legend
  let legend = createDiv("");
  legend.style("margin-bottom","12px");
  legend.parent(analysePanel);

  let legendTitle = createDiv("Belief scale:");
  legendTitle.style("font-size","10px"); legendTitle.style("color","#888");
  legendTitle.style("margin-bottom","3px");
  legendTitle.parent(legend);

  // Gradient bar
  let gradBar = createElement("canvas");
  gradBar.elt.width = 150; gradBar.elt.height = 14;
  gradBar.style("border-radius","4px"); gradBar.style("display","block");
  gradBar.parent(legend);
  let gctx = gradBar.elt.getContext("2d");
  let grad = gctx.createLinearGradient(0,0,150,0);
  grad.addColorStop(0,   "rgb(0,210,210)");
  grad.addColorStop(0.5, "rgb(160,160,180)");
  grad.addColorStop(1,   "rgb(240,60,60)");
  gctx.fillStyle = grad;
  gctx.fillRect(0,0,150,14);

  let legendLabels = createDiv("");
  legendLabels.style("display","flex"); legendLabels.style("justify-content","space-between");
  legendLabels.style("font-size","10px"); legendLabels.style("color","#888");
  legendLabels.style("margin-top","2px");
  legendLabels.parent(legend);
  createDiv("fewer").parent(legendLabels);
  createDiv("neutral").parent(legendLabels); // middle
  createDiv("more").parent(legendLabels);

  // Divider
  let div1 = createDiv(""); div1.style("border-top","1px solid #cde");
  div1.style("margin","8px 0"); div1.parent(analysePanel);

  // Reset button
  let resetBtn = createButton("↺ Reset all beliefs to 0.5");
  resetBtn.style("font-family","Georgia, serif"); resetBtn.style("font-size","12px");
  resetBtn.style("padding","5px 10px"); resetBtn.style("width","100%");
  resetBtn.style("border-radius","8px"); resetBtn.style("border","1.5px solid #2a7a6a");
  resetBtn.style("background","white"); resetBtn.style("color","#2a7a6a");
  resetBtn.style("cursor","pointer");
  resetBtn.parent(analysePanel);
  resetBtn.mousePressed(function() { initBeliefs(); });

  // Info note
  let note = createDiv("Hover a node, then press <b>= / +</b> for more problems or <b>−</b> for fewer problems. Press repeatedly to strengthen.");
  note.style("font-size","11px"); note.style("color","#667");
  note.style("margin-top","8px"); note.style("line-height","1.5");
  note.style("font-family","Georgia, serif");
  note.parent(analysePanel);

  // Divider before explanation
  let div2 = createDiv(""); div2.style("border-top","1px solid #cde");
  div2.style("margin","10px 0 6px 0"); div2.parent(analysePanel);

  // About this tool — 3 dot point patient-focused explanation
  let aboutTitle = createDiv("About this tool");
  aboutTitle.style("font-size","10px"); aboutTitle.style("font-weight","bold");
  aboutTitle.style("color","#2a7a6a"); aboutTitle.style("text-transform","uppercase");
  aboutTitle.style("letter-spacing","0.06em"); aboutTitle.style("margin-bottom","6px");
  aboutTitle.parent(analysePanel);

  let aboutText = createDiv(
    "<p style='margin:0 0 7px 0'>&#8226; This tool is designed to help you and your clinician " +
    "build a <b>personal map of your pain journey</b> — showing how different parts of your life " +
    "connect to and influence each other.</p>" +
    "<p style='margin:0 0 7px 0'>&#8226; The <b>Analyse</b> feature is an <b>educational tool</b>. " +
    "It shows how changes in one area of your life might ripple through the rest of your network — " +
    "helping you see why pain can feel so unpredictable, and why small changes sometimes " +
    "have bigger effects than expected.</p>" +
    "<p style='margin:0'>&#8226; The numbers and colours are a <b>simplified model</b>, not a " +
    "medical measurement. They reflect ideas from current pain science, but every person's " +
    "experience is different. Use this as a <b>conversation starter</b>, not a diagnosis.</p>"
  );
  aboutText.style("font-size","11px"); aboutText.style("color","#445");
  aboutText.style("line-height","1.55"); aboutText.style("font-family","Georgia, serif");
  aboutText.parent(analysePanel);
}

function toggleAnalysePanel() {
  analysePanelOpen = !analysePanelOpen;
  analysePanel.style("display", analysePanelOpen ? "block" : "none");
  if (analysePanelOpen) closeMenu();
}

function closeAnalysePanel() {
  analysePanelOpen = false;
  analysePanel.style("display","none");
}

// Maps node visual size to a prior probability (0.3–0.8).
// Larger node = higher prior = more likely to be active before any evidence.
// Circle nodes use radius r (range 16–120), rect nodes use rw (range 40–400).
// Both are mapped linearly onto [0.3, 0.8] with the midpoint of each range = 0.5.
// Prior range is deliberately constrained away from 0 and 1 to prevent
// accidental scrolling from locking a node to an extreme.
function nodeSizeToPrior(n) {
  // Node size maps to prior probability (baseline before evidence).
  // Centred at rw=160 / r=50 = prior 0.5 (neutral).
  // Larger = higher prior (more prevalent for this patient).
  // Range 0.30–0.80 to prevent accidental extremes from scrolling.
  // NOTE: The Basic Pain preset uses small nodes (rw=80) which give prior≈0.42.
  // If you want all nodes to start at 0.5, scroll them to rw≈160.
  if (n.shape === "rect") {
    return constrain(0.5 + (n.rw - 160) / 300 * 0.3, 0.3, 0.8);
  } else {
    return constrain(0.5 + (n.r  -  50) / 100 * 0.3, 0.3, 0.8);
  }
}

// Recalculate and apply the prior from current node size.
// Call this whenever a node is resized.
function updateNodePrior(n) {
  n.prior = nodeSizeToPrior(n);
}

// Initialise / reset all node beliefs to their size-derived priors.
function initBeliefs() {
  for (let n of nodes) {
    updateNodePrior(n);            // derive prior from current size
    n.belief = n.prior;
    n.displayBelief = n.prior;
  }
  particles = [];
  pendingSpawns = [];
}

// Map belief (0-1) to a colour: neutral grey at the node's own PRIOR,
// shading toward cyan below it and red above it.
// Deviation from prior is amplified with a power curve so small changes are
// visible, and normalised against the available range on that side (a node
// with prior 0.8 only has 0.2 of "room" above it, but that 0.2 should still
// be able to read as fully red — otherwise high-prior nodes can never
// visibly show relief, which is the bug this pivot fixes).
function beliefColor(b, prior) {
  b = constrain(b, 0, 1);
  prior = (prior === undefined || prior === null) ? 0.5 : constrain(prior, 0.001, 0.999);

  let dev   = b - prior;                              // signed deviation from prior
  let sign  = dev >= 0 ? 1 : -1;
  let range = sign >= 0 ? (1 - prior) : prior;         // max possible deviation on this side
  let norm  = range > 0 ? constrain(Math.abs(dev) / range, 0, 1) : 0;

  let amp  = pow(norm, 0.45) * 0.5; // compress range: 0..0.5 curved
  let bVis = 0.5 + sign * amp;      // remapped back to 0..1
  bVis = constrain(bVis, 0, 1);

  if (bVis < 0.5) {
    // cyan (0,220,220) → neutral (150,155,170)
    let t = bVis * 2;
    return color(
      lerp(0,   150, t),
      lerp(220, 155, t),
      lerp(220, 170, t)
    );
  } else {
    // neutral (150,155,170) → red (245,50,50)
    let t = (bVis - 0.5) * 2;
    return color(
      lerp(150, 245, t),
      lerp(155, 50,  t),
      lerp(170, 50,  t)
    );
  }
}

function toggleMenu() {
  menuOpen = !menuOpen;
  menuPanel.style("display", menuOpen ? "block" : "none");
  if (menuOpen) {
    rebuildMenuPanel();
    closeAnalysePanel(); // only one top-bar menu open at a time
  }
}

function closeMenu() {
  menuOpen = false;
  menuPanel.style("display", "none");
}

// ─── SERIALISE / LOAD ─────────────────────────────────────────────────────────

function serialiseNetwork(name) {
  // Serialises the current network to a plain JSON-safe object.
  //
  // Node fields saved:
  //   id, label, group         — identity
  //   x (fraction of width)    — horizontal position
  //   y (fraction of usable band, topBand..botBand) — vertical position
  //   r                        — circle radius (circle shape)
  //   rw, rh                   — rect width/height in px (rect shape), user-adjusted
  //   fontSize                 — label font size, user-adjusted via scroll
  //   shape                    — "circle" or "rect"
  //   colR, colG, colB         — node fill colour as rgb integers
  //
  // Edge fields saved:
  //   id, from, to             — identity and connectivity
  //   thickness                — line weight, user-adjusted via scroll
  //   linkState                — "facilitate" | "inhibit" | "off"
  //   direction                — "to" | "from" | "both"
  //   curve                    — bezier bend amount, user-adjusted via drag
  //
  // Belief/analysis state is intentionally NOT saved — it resets each session.
  let topBand = 60, botBand = height - 140;
  return {
    name,
    nodes: nodes.map(n => ({
      id:        n.id,
      label:     n.label,
      group:     n.group,
      x:         n.x / width,
      // Store y relative to the usable band (same as export function)
      y:         (n.y - topBand) / (botBand - topBand),
      r:         n.r,
      fontSize:  n.fontSize,
      shape:     n.shape,
      rw:        n.rw,
      rh:        n.rh,
      // Store colour as rgb so it survives JSON round-trip
      colR:      Math.round(red(n.col)),
      colG:      Math.round(green(n.col)),
      colB:      Math.round(blue(n.col)),
    })),
    edges: edges.map(e => ({
      id:        e.id,
      from:      e.from,
      to:        e.to,
      thickness: e.thickness,
      linkState: e.linkState,
      direction: e.direction,
      curve:     e.curve || 0,   // bezier bend value
    })),
  };
}

function loadNetwork(data) {
  // Set global shape from preset if provided
  if (data.shape) nodeShape = data.shape;
  nodes = data.nodes.map(n => {
    // positions may be fractions (0-1) or legacy absolute pixels
    // X is always stored as a fraction of canvas width
    let x = n.x <= 1 ? n.x * width : n.x;

    // Y coordinate: two storage formats exist —
    //   New format (serialiseNetwork v25+): fraction of usable band (topBand..botBand)
    //   Old format (raw height fraction or absolute pixels)
    // We always store in usable-band format going forward.
    let topBand = 60, botBand = height - 140;
    let y;
    if (n.y > 1) {
      y = n.y; // already absolute pixels (very old saves)
    } else {
      y = topBand + n.y * (botBand - topBand); // fraction of usable band
    }

    // rw/rh stored as absolute pixels — keep as-is (> 1 = already absolute)
    if (n.rw && n.rw > 1) { /* already absolute */ }
    else if (n.rw) { n.rw = n.rw * width; n.rh = n.rh * height; }
    // Resolve colour — priority order:
    //   1. paletteName (from export)
    //   2. colR/colG/colB (from serialiseNetwork)
    //   3. group default (legacy / new nodes)
    let col = NODE_COLORS[n.group] || NODE_COLORS.affect;
    let nodeCol;
    if (n.paletteName) {
      let pc = PALETTE.find(function(p) { return p.label === n.paletteName; });
      nodeCol = pc ? color(pc.r, pc.g, pc.b) : color(col[0], col[1], col[2]);
    } else if (n.colR !== undefined) {
      nodeCol = color(n.colR, n.colG, n.colB);
    } else {
      nodeCol = color(col[0], col[1], col[2]);
    }
    return {
      id: n.id, label: n.label, x, y,
      col:      nodeCol,
      r:        n.r        || 34,
      fontSize: n.fontSize || 18,
      group:    n.group    || "affect",
      shape:    n.shape    || data.shape || "circle",
      rw:       n.rw       || 160,
      rh:       n.rh       || 62,
      prior:    n.prior    || 0.5,
    };
  });

  edges = data.edges.map(e => ({
    id:        e.id,
    from:      e.from,
    to:        e.to,
    thickness: e.thickness || 5,
    linkState: e.linkState || "facilitate",
    direction: e.direction || "to",
    curve:     e.curve     || 0,
  }));

  // Do NOT call fitRectToText here — rw/rh are explicitly saved and restored,
  // so we preserve any user-adjusted sizes. fitRectToText is only for new nodes.
  // Derive prior from node size, then initialise belief state fresh.
  nodes.forEach(function(n) {
    updateNodePrior(n);
    n.belief = n.prior; n.displayBelief = n.prior;
  });
  particles = [];
  pendingSpawns = [];

  // Re-establish origin/pain references
  originNode = nodes.find(n => n.group === "origin") || null;
  painNode   = nodes.find(n => n.group === "pain")   || null;

  // Jump to phase 1 if we have nodes
  if (nodes.length > 0) {
    phase = 1;
    promptLabel.html("🔵 &nbsp;What does this affect? &nbsp;<span style='font-size:14px;color:#888'>double-click a node to edit</span>");
    inputBox.value("");
  }
}

// ─── PHASES ──────────────────────────────────────────────────────────────────

function setPhase(p) {
  phase = p;
  promptLabel.html(p === 0
    ? "🔴 &nbsp;How did your pain begin?"
    : "🔵 &nbsp;What does this affect? &nbsp;<span style='font-size:14px;color:#888'>double-click a node to edit</span>"
  );
  inputBox.value(""); inputBox.elt.focus();
}

function handleSubmit() {
  let val = inputBox.value().trim();
  if (val === "") return;
  closePopup();
  if (phase === 0) {
    let cx = width / 2, cy = height / 2;
    originNode = makeNode(val, cx - 200, cy - 120, NODE_COLORS.origin, null, "origin", nodeShape, 160, 62);
    fitRectToText(originNode); updateNodePrior(originNode); originNode.belief = originNode.prior; originNode.displayBelief = originNode.prior;
    nodes.push(originNode);
    painNode = makeNode("Pain", cx, cy - 40, NODE_COLORS.pain, 50, "pain", nodeShape, 140, 62);
    fitRectToText(painNode); updateNodePrior(painNode); painNode.belief = painNode.prior; painNode.displayBelief = painNode.prior;
    nodes.push(painNode);
    edges.push(makeEdge(originNode.id, painNode.id, 6, "facilitate", "to"));
    setPhase(1);
  } else {
    let affectCount = nodes.filter(n => n.group === "affect").length;
    let angle = affectCount * (TWO_PI / 6) - PI / 3;
    let x = painNode ? painNode.x + cos(angle) * 170 : width/2 + cos(angle)*170;
    let y = painNode ? painNode.y + sin(angle) * 170 : height/2 + sin(angle)*170;
    let n = makeNode(val, x, y, NODE_COLORS.affect, null, "affect", nodeShape, 160, 62);
    fitRectToText(n); updateNodePrior(n); n.belief = n.prior; n.displayBelief = n.prior;
    nodes.push(n);
    if (painNode) edges.push(makeEdge(painNode.id, n.id, 5, "facilitate", "to"));
    setPhase(1);
  }
}

// ─── FACTORIES ───────────────────────────────────────────────────────────────
// makeNode and makeEdge are the sole constructors for network elements.
// All code that creates nodes/edges should use these — never build objects
// inline — so that the data shape stays consistent throughout.

function makeNode(label, x, y, col, fixedR, group, shape, rw, rh) {
  // Use max existing id + 1 rather than nodes.length, so IDs remain unique
  // even after deletions (nodes.length decreases but old IDs should not be reused).
  let newId = nodes.length === 0 ? 0 : Math.max(...nodes.map(n => n.id)) + 1;
  let r = fixedR || (28 + min(label.length * 1.2, 18));
  shape = shape || "circle";
  return {
    id:       newId,
    label, x, y,
    col:      color(col[0], col[1], col[2]),
    r,
    fontSize: group === "pain" ? 22 : 18,
    group:    group || "affect",
    shape:    shape,
    rw:       rw || 160,
    rh:       rh || 62,
    prior:    0.5,  // baseline probability before any evidence (0-1)
  };
}

function makeEdge(fromId, toId, thickness, linkState, direction) {
  return {
    id: edges.length,
    from: fromId, to: toId,
    thickness: thickness || 5,
    linkState: linkState || "facilitate",
    direction: direction  || "to",
    curve:     0,
  };
}

// ─── SCROLL ──────────────────────────────────────────────────────────────────
// Scroll wheel has three behaviours depending on what is under the mouse:
//   hoveredNode  → resize node (rw/rh for rect, r for circle) + fontSize
//   hoveredEdge  → adjust line thickness
//   empty canvas → pan/zoom the whole view

function handleWheel(e) {
  if (mouseY > height - 130) return;
  e.preventDefault();

  if (hoveredNode) {
    let d = e.deltaY > 0 ? -3 : 3;
    if (hoveredNode.shape === "rect") {
      hoveredNode.rw       = constrain(hoveredNode.rw + d * 2.4, 40, 400);
      hoveredNode.rh       = constrain(hoveredNode.rh + d * 1.2, 24, 200);
      hoveredNode.fontSize = constrain(hoveredNode.fontSize + d * 0.25, 7, 36);
    } else {
      hoveredNode.r        = constrain(hoveredNode.r + d, 16, 120);
      hoveredNode.fontSize = constrain(hoveredNode.fontSize + d * 0.4, 8, 36);
    }
    // Node size drives the prior — update it whenever size changes
    updateNodePrior(hoveredNode);
    return;
  }

  if (hoveredEdge) {
    let d = e.deltaY > 0 ? -0.7 : 0.7;
    hoveredEdge.thickness = constrain(hoveredEdge.thickness + d, 0.5, 24);
    return;
  }

  // Nothing hovered — zoom the whole view around the mouse point
  let zoomFactor = e.deltaY > 0 ? 0.955 : 1.045;
  let newScale = constrain(viewScale * zoomFactor, 0.15, 5);
  // Zoom toward mouse position
  viewX = mouseX - (mouseX - viewX) * (newScale / viewScale);
  viewY = mouseY - (mouseY - viewY) * (newScale / viewScale);
  viewScale = newScale;
}

// ─── ARROW DRAWING ───────────────────────────────────────────────────────────

function drawArrow(e) {
  let a = getNode(e.from), b = getNode(e.to);
  if (!a || !b) return;

  let lc    = LINK_COLORS[e.linkState];
  let isHov = hoveredEdge && hoveredEdge.id === e.id;
  let alpha = isHov ? 255 : 200;
  let t     = e.thickness;
  let cv    = e.curve || 0;  // -1.2 to 1.2

  let headLen   = constrain(t * 4,   10, 36);
  let headWidth = constrain(t * 2.5,  7, 24);

  // Straight-line angle for node edge intersection
  let angle  = atan2(b.y - a.y, b.x - a.x);
  let startPt = nodeEdgePoint(a, angle);
  let endPt   = nodeEdgePoint(b, angle + PI);
  let sx = startPt.x, sy = startPt.y;
  let ex = endPt.x,   ey = endPt.y;

  // Control point — offset perpendicular to the line, scaled by curve value
  let dx = ex - sx, dy = ey - sy;
  let len = sqrt(dx*dx + dy*dy);
  let perpX = -dy / len, perpY = dx / len;  // unit perpendicular
  let bulge = len * cv * 0.4;
  let cpx = (sx + ex) / 2 + perpX * bulge;
  let cpy = (sy + ey) / 2 + perpY * bulge;

  // Tangent angle at endpoint (from control point toward end)
  let endAngle   = atan2(ey - cpy, ex - cpx);
  let startAngle = atan2(sy - cpy, sx - cpx);

  // Pull shaft endpoints back from node edges along curve tangents
  let shaftEx = ex - cos(endAngle)   * headLen * 0.85;
  let shaftEy = ey - sin(endAngle)   * headLen * 0.85;
  let shaftSx = sx - cos(startAngle) * headLen * 0.85;  // back toward cp
  let shaftSy = sy - sin(startAngle) * headLen * 0.85;

  // Glow on hover
  if (isHov) {
    stroke(lc.r, lc.g, lc.b, 45);
    strokeWeight(t + 14);
    noFill();
    if (abs(cv) < 0.01) {
      line(sx, sy, ex, ey);
    } else {
      beginShape(); vertex(sx, sy); quadraticVertex(cpx, cpy, ex, ey); endShape();
    }
  }

  stroke(lc.r, lc.g, lc.b, alpha);
  strokeWeight(t);
  noFill();

  // Draw curved shaft
  if (abs(cv) < 0.01) {
    // Straight — use line segments as before
    if (e.direction === "to") {
      line(sx, sy, shaftEx, shaftEy);
    } else if (e.direction === "from") {
      line(shaftSx, shaftSy, ex, ey);
    } else {
      line(shaftSx, shaftSy, shaftEx, shaftEy);
    }
  } else {
    // Curved — bezier shaft, clipped near heads
    if (e.direction === "to") {
      beginShape(); vertex(sx, sy); quadraticVertex(cpx, cpy, shaftEx, shaftEy); endShape();
    } else if (e.direction === "from") {
      beginShape(); vertex(shaftSx, shaftSy); quadraticVertex(cpx, cpy, ex, ey); endShape();
    } else {
      beginShape(); vertex(shaftSx, shaftSy); quadraticVertex(cpx, cpy, shaftEx, shaftEy); endShape();
    }
  }

  // Arrowheads — angle follows curve tangent
  if (e.direction === "to" || e.direction === "both") {
    drawArrowHead(ex, ey, endAngle, headLen, headWidth, lc, alpha);
  }
  if (e.direction === "from" || e.direction === "both") {
    drawArrowHead(sx, sy, startAngle, headLen, headWidth, lc, alpha);
  }
}

function drawArrowHead(tx, ty, ang, headLen, headWidth, lc, alpha) {
  push();
  translate(tx, ty); rotate(ang);
  fill(lc.r, lc.g, lc.b, alpha); noStroke();
  triangle(0, 0, -headLen, headWidth/2, -headLen, -headWidth/2);
  pop();
}

// ─── DELETE NODE ─────────────────────────────────────────────────────────────

function deleteNode(nodeId) {
  nodes = nodes.filter(n => n.id !== nodeId);
  edges = edges.filter(e => e.from !== nodeId && e.to !== nodeId);
  if (originNode && originNode.id === nodeId) originNode = null;
  if (painNode   && painNode.id   === nodeId) painNode   = null;
  closePopup();
}

// ─── EDIT MENU ───────────────────────────────────────────────────────────────

function openEditMenu(sourceNode) {
  if (popup) { popup.remove(); popup = null; }
  popupSource = sourceNode;

  popup = createDiv("");
  popup.style("position",      "absolute");
  popup.style("background",    "#fafafa");
  popup.style("border",        "2px solid #7788cc");
  popup.style("border-radius", "14px");
  popup.style("padding",       "14px 18px");
  popup.style("box-shadow",    "0 8px 28px rgba(0,0,0,0.22)");
  popup.style("font-family",   "Georgia, serif");
  popup.style("min-width",     "280px");
  popup.style("max-width",     "340px");
  popup.style("z-index",       "999");
  popup.style("max-height",    (height - 160) + "px");
  popup.style("overflow-y",    "auto");

  // Convert world coordinates to screen coordinates for the popup position.
  // sourceNode.x/y are in world space; we need screen space for DOM positioning.
  let screenNx = sourceNode.x * viewScale + viewX;
  let screenNy = sourceNode.y * viewScale + viewY;
  // Node half-size in screen space (approx)
  let screenHW = ((sourceNode.rw || sourceNode.r * 2 || 80) / 2) * viewScale;
  let px = constrain(screenNx + screenHW + 12, 10, width  - 360);
  let py = constrain(screenNy - 24,             10, height - 440);
  popup.position(px, py);
  popup.elt.addEventListener("mousedown", (e) => e.stopPropagation());

  // Name row
  let nameRow = createDiv("");
  nameRow.style("display","flex"); nameRow.style("align-items","center");
  nameRow.style("gap","8px"); nameRow.style("margin-bottom","10px");
  nameRow.style("border-bottom","1px solid #dde"); nameRow.style("padding-bottom","10px");
  nameRow.parent(popup);

  createSpan("✏️").parent(nameRow);

  let nameInput = createElement("input");
  nameInput.elt.type = "text"; nameInput.elt.value = sourceNode.label;
  nameInput.style("font-family","Georgia, serif"); nameInput.style("font-size","15px");
  nameInput.style("font-weight","bold"); nameInput.style("color","#222");
  nameInput.style("border","none"); nameInput.style("border-bottom","2px dashed #aab");
  nameInput.style("background","transparent"); nameInput.style("outline","none");
  nameInput.style("flex","1"); nameInput.style("min-width","0"); nameInput.style("padding","2px 4px");
  nameInput.parent(nameRow);

  function confirmName() {
    let v = nameInput.elt.value.trim();
    if (v !== "" && v !== sourceNode.label) {
      sourceNode.label = v;
      // Resize the box to fit the new label text
      if (sourceNode.shape === "rect") fitRectToText(sourceNode);
    }
  }
  nameInput.elt.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { confirmName(); nameInput.elt.blur(); }
    e.stopPropagation();
  });
  nameInput.elt.addEventListener("blur", confirmName);

  // Colour swatches
  let swatchRow = createDiv("");
  swatchRow.style("display","flex"); swatchRow.style("gap","5px");
  swatchRow.style("align-items","center");
  swatchRow.parent(nameRow);

  PALETTE.forEach(function(pc) {
    let sw = createDiv("");
    sw.style("width","18px"); sw.style("height","18px");
    sw.style("border-radius","4px"); sw.style("cursor","pointer");
    sw.style("flex-shrink","0");
    sw.style("background","rgb("+pc.r+","+pc.g+","+pc.b+")");
    let isActive = (red(sourceNode.col)===pc.r && green(sourceNode.col)===pc.g && blue(sourceNode.col)===pc.b);
    sw.style("outline", isActive ? "2px solid #222" : "2px solid transparent");
    sw.style("outline-offset","1px");
    sw.parent(swatchRow);
    sw.elt.title = pc.label;
    sw.elt.addEventListener("click", function() {
      sourceNode.col = color(pc.r, pc.g, pc.b);
      // Refresh outlines
      swatchRow.elt.querySelectorAll("div").forEach(function(el, i) {
        el.style.outline = (i === PALETTE.indexOf(pc)) ? "2px solid #222" : "2px solid transparent";
      });
    });
  });

  let delBtn = createButton("🗑");
  delBtn.style("background","transparent"); delBtn.style("border","1.5px solid #dbb");
  delBtn.style("border-radius","7px"); delBtn.style("cursor","pointer");
  delBtn.style("font-size","15px"); delBtn.style("padding","3px 8px");
  delBtn.style("color","#b44"); delBtn.style("flex-shrink","0");
  delBtn.parent(nameRow);

  let deleteConfirmed = false;
  delBtn.mousePressed(() => {
    if (!deleteConfirmed) {
      deleteConfirmed = true;
      delBtn.elt.textContent = "sure?";
      delBtn.style("background","#fdd"); delBtn.style("border-color","#c44"); delBtn.style("color","#c00");
      setTimeout(() => {
        if (deleteConfirmed && popup) {
          deleteConfirmed = false;
          delBtn.elt.textContent = "🗑";
          delBtn.style("background","transparent"); delBtn.style("border-color","#dbb"); delBtn.style("color","#b44");
        }
      }, 2000);
    } else { deleteNode(sourceNode.id); }
  });

  // Column headers
  let headerRow = createDiv("");
  headerRow.style("display","flex"); headerRow.style("align-items","center");
  headerRow.style("gap","8px"); headerRow.style("margin-bottom","4px");
  headerRow.parent(popup);
  let h1 = createDiv("node"); h1.style("font-size","10px"); h1.style("color","#bbb"); h1.style("flex","1"); h1.parent(headerRow);
  let h2 = createDiv("link type"); h2.style("font-size","10px"); h2.style("color","#bbb"); h2.style("min-width","72px"); h2.style("text-align","center"); h2.parent(headerRow);
  let h3 = createDiv("direction"); h3.style("font-size","10px"); h3.style("color","#bbb"); h3.style("min-width","44px"); h3.style("text-align","center"); h3.parent(headerRow);

  let linkSection = createDiv("");
  linkSection.parent(popup);
  buildLinkRows(sourceNode, linkSection);

  // ── Add connected node ───────────────────────────────────────────────────
  let addDiv = createDiv("");
  addDiv.style("border-top","1px solid #dde");
  addDiv.style("margin-top","10px");
  addDiv.style("padding-top","10px");
  addDiv.parent(popup);

  let addLabel = createDiv("＋ Add a connected node");
  addLabel.style("font-size","11px"); addLabel.style("font-weight","bold");
  addLabel.style("color","#7788cc"); addLabel.style("margin-bottom","6px");
  addLabel.style("text-transform","uppercase"); addLabel.style("letter-spacing","0.05em");
  addLabel.parent(addDiv);

  let addRow = createDiv("");
  addRow.style("display","flex"); addRow.style("gap","6px"); addRow.style("align-items","center");
  addRow.parent(addDiv);

  let addInput = createElement("input");
  addInput.elt.type = "text";
  addInput.elt.placeholder = "New node name…";
  addInput.style("font-family","Georgia, serif"); addInput.style("font-size","13px");
  addInput.style("padding","5px 8px"); addInput.style("flex","1");
  addInput.style("border","1.5px solid #aab"); addInput.style("border-radius","6px");
  addInput.style("outline","none"); addInput.style("min-width","0");
  addInput.parent(addRow);
  addInput.elt.addEventListener("keydown", function(ev) {
    ev.stopPropagation();
    if (ev.key === "Enter") doAddNode();
  });

  let addBtn = createButton("Add");
  addBtn.style("font-family","Georgia, serif"); addBtn.style("font-size","13px");
  addBtn.style("padding","5px 10px"); addBtn.style("flex-shrink","0");
  addBtn.style("background","#5566bb"); addBtn.style("color","white");
  addBtn.style("border","none"); addBtn.style("border-radius","6px");
  addBtn.style("cursor","pointer");
  addBtn.parent(addRow);

  function doAddNode() {
    let label = addInput.elt.value.trim();
    if (!label) return;

    // Place new node offset from sourceNode in a sensible direction
    // Try to find a gap — spread around source in 60° steps
    let placed = false;
    let newX, newY;
    let spread = 200; // distance from source node in world coords
    for (let attempt = 0; attempt < 12; attempt++) {
      let ang = (attempt * 30) * (PI / 180);
      let cx = sourceNode.x + cos(ang) * spread;
      let cy = sourceNode.y + sin(ang) * spread;
      // Check no existing node is too close
      let tooClose = nodes.some(function(n) {
        return dist(cx, cy, n.x, n.y) < 120;
      });
      if (!tooClose) { newX = cx; newY = cy; placed = true; break; }
    }
    if (!placed) {
      // Fall back: just offset right and down
      newX = sourceNode.x + 220;
      newY = sourceNode.y + 80;
    }

    // Create node — inherit shape from source, use affect colour
    let col = NODE_COLORS.affect;
    let newNode = makeNode(label, newX, newY, col, null, "affect",
                           nodeShape, sourceNode.rw || 160, sourceNode.rh || 62);
    if (newNode.shape === "rect") fitRectToText(newNode);
    updateNodePrior(newNode);
    newNode.belief = newNode.prior;
    newNode.displayBelief = newNode.prior;
    nodes.push(newNode);

    // Connect source → new node (facilitate, to direction by default)
    edges.push(makeEdge(sourceNode.id, newNode.id, 5, "facilitate", "to"));

    // Refresh menu so new node appears in the link list
    openEditMenu(sourceNode);
  }

  addBtn.mousePressed(doAddNode);
}

function buildLinkRows(sourceNode, container) {
  container.elt.innerHTML = "";
  let others = nodes.filter(n => n.id !== sourceNode.id);
  for (let target of others) {
    let edge  = getEdgeBetween(sourceNode.id, target.id);
    let state = edge ? edge.linkState : "off";
    let dir   = edge ? edge.direction : "to";

    let row = createDiv("");
    row.style("display","flex"); row.style("align-items","center");
    row.style("gap","8px"); row.style("margin","5px 0");
    row.parent(container);

    let lbl = createDiv(target.label);
    lbl.style("font-size","13px"); lbl.style("color","#333"); lbl.style("flex","1");
    lbl.style("overflow","hidden"); lbl.style("white-space","nowrap"); lbl.style("text-overflow","ellipsis");
    lbl.parent(row);

    let cfg = badgeConfig(state);
    let typBtn = createButton(cfg.label);
    typBtn.style("font-family","Georgia, serif"); typBtn.style("font-size","12px");
    typBtn.style("padding","4px 8px"); typBtn.style("border-radius","20px");
    typBtn.style("border","1.5px solid " + cfg.border); typBtn.style("background",cfg.bg);
    typBtn.style("color",cfg.txt); typBtn.style("cursor","pointer");
    typBtn.style("white-space","nowrap"); typBtn.style("min-width","72px"); typBtn.style("text-align","center");
    typBtn.parent(row);

    let dirBtn = createButton("");
    styleDirBtn(dirBtn, state, dir);
    dirBtn.parent(row);

    typBtn.mousePressed(() => {
      cycleLink(sourceNode.id, target.id, edge);
      edge = getEdgeBetween(sourceNode.id, target.id);
      let newState = edge ? edge.linkState : "off";
      let newCfg = badgeConfig(newState);
      typBtn.elt.textContent = newCfg.label;
      typBtn.style("border","1.5px solid " + newCfg.border);
      typBtn.style("background",newCfg.bg); typBtn.style("color",newCfg.txt);
      styleDirBtn(dirBtn, newState, edge ? edge.direction : "to");
    });

    dirBtn.mousePressed(() => {
      if (!edge || edge.linkState === "off") return;
      edge.direction = DIR_CYCLE[edge.direction];
      styleDirBtn(dirBtn, edge.linkState, edge.direction);
    });
  }
}

function styleDirBtn(btn, linkState, dir) {
  let isOff = !linkState || linkState === "off";
  btn.elt.textContent = isOff ? "" : DIR_GLYPHS[dir];
  btn.style("font-size","18px"); btn.style("font-family","Arial, sans-serif");
  btn.style("width","36px"); btn.style("height","32px"); btn.style("padding","0");
  btn.style("border-radius","7px"); btn.style("text-align","center"); btn.style("line-height","30px");
  btn.style("cursor", isOff ? "default" : "pointer");
  btn.style("border", isOff ? "1.5px solid #eee" : "1.5px solid #aac");
  btn.style("background", isOff ? "#f8f8f8" : "#eef");
  btn.style("color", isOff ? "#ccc" : "#446");
  btn.style("flex-shrink","0");
}

function badgeConfig(state) {
  if (state === "facilitate") return { label:"● more", bg:"#fde8e8", txt:"#c02020", border:"#e08080" };
  if (state === "inhibit")    return { label:"● less", bg:"#e0f8f8", txt:"#0a8080", border:"#50c8c8" };
  return { label:"＋ connect", bg:"#f0f0f0", txt:"#555", border:"#ccc" };
}

function cycleLink(fromId, toId, existingEdge) {
  if (!existingEdge || existingEdge.linkState === "off") {
    if (existingEdge) existingEdge.linkState = "facilitate";
    else edges.push(makeEdge(fromId, toId, 5, "facilitate", "to"));
  } else if (existingEdge.linkState === "facilitate") {
    existingEdge.linkState = "inhibit";
  } else { existingEdge.linkState = "off"; }
}

// Returns the first edge connecting idA and idB in either direction.
// Note: if two separate edges exist between the same pair of nodes (rare but
// possible via the node menu), only the first one found is returned.
// The UI currently prevents true duplicates because linkState "off" is used
// to disable a connection rather than creating a second edge.
function getEdgeBetween(idA, idB) {
  return edges.find(e => (e.from===idA && e.to===idB) || (e.from===idB && e.to===idA));
}

function closePopup() {
  if (popup) { popup.remove(); popup = null; popupSource = null; }
}

// ─── DRAW ────────────────────────────────────────────────────────────────────
// The draw() loop runs every frame. All world-space content is drawn inside
// push()/translate(viewX,viewY)/scale(viewScale)/pop() so pan and zoom work
// automatically. UI elements (menus, hint bar) are drawn outside this transform.

// Convert screen coords to world coords
function screenToWorld(sx, sy) {
  return { x: (sx - viewX) / viewScale, y: (sy - viewY) / viewScale };
}

function draw() {
  background(246, 246, 252);
  autosaveTick();

  // Tick down input flash
  if (inputFlash && inputFlash.frames > 0) inputFlash.frames--;

  // Animate displayBelief toward target belief for each node
  if (analyseMode) {
    for (let i = 0; i < nodes.length; i++) {
      let n = nodes[i];
      if (n.displayBelief === undefined) n.displayBelief = n.belief || 0.5;
      n.displayBelief += (n.belief - n.displayBelief) * BELIEF_LERP;
    }
    // Advance particles, and fire any cascade waves whose time has come
    tickParticles();
    processPendingSpawns();
  }

  // Hover detection in world coords
  hoveredNode = null; hoveredEdge = null;
  if (mouseY < height - 130 && !popup && !menuOpen) {
    let wm = screenToWorld(mouseX, mouseY);
    for (let n of nodes) {
      if (nodeHitTest(n, wm.x, wm.y)) { hoveredNode = n; break; }
    }
    if (!hoveredNode) {
      for (let e of edges) {
        if (e.linkState === "off") continue;
        let a = getNode(e.from), b = getNode(e.to);
        if (!a || !b) continue;
        let hitDist = (e.thickness / 2 + 10) / viewScale;
        if (distToEdge(wm.x, wm.y, a, b, e.curve || 0) < hitDist) {
          hoveredEdge = e; break;
        }
      }
    }
  }

  // Apply pan/zoom transform for world content
  push();
  translate(viewX, viewY);
  scale(viewScale);

  stroke(200, 200, 220, 70); strokeWeight(1.5);
  for (let x = 30; x < width / viewScale; x += 40)
    for (let y = 60; y < (height - 130) / viewScale; y += 40)
      point(x, y);

  for (let e of edges) {
    if (e.linkState === "off") continue;
    drawArrow(e);
  }

  // Draw belief particles travelling along edges
  if (analyseMode) drawParticles();

  for (let n of nodes) {
    drawNode(n);
  }

  pop(); // end world transform

  // UI drawn in screen space (no transform)
  noStroke(); fill(50,50,80);
  textSize(18); textStyle(BOLD); textAlign(LEFT,TOP);
  // Title — no longer needed, menu button serves as identifier

  updateHint();
  stroke(180,180,210,100); strokeWeight(1);
  line(0, height-120, width, height-120);


  // Propagation debug overlay — top-right, shown when showDebug is on
  if (showDebug && debugLines.length > 0) {
    let ctx = drawingContext;
    ctx.save();
    ctx.font = "11px monospace";
    let lineH = 14, padX = 8, padY = 6;
    let maxW = 0;
    debugLines.forEach(function(l) { maxW = Math.max(maxW, ctx.measureText(l).width); });
    let bx = width - maxW - padX * 2 - 10;
    let by = 60;
    ctx.fillStyle = "rgba(20,20,40,0.85)";
    ctx.fillRect(bx - padX, by - padY, maxW + padX * 2, debugLines.length * lineH + padY * 2);
    ctx.fillStyle = "#aef";
    debugLines.forEach(function(l, i) {
      ctx.fillText(l, bx, by + i * lineH + lineH * 0.7);
    });
    ctx.restore();
  }
}

function updateHint() {
  if (popupSource) {
    hintLabel.html("✏️ editing <b>" + popupSource.label + "</b> &nbsp;·&nbsp; click outside to close");
  } else if (hoveredNode) {
    if (analyseMode) {
      let b = hoveredNode.belief !== undefined ? round(hoveredNode.belief * 100) : 50;
      let prior = Math.round((hoveredNode.prior || 0.5) * 100);
      hintLabel.html("🔘 <b>" + hoveredNode.label + "</b> &nbsp; belief: <b>" + b + "%</b> &nbsp; prior: <b>" + prior + "%</b> (scroll to change) &nbsp;·&nbsp; <b>= / +</b> more &nbsp;·&nbsp; <b>−</b> fewer");
    } else {
      hintLabel.html("🔘 <b>" + hoveredNode.label + "</b> &nbsp;·&nbsp; scroll to resize &nbsp;·&nbsp; double-click to edit &nbsp;·&nbsp; drag to move");
    }
  } else if (hoveredEdge) {
    let a = getNode(hoveredEdge.from), b = getNode(hoveredEdge.to);
    hintLabel.html("➖ <b>" + a.label + " → " + b.label + "</b> &nbsp;·&nbsp; scroll = thickness &nbsp;·&nbsp; drag = bend curve");
  } else {
    if (analyseMode) {
      hintLabel.html("ANALYSE: hover a node then press &nbsp;<b>= / +</b>&nbsp; more problems &nbsp;·&nbsp; <b>−</b>&nbsp; fewer problems");
    } else {
      hintLabel.html("hover node/link + scroll to resize &nbsp;·&nbsp; drag blank space to pan &nbsp;·&nbsp; scroll blank space to zoom");
    }
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
// Pure utility functions with no side effects.
// nodeEdgePoint  — finds where a line exits a node boundary (circle or rect)
// nodeHitTest    — returns true if a world-space point is inside a node
// drawNode       — renders a single node with all visual states
// drawPainDial   — renders the belief arc indicator around the Pain node
// fitRectToText  — calculates minimum rw/rh to contain wrapped label text
// measureWrappedText — word-wraps text to a max width, returns line array
// drawWrappedText    — renders wrapped text using canvas 2D API for text stroke
// getNode        — looks up a node by id (O(n), fine for small networks)
// distToEdge     — minimum distance from a point to a bezier curve (sampled)
// distToSegment  — minimum distance from a point to a line segment

// Returns point on node boundary in direction of angle
function nodeEdgePoint(n, angle) {
  if (n.shape === "rect") {
    // Ray-AABB intersection
    let hw = n.rw / 2, hh = n.rh / 2;
    let dx = cos(angle), dy = sin(angle);
    let tx = dx !== 0 ? hw / abs(dx) : 999999;
    let ty = dy !== 0 ? hh / abs(dy) : 999999;
    let t  = min(tx, ty);
    return { x: n.x + dx * t, y: n.y + dy * t };
  }
  return { x: n.x + cos(angle) * n.r, y: n.y + sin(angle) * n.r };
}

// Hit test respecting shape
function nodeHitTest(n, mx, my) {
  if (n.shape === "rect") {
    let hw = n.rw / 2 + 6, hh = n.rh / 2 + 6;
    return mx >= n.x - hw && mx <= n.x + hw && my >= n.y - hh && my <= n.y + hh;
  }
  return dist(mx, my, n.x, n.y) < n.r + 6;
}

// Draw a node as circle or rounded rect
function drawNode(n) {
  let isHov     = hoveredNode && hoveredNode.id === n.id;
  let isMenuSrc = popupSource  && popupSource.id  === n.id;

  if (n.shape === "rect") {
    let hw = n.rw / 2, hh = n.rh / 2;
    let cr = 10;

    if (isHov)     { noStroke(); fill(255,255,255,80); rect(n.x-hw-10, n.y-hh-10, n.rw+20, n.rh+20, cr+4); }
    if (isMenuSrc) { noStroke(); fill(120,140,255,70); rect(n.x-hw-8,  n.y-hh-8,  n.rw+16, n.rh+16, cr+3); }

    // Shadow
    noStroke(); fill(0,0,0,18);
    rect(n.x-hw+4, n.y-hh+5, n.rw, n.rh, cr);

    // Body
    stroke(isHov ? color(255,255,255,230) : color(255,255,255,160));
    strokeWeight(isHov ? 4 : 3);
    fill(analyseMode && n.displayBelief !== undefined ? beliefColor(n.displayBelief, n.prior) : n.col);
    rect(n.x-hw, n.y-hh, n.rw, n.rh, cr);

    // Input flash overlay
    if (inputFlash && inputFlash.nodeId === n.id && inputFlash.frames > 0) {
      let alpha = map(inputFlash.frames, 0, 18, 0, 120);
      noStroke();
      fill(inputFlash.direction === "facilitate" ? color(240,60,60,alpha) : color(0,220,220,alpha));
      rect(n.x-hw, n.y-hh, n.rw, n.rh, cr);
    }

    // Pain dial for rect pain node
    if (analyseMode && n.group === "pain") drawPainDial(n);

    // Label — white fill with dark stroke outline for legibility
    textAlign(CENTER,CENTER); textStyle(BOLD); textSize(n.fontSize);
    stroke(30, 30, 50, 180); strokeWeight(3);
    fill(255);
    drawWrappedText(n.label, n.x, n.y, n.rw - 28);
    noStroke();

  } else {
    if (isHov)     { noStroke(); fill(255,255,255,80); ellipse(n.x,n.y,(n.r+14)*2); }
    if (isMenuSrc) { noStroke(); fill(120,140,255,70); ellipse(n.x,n.y,(n.r+10)*2); }

    noStroke(); fill(0,0,0,20); ellipse(n.x+3,n.y+5,(n.r+5)*2);
    stroke(isHov ? color(255,255,255,230) : color(255,255,255,160));
    strokeWeight(isHov ? 4 : 3);
    fill(analyseMode && n.displayBelief !== undefined ? beliefColor(n.displayBelief, n.prior) : n.col);
    ellipse(n.x,n.y,n.r*2);

    // Input flash overlay
    if (inputFlash && inputFlash.nodeId === n.id && inputFlash.frames > 0) {
      let alpha = map(inputFlash.frames, 0, 18, 0, 120);
      noStroke();
      fill(inputFlash.direction === "facilitate" ? color(240,60,60,alpha) : color(0,220,220,alpha));
      ellipse(n.x, n.y, n.r*2);
    }

    // Pain dial — indicator ring drawn in analyse mode
    if (analyseMode && n.group === "pain") drawPainDial(n);

    // Label — white fill with dark stroke outline for legibility
    textAlign(CENTER,CENTER); textStyle(BOLD); textSize(n.fontSize);
    stroke(30, 30, 50, 180); strokeWeight(3);
    fill(255);
    drawWrappedText(n.label, n.x, n.y, n.r*1.7);
    noStroke();

  }
}

// ─── PAIN DIAL ───────────────────────────────────────────────────────────────
// Clockwise arc from bottom, tracking belief value.
// 0 = fully cyan (inhibited), 1 = fully red (facilitated).
// Drawn outside the node boundary as a thick indicator ring.

function drawPainDial(n) {
  let radius = (n.shape === "rect")
    ? sqrt((n.rw/2)*(n.rw/2) + (n.rh/2)*(n.rh/2)) + 16
    : n.r + 14;

  let b = constrain(n.displayBelief !== undefined ? n.displayBelief : 0.5, 0, 1);

  // Background track — full circle, dark
  push();
  noFill();
  stroke(30, 30, 50, 60);
  strokeWeight(8);
  ellipse(n.x, n.y, radius * 2, radius * 2);

  // Active arc — starts at bottom (PI/2 + PI = 3*PI/2 in p5 coords = HALF_PI + PI)
  // Clockwise: from bottom going clockwise back to bottom
  // In p5: angles go clockwise, 0 = right, HALF_PI = bottom
  let startAngle = HALF_PI;              // bottom
  let sweep      = TWO_PI * b;          // 0 = none, 1 = full circle

  // Colour transitions cyan→grey→red with belief
  let dc = beliefColor(b, n.prior);
  stroke(dc);
  strokeWeight(10);
  arc(n.x, n.y, radius * 2, radius * 2, startAngle, startAngle + sweep);

  // Indicator dot at current position
  let dotAngle = startAngle + sweep;
  let dotX = n.x + cos(dotAngle) * radius;
  let dotY = n.y + sin(dotAngle) * radius;
  noStroke(); fill(dc);
  ellipse(dotX, dotY, 14, 14);

  // White centre dot
  fill(255, 255, 255, 200);
  ellipse(dotX, dotY, 6, 6);

  // Value label below dial
  noStroke();
  fill(30, 30, 50, 200);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(12);
  let pct = round(b * 100);
  let labelY = n.y + radius + 14;
  // Use drawingContext for clean text
  let ctx = drawingContext;
  ctx.save();
  ctx.font = "bold 12px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(30,30,50,0.85)";
  ctx.fillText(pct + "%", n.x, labelY);
  ctx.restore();

  pop();
}

// ─── TEXT SIZING ─────────────────────────────────────────────────────────────
// One-time sizing: wrap text at maxWrapW, then make box snug around wrapped result
function fitRectToText(n) {
  if (n.shape !== "rect") return;
  let maxWrapW = 240;   // max inner text width before wrapping
  let padX = 14, padY = 10;
  let lineH = n.fontSize * 1.4;

  // We need a canvas context for textWidth — use p5's directly
  // Push/pop text state so we don't pollute caller
  push();
  textSize(n.fontSize); textStyle(BOLD);
  let m = measureWrappedText(n.label, maxWrapW);
  pop();

  // Box = widest line + padding, lines * lineHeight + padding
  n.rw = m.maxLineW + padX * 2;
  n.rh = m.lines.length * lineH + padY * 2;
  // Enforce minimums
  n.rw = max(n.rw, 80);
  n.rh = max(n.rh, 50);
}

// Measure wrapped text without drawing — returns {lines, maxLineW}
function measureWrappedText(txt, maxW) {
  let words = txt.split(" "), lines = [], current = "";
  for (let w of words) {
    let test = current ? current + " " + w : w;
    if (textWidth(test) > maxW && current !== "") { lines.push(current); current = w; }
    else current = test;
  }
  if (current) lines.push(current);
  let maxLineW = 0;
  for (let l of lines) maxLineW = max(maxLineW, textWidth(l));
  return { lines, maxLineW };
}

function drawWrappedText(txt, x, y, maxW) {
  let words = txt.split(" "), lines = [], current = "";
  for (let w of words) {
    let test = current ? current + " " + w : w;
    if (textWidth(test) > maxW && current !== "") { lines.push(current); current = w; }
    else current = test;
  }
  if (current) lines.push(current);
  let lineH = textSize() * 1.3;
  let startY = y - ((lines.length - 1) * lineH) / 2;

  // Use canvas 2D API for proper text stroke (p5 stroke doesn't apply to text)
  let ctx = drawingContext;
  ctx.save();
  ctx.strokeStyle   = "rgba(20,20,40,0.7)";
  ctx.lineWidth     = 3;
  ctx.lineJoin      = "round";
  ctx.fillStyle     = "white";
  ctx.textAlign     = "center";
  ctx.textBaseline  = "middle";
  // Match current p5 textSize — already set by caller
  let sz = textSize();
  ctx.font = "bold " + sz + "px Georgia, serif";
  for (let i = 0; i < lines.length; i++) {
    let ly = startY + i * lineH;
    ctx.strokeText(lines[i], x, ly);
    ctx.fillText(lines[i],   x, ly);
  }
  ctx.restore();
}

function getNode(id) { return nodes.find(n => n.id === id); }

// Sample N points along the quadratic bezier and return min distance to mouse
function distToEdge(mx, my, nodeA, nodeB, curve) {
  let angle = atan2(nodeB.y - nodeA.y, nodeB.x - nodeA.x);
  let sp = nodeEdgePoint(nodeA, angle);
  let ep = nodeEdgePoint(nodeB, angle + PI);
  let sx = sp.x, sy = sp.y, ex = ep.x, ey = ep.y;

  if (abs(curve) < 0.01) {
    // Straight line
    return distToSegment(mx, my, sx, sy, ex, ey);
  }

  // Compute control point
  let dx = ex - sx, dy = ey - sy;
  let len = sqrt(dx*dx + dy*dy);
  if (len === 0) return dist(mx, my, sx, sy);
  let perpX = -dy / len, perpY = dx / len;
  let bulge = len * curve * 0.4;
  let cpx = (sx + ex) / 2 + perpX * bulge;
  let cpy = (sy + ey) / 2 + perpY * bulge;

  // Sample 20 points along the bezier Q(t) = (1-t)²P0 + 2t(1-t)CP + t²P1
  let minD = 999999;
  let STEPS = 20;
  for (let i = 0; i <= STEPS; i++) {
    let t  = i / STEPS;
    let it = 1 - t;
    let qx = it*it*sx + 2*it*t*cpx + t*t*ex;
    let qy = it*it*sy + 2*it*t*cpy + t*t*ey;
    let d  = dist(mx, my, qx, qy);
    if (d < minD) minD = d;
  }
  return minD;
}

function distToSegment(px, py, ax, ay, bx, by) {
  let dx = bx-ax, dy = by-ay, lenSq = dx*dx+dy*dy;
  if (lenSq === 0) return dist(px,py,ax,ay);
  let t = constrain(((px-ax)*dx+(py-ay)*dy)/lenSq, 0, 1);
  return dist(px,py,ax+t*dx,ay+t*dy);
}

// ─── MOUSE ───────────────────────────────────────────────────────────────────

function mousePressed() {
  if (menuOpen)         { closeMenu(); return; }
  if (analysePanelOpen) { closeAnalysePanel(); return; }
  if (popup)            { closePopup(); return; }
  pressedNode = null; dragMoved = false; isPanning = false;

  // Convert to world coords for hit testing
  let wm = screenToWorld(mouseX, mouseY);
  for (let n of nodes) {
    if (nodeHitTest(n, wm.x, wm.y)) {
      pressedNode = n; dragging = n; return;
    }
  }
  // Check for edge hit — drag to curve
  let hitDist = 10 / viewScale;
  for (let i = 0; i < edges.length; i++) {
    let e = edges[i];
    if (e.linkState === "off") continue;
    let a = getNode(e.from), b = getNode(e.to);
    if (!a || !b) continue;
    if (distToEdge(wm.x, wm.y, a, b, e.curve || 0) < hitDist) {
      draggingEdge = e;
      edgeDragStartCurve = e.curve || 0;
      // Record perpendicular component of mouse at drag start,
      // so mouseDragged can compute how far the user has pulled.
      // a and b are already fetched above — no need to re-fetch.
      let ddx = b.x - a.x, ddy = b.y - a.y;
      let ll  = sqrt(ddx*ddx + ddy*ddy) || 1;
      let perpX = -ddy / ll, perpY = ddx / ll;
      let midX  = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
      edgeDragStartY = (wm.x - midX) * perpX + (wm.y - midY) * perpY;
      return;
    }
  }

  // Nothing hit — start panning
  isPanning = true;
  panStartX = mouseX - viewX;
  panStartY = mouseY - viewY;
}

function mouseDragged() {
  if (dragging) {
    let wm = screenToWorld(mouseX, mouseY);
    dragging.x = wm.x; dragging.y = wm.y;
    dragMoved = true;
  } else if (draggingEdge) {
    let wm = screenToWorld(mouseX, mouseY);
    let e = draggingEdge;
    let a = getNode(e.from), b = getNode(e.to);
    if (a && b) {
      let ddx = b.x - a.x, ddy = b.y - a.y;
      let ll  = sqrt(ddx*ddx + ddy*ddy) || 1;
      let px  = -ddy/ll, py = ddx/ll;
      let mx  = (a.x+b.x)/2, my = (a.y+b.y)/2;
      // Current perpendicular offset
      let perpNow = (wm.x-mx)*px + (wm.y-my)*py;
      // Drag delta in perp direction → curve delta
      let perpDelta = perpNow - edgeDragStartY;
      e.curve = constrain(edgeDragStartCurve + perpDelta / (ll * 0.4), -1.5, 1.5);
    }
    dragMoved = true;
  } else if (isPanning) {
    viewX = mouseX - panStartX;
    viewY = mouseY - panStartY;
    dragMoved = true;
  }
}

function mouseReleased() {
  if (pressedNode && !dragMoved) {
    let now = millis();
    let isDouble = lastClickNode &&
                   lastClickNode.id === pressedNode.id &&
                   now - lastClickTime < DBL_CLICK_MS;
    if (isDouble) { lastClickNode = null; openEditMenu(pressedNode); }
    else          { lastClickTime = now;  lastClickNode = pressedNode; }
  }
  dragging = null; pressedNode = null; dragMoved = false; isPanning = false; draggingEdge = null;
}

// ─── KEYBOARD INPUT ──────────────────────────────────────────────────────────
// Only active in analyse mode when a node is hovered.
// = or + → apply a facilitatory signal (more problems) to the hovered node
// -       → apply an inhibitory signal (fewer problems) to the hovered node
//
// Nothing stays pinned after this. The pressed node is held at its new value
// only for the propagation run this keypress triggers (the standard FCM
// "what-if" technique: clamp the stimulus concept for one run so its ripple
// through the network can be observed), then it rejoins the network fully —
// free to be pulled around by feedback from everything downstream of it,
// same as every other node. That's what lets a single input genuinely bubble
// A→B→C and even loop back to affect the node you started with.

function keyPressed() {
  // Only act in analyse mode when a node is hovered
  if (!analyseMode || !hoveredNode) return;

  let n = hoveredNode;

  // "=" or "+" = facilitate,  "-" = inhibit
  let delta = 0;
  let direction = "";

  if (key === "=" || key === "+") {
    delta     =  SIG.med;
    direction = "facilitate";
  } else if (key === "-") {
    delta     = -SIG.med;
    direction = "inhibit";
  } else {
    return; // not our key
  }

  // Apply signal to the hovered node
  n.belief = constrain((n.belief || 0.5) + delta, 0, 1);

  // Propagate belief through the network, holding this node fixed for the
  // duration of this run only — see note above.
  propagateBelief(n.id);

  // Animate the full cascade: hop 1 out of this node now, hop 2 out of
  // whatever that reaches a little later, and so on through the network.
  scheduleCascade(n.id);

  // Flash feedback
  inputFlash = { nodeId: n.id, frames: 18, direction: direction, strength: abs(delta) };

  return false; // prevent default
}

// ─── BELIEF PROPAGATION ──────────────────────────────────────────────────────
//
// Fuzzy Cognitive Map (FCM) update — Kosko-style signed weighted propagation.
// Each edge defines a directed influence:
//
//   Edge e from node A to node B (direction "to"):
//     SENDER   = A  (the node the arrow comes FROM)
//     RECEIVER = B  (the node the arrow points TO)
//
//   If linkState = "facilitate": receiver is pushed TOWARD sender's belief
//     (sender above its own prior → receiver pushed up; sender below its own
//      prior → receiver pushed down)
//   If linkState = "inhibit":    receiver is pushed AWAY from sender's belief
//     (sender above its own prior → receiver pushed DOWN, and vice versa)
//
//   direction "to":   A→B only
//   direction "from": B→A only  (arrow visual points FROM b, so b sends to a)
//   direction "both": A→B and B→A simultaneously (each sends to the other)
//
// Nothing is pinned across calls. A single node may be held fixed for the
// duration of one call via clampedId (the standard FCM what-if technique —
// clamp the stimulus concept, let the rest of the network respond) — every
// other node, including ones touched by a previous keypress, updates freely
// and can itself be pulled around by downstream feedback.

function propagateBelief(clampedId) {
  // ── Fuzzy Cognitive Map (FCM) belief propagation ──────────────────────────
  //
  // Only each parent's SIGNED deviation from its own resting prior propagates
  // (dev = belief - prior, can be negative). A parent sitting exactly at its
  // prior sends no signal — this keeps an all-neutral network stationary.
  //
  // For each non-clamped node, incoming deviations are combined into a
  // weighted sum S = Σ ±w·dev (facilitate = +, inhibit = -), then squashed
  // with tanh and applied on the correct side of the node's own prior so the
  // result always stays in [0,1] and prior remains the true resting point:
  //
  //   S >= 0:  target = prior + (1-prior)·tanh(S)   (room to grow toward 1)
  //   S <  0:  target = prior +    prior ·tanh(S)   (room to fall toward 0)
  //
  // The node then relaxes a fraction (RELAX_ALPHA) of the way toward that
  // target each pass, rather than jumping straight to it. This is what makes
  // "inhibit" genuinely inhibit (pulls belief below prior, unlike the old
  // noisy-OR rule which was monotone non-decreasing), and it damps the
  // oscillation that signed feedback loops can otherwise produce.
  //
  // Propagation stops early once every node's per-pass change falls below
  // CONVERGE_EPS (a stable equilibrium has been reached); otherwise it runs
  // the full PROP_ITERATIONS and is flagged as not-converged.

  // Hop distances from the clamped node, used only to cap how far this run
  // is allowed to reach (maxPropagationHops, set by the Analyse panel
  // slider). Computed locally rather than via a shared helper with
  // scheduleCascade — kept deliberately independent so a change to one
  // can't destabilise the other. Skipped entirely when unlimited.
  let hopDist = null;
  if (clampedId !== undefined && maxPropagationHops !== Infinity) {
    hopDist = { [clampedId]: 0 };
    let frontier = [clampedId];
    let h = 0;
    while (frontier.length > 0) {
      let next = [];
      for (let nodeId of frontier) {
        for (let i = 0; i < edges.length; i++) {
          let e = edges[i];
          if (e.linkState === "off") continue;
          let targetId = null;
          if ((e.direction === "to" || e.direction === "both") && e.from === nodeId) targetId = e.to;
          else if ((e.direction === "from" || e.direction === "both") && e.to === nodeId) targetId = e.from;
          if (targetId === null || hopDist[targetId] !== undefined) continue;
          hopDist[targetId] = h + 1;
          next.push(targetId);
        }
      }
      h++;
      frontier = next;
    }
  }
  function withinHopCap(nodeId) {
    return !hopDist || (hopDist[nodeId] !== undefined && hopDist[nodeId] <= maxPropagationHops);
  }

  // Normalise edge strengths: thickest edge = weight 1.0
  let maxT = 1;
  for (let i = 0; i < edges.length; i++) {
    if (edges[i].linkState !== "off" && edges[i].thickness > maxT)
      maxT = edges[i].thickness;
  }

  // Pre-compute a fixed weight for each edge (not re-damped each iteration)
  // Apply LOOP_DAMPING once as a global cap to prevent runaway feedback.
  let edgeW = {};
  for (let i = 0; i < edges.length; i++) {
    let e = edges[i];
    edgeW[e.id] = constrain((e.thickness / maxT) * LOOP_DAMPING, 0.0, 0.92);
  }

  // Populate debug overlay if enabled
  if (showDebug) {
    debugLines = ["maxT=" + maxT.toFixed(1) + "  edges:"];
    for (let i = 0; i < edges.length; i++) {
      let e = edges[i];
      if (e.linkState === "off") continue;
      let a = getNode(e.from), b = getNode(e.to);
      if (a && b) debugLines.push("  " + a.label.substring(0,8) + "→" + b.label.substring(0,8) +
        " [" + e.direction + "/" + e.linkState.substring(0,3) + "]" +
        " t=" + e.thickness.toFixed(1) + " w=" + edgeW[e.id].toFixed(2));
    }
    debugLines.push("Clamped: " + (clampedId !== undefined ? clampedId : "none"));
    for (let i = 0; i < nodes.length; i++) {
      let n = nodes[i];
      let dev = n.belief - (n.prior || 0.5);
      debugLines.push("  " + n.label.substring(0,10) +
        " b=" + n.belief.toFixed(2) +
        " p=" + (n.prior||0.5).toFixed(2) +
        " dev=" + dev.toFixed(2));
    }
  }

  let iter = 0;
  let converged = false;

  for (; iter < PROP_ITERATIONS; iter++) {
    // Snapshot all current beliefs so updates don't cascade within one pass
    let snap = {};
    for (let i = 0; i < nodes.length; i++) snap[nodes[i].id] = nodes[i].belief;

    // For each non-clamped, in-range node, accumulate the signed weighted
    // sum of incoming deviations. Start at 0 — the prior is the resting point.
    let S = {};
    for (let i = 0; i < nodes.length; i++) {
      let id = nodes[i].id;
      if (id !== clampedId && withinHopCap(id)) S[id] = 0;
    }

    // Add in each parent's signed contribution
    for (let i = 0; i < edges.length; i++) {
      let e = edges[i];
      if (e.linkState === "off") continue;

      let aId = e.from, bId = e.to;
      let aBelief = snap[aId], bBelief = snap[bId];
      if (aBelief === undefined || bBelief === undefined) continue;

      let w     = edgeW[e.id];
      let sign  = (e.linkState === "facilitate") ? 1 : -1;

      if (e.direction === "to" || e.direction === "both") {
        if (S[bId] !== undefined) {
          let parentNode  = getNode(aId);
          let parentPrior = parentNode ? (parentNode.prior || 0.5) : 0.5;
          S[bId] += sign * w * (aBelief - parentPrior);
        }
      }
      if (e.direction === "from" || e.direction === "both") {
        if (S[aId] !== undefined) {
          let parentNode  = getNode(bId);
          let parentPrior = parentNode ? (parentNode.prior || 0.5) : 0.5;
          S[aId] += sign * w * (bBelief - parentPrior);
        }
      }
    }

    // Squash S onto the correct side of each node's prior, then relax a
    // fraction of the way toward that target (damps oscillation/overshoot).
    let maxDelta = 0;
    for (let i = 0; i < nodes.length; i++) {
      let n = nodes[i];
      if (n.id === clampedId) continue;
      if (S[n.id] === undefined) continue;

      let prior  = n.prior || 0.5;
      let s      = S[n.id];
      let target = s >= 0
        ? prior + (1.0 - prior) * Math.tanh(s)
        : prior +        prior  * Math.tanh(s);
      target = constrain(target, 0.0, 1.0);

      let cur       = snap[n.id];
      let newBelief = constrain(cur + RELAX_ALPHA * (target - cur), 0.0, 1.0);

      maxDelta = Math.max(maxDelta, Math.abs(newBelief - cur));
      n.belief = newBelief;
    }

    // Capture iter 0 sums into debug overlay
    if (showDebug && iter === 0) {
      debugLines.push("iter0 sums:");
      for (let i = 0; i < nodes.length; i++) {
        let n = nodes[i];
        if (S[n.id] !== undefined) {
          debugLines.push("  " + n.label.substring(0,8) +
            " S=" + S[n.id].toFixed(3) +
            " b=" + n.belief.toFixed(3));
        }
      }
    }

    if (maxDelta < CONVERGE_EPS) { converged = true; iter++; break; }
  }

  lastPropIterations = iter;
  lastPropConverged  = converged;

  if (showDebug) {
    debugLines.push("passes=" + lastPropIterations +
      (lastPropConverged ? " (converged)" : " (did not settle)"));
  }
}

// ─── PARTICLE ANIMATION ──────────────────────────────────────────────────────

// Walk outward from sourceId through active edges and schedule a
// spawnParticles() call for every node the signal reaches, timed in waves so
// the dots visibly relay hop by hop — A's dot arriving at B triggers B's
// dots toward C, etc. — rather than only ever showing the first hop out of
// the pressed node. This is the exact scheduling logic confirmed working
// (2 hops deep) before later changes regressed it; restored verbatim rather
// than reconstructed, since a reconstructed version kept coming back wrong.
function scheduleCascade(sourceId) {
  pendingSpawns = []; // cancel any cascade still in flight from a previous press

  spawnParticles(sourceId); // hop 1 fires immediately, no scheduling delay

  let visited = new Set([sourceId]);
  let frontier = [sourceId];
  let wave = 0;

  while (frontier.length > 0) {
    let next = [];
    for (let nodeId of frontier) {
      for (let i = 0; i < edges.length; i++) {
        let e = edges[i];
        if (e.linkState === "off") continue;

        let targetId = null;
        if ((e.direction === "to" || e.direction === "both") && e.from === nodeId) targetId = e.to;
        else if ((e.direction === "from" || e.direction === "both") && e.to === nodeId) targetId = e.from;

        if (targetId === null || visited.has(targetId)) continue;
        visited.add(targetId);
        next.push(targetId);
      }
    }

    wave++;
    // Only schedule these nodes to fire ONWARD if that stays within the cap.
    // They still receive their incoming particle either way (spawned by the
    // previous wave's firing, below) — this only stops them relaying further,
    // so the animation's reach matches propagateBelief's exactly.
    if (wave < maxPropagationHops) {
      for (let nodeId of next) {
        pendingSpawns.push({ frame: frameCount + wave * WAVE_GAP_FRAMES, nodeId: nodeId });
      }
    }
    frontier = next;
  }
}

// Fire any scheduled cascade waves whose time has come. Called once per
// frame alongside tickParticles().
function processPendingSpawns() {
  for (let i = pendingSpawns.length - 1; i >= 0; i--) {
    if (pendingSpawns[i].frame <= frameCount) {
      spawnParticles(pendingSpawns[i].nodeId);
      pendingSpawns.splice(i, 1);
    }
  }
}

// Spawn particles outward from a source node along all connected active edges
function spawnParticles(sourceNodeId) {
  for (let i = 0; i < edges.length; i++) {
    let e = edges[i];
    if (e.linkState === "off") continue;

    let senderId = -1, forward = true;

    if ((e.direction === "to" || e.direction === "both") && e.from === sourceNodeId) {
      senderId = sourceNodeId; forward = true;
    } else if ((e.direction === "from" || e.direction === "both") && e.to === sourceNodeId) {
      senderId = sourceNodeId; forward = false;
    }

    if (senderId === -1) continue;

    let sender = getNode(sourceNodeId);
    if (!sender) continue;

    // Particle colour based on sender's current belief and link type.
    // Inhibit edges carry the "opposite" signal visually, so both belief and
    // its pivot (prior) are reflected around 0.5 together.
    let senderB     = sender.belief !== undefined ? sender.belief : 0.5;
    let senderPrior = sender.prior  !== undefined ? sender.prior  : 0.5;
    let isFac       = e.linkState === "facilitate";
    let targetB     = isFac ? senderB     : (1.0 - senderB);
    let targetPrior = isFac ? senderPrior : (1.0 - senderPrior);
    let pCol        = beliefColor(targetB, targetPrior);

    particles.push({
      edgeId:  e.id,
      forward: forward,
      t:       0,           // 0 = at sender, 1 = at receiver
      col:     pCol,
      width:   constrain(e.thickness * 1.4, 4, 18),
      alive:   true,
    });
  }
}

// Advance all particles one frame. Each particle's t-increment is derived
// from its edge's actual on-screen length so every dot moves at the same
// constant pixel speed — a long edge just takes proportionally more frames
// to cross, rather than its dot visibly moving faster than a short edge's.
function tickParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];

    let e = edges.find(function(x) { return x.id === p.edgeId; });
    let a = e ? getNode(e.from) : null;
    let b = e ? getNode(e.to)   : null;
    if (!e || !a || !b) { particles.splice(i, 1); continue; }

    let angle  = atan2(b.y - a.y, b.x - a.x);
    let startP = nodeEdgePoint(a, angle);
    let endP   = nodeEdgePoint(b, angle + PI);
    let len    = dist(startP.x, startP.y, endP.x, endP.y);

    p.t += PARTICLE_PX_PER_FRAME / Math.max(len, 1);
    if (p.t >= 1) {
      p.alive = false;
      particles.splice(i, 1);
    }
  }
}

// Draw all live particles as glowing dots along their edge.
// Build an id→edge index first to avoid O(n*m) find() inside the loop.
function drawParticles() {
  let edgeById = {};
  for (let i = 0; i < edges.length; i++) edgeById[edges[i].id] = edges[i];

  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    let e = edgeById[p.edgeId];
    if (!e) continue;

    let a = getNode(e.from), b = getNode(e.to);
    if (!a || !b) continue;

    // Evaluate position along the same bezier curve used by drawArrow,
    // so particles follow curved paths rather than travelling in straight lines.
    let angle  = atan2(b.y - a.y, b.x - a.x);
    let startP = nodeEdgePoint(a, angle);
    let endP   = nodeEdgePoint(b, angle + PI);
    let sx = startP.x, sy = startP.y;
    let ex = endP.x,   ey = endP.y;

    // Build the quadratic bezier control point (mirrors drawArrow exactly)
    let cv  = e.curve || 0;
    let ddx = ex - sx, ddy = ey - sy;
    let len = sqrt(ddx*ddx + ddy*ddy);
    let cpx = (sx + ex) / 2, cpy = (sy + ey) / 2; // default: midpoint (straight)
    if (len > 0 && abs(cv) > 0.001) {
      let perpX = -ddy / len, perpY = ddx / len;
      let bulge = len * cv * 0.4;
      cpx += perpX * bulge;
      cpy += perpY * bulge;
    }

    // t goes 0→1 in travel direction; ease in-out for smooth acceleration
    let t = p.forward ? p.t : (1 - p.t);
    let tEased = t < 0.5 ? 2*t*t : -1 + (4 - 2*t) * t;

    // Evaluate quadratic bezier: Q(t) = (1-t)²·P0 + 2t(1-t)·CP + t²·P1
    let it = 1 - tEased;
    let px = it*it*sx + 2*it*tEased*cpx + tEased*tEased*ex;
    let py = it*it*sy + 2*it*tEased*cpy + tEased*tEased*ey;

    // Alpha fades in at start and out at end
    let alpha = sin(t * PI) * 220;

    // Outer glow
    let c = p.col;
    noStroke();
    fill(red(c), green(c), blue(c), alpha * 0.35);
    ellipse(px, py, p.width * 2.8);

    // Core dot
    fill(red(c), green(c), blue(c), alpha);
    ellipse(px, py, p.width);

    // White highlight
    fill(255, 255, 255, alpha * 0.5);
    ellipse(px, py, p.width * 0.4);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  promptLabel.position(40, height - 110);
  inputBox.position(40, height - 68);
  submitBtn.position(396, height - 68);
  hintLabel.position(500, height - 72);
}
