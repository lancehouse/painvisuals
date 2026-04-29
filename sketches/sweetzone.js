/*
 Vintage VU-style Half-Moon Meter with Editable "UNCERTAINTY"
 - Click / tap the curved "UNCERTAINTY" word to edit it (desktop & touch)
 - Everything else (drag handles, needle, keys, wheel, visuals) unchanged
*/

// ---------------- TWEAKABLES ----------------
let canvasW = 920, canvasH = 660;
let dialRadius = 340;                 // size of dial
let framePadding = 30;                // padding inside the frame
let dialCenterX, dialCenterY;         // computed in setup
let canvasElem;                       // will hold canvas reference for DOM positioning

// Colors (vintage-ish palette)
const FRAME_COLOR = '#0c0c0c';
const DIAL_BG = [245, 230, 150];
const Z_TOO_LITTLE = [250, 230, 160];
const Z_SWEET = [240, 70, 120];
const Z_TOO_MUCH = [250, 210, 110];
const TICK_COLOR = '#111';
const NEEDLE_COLOR = '#222';

// Scale & zones (0..100)
let lowBoundary = 30;   // "Too Little" -> "Sweet" boundary
let highBoundary = 70;  // "Sweet" -> "Too Much" boundary

// needle value (0..100)
let needleValue = 28;

// dragging state
let draggingNeedle = false;
let draggingLow = false;
let draggingHigh = false;

// ---------------- Editable text state ----------------
let uncertaintyText = "DEMAND ON THE SYSTEM"; // the live, editable string
let inputUnc;                        // p5 DOM input element
let editingUnc = false;              // currently editing?

function setup() {
  canvasElem = createCanvas(canvasW, canvasH);
  angleMode(DEGREES);
  textAlign(CENTER, CENTER);
  textFont("cursive");

  dialCenterX = width / 2;
  dialCenterY = height / 2 + 60;
  noSmooth();

  inputUnc = createInput(uncertaintyText);
  inputUnc.hide();
  inputUnc.elt.style.background = "rgba(0,0,0,0)";
  inputUnc.elt.style.border = "none";
  inputUnc.elt.style.outline = "none";
  inputUnc.elt.style.color = "white";
  inputUnc.elt.style.textAlign = "center";
  inputUnc.elt.style.fontFamily = "cursive";
  inputUnc.elt.style.padding = "0px";
  inputUnc.elt.style.margin = "0px";

  inputUnc.elt.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { finishEditingUnc(); }
    else if (e.key === "Escape") { cancelEditingUnc(); }
  });
  inputUnc.elt.addEventListener("blur", () => { finishEditingUnc(); });
}

function drawArcWord(str, centerAng, radius, txtSize, col) {
  push();
  translate(dialCenterX, dialCenterY);
  textSize(txtSize);
  textAlign(CENTER, CENTER);
  fill(col);
  noStroke();

  let totalW = textWidth(str);
  let arcSpan = degrees(totalW / radius);
  let startAng = centerAng - arcSpan / 2;

  for (let i = 0; i < str.length; i++) {
    let letter = str[i];
    let lw = textWidth(letter);
    let midAng = startAng + degrees(lw / 2 / radius);
    let x = cos(midAng) * radius;
    let y = sin(midAng) * radius;
    push();
    translate(x, y);
    rotate(midAng + 90);
    text(letter, 0, 0);
    pop();
    startAng += degrees(lw / radius);
  }
  pop();
}

function draw() {
  background(18);
  drawFrame();

  noStroke();
  fill(DIAL_BG);
  arc(dialCenterX, dialCenterY, dialRadius * 2, dialRadius * 2, -180, 0, PIE);

  drawZones();
  drawTicks();
  drawLowerScoops();
  drawNeedle();

  fill(20);
  ellipse(dialCenterX, dialCenterY, 22);

  drawLabels();
  drawHandles();
}

function drawFrame() {
  push();
  translate(width/2, height/2);
  noStroke();
  fill(FRAME_COLOR);
  rectMode(CENTER);
  rect(0, 0, 380, 380, 8);
  fill(40);
  rect(0, 0, 380, 360, 6);
  pop();

  stroke(0, 60);
  strokeWeight(2);
  noFill();
  ellipse(dialCenterX, dialCenterY, (dialRadius * 2) + 6);
  noStroke();
}

function drawZones() {
  let startAng = -180;
  let lowAng = map(lowBoundary, 0, 100, -180, 0);
  let highAng = map(highBoundary, 0, 100, -180, 0);

  noStroke();
  fill(Z_TOO_LITTLE);
  arc(dialCenterX, dialCenterY, dialRadius * 2, dialRadius * 2, startAng, lowAng, PIE);

  fill(Z_SWEET);
  arc(dialCenterX, dialCenterY, dialRadius * 2, dialRadius * 2, lowAng, highAng, PIE);

  fill(Z_TOO_MUCH);
  arc(dialCenterX, dialCenterY, dialRadius * 2, dialRadius * 2, highAng, 0, PIE);
}

function drawTicks() {
  push();
  translate(dialCenterX, dialCenterY);
  stroke(TICK_COLOR);

  let major = 10;
  strokeWeight(2);
  for (let i = 0; i <= major; i++) {
    let ang = map(i, 0, major, -180, 0);
    let rOut = dialRadius - 8;
    let rIn = dialRadius - 32;
    let x1 = cos(ang) * rOut, y1 = sin(ang) * rOut;
    let x2 = cos(ang) * rIn,  y2 = sin(ang) * rIn;
    line(x1, y1, x2, y2);

    noStroke();
    fill(10);
    textSize(12);
    let labelR = dialRadius - 56;
    text(int(map(i, 0, major, 0, 100)), cos(ang) * labelR, sin(ang) * labelR);
    stroke(TICK_COLOR);
  }

  strokeWeight(1);
  let minorPerMajor = 4;
  for (let i = 0; i <= major * minorPerMajor; i++) {
    let ang = map(i, 0, major * minorPerMajor, -180, 0);
    if (i % minorPerMajor === 0) continue;
    let rOut = dialRadius - 8;
    let rIn = dialRadius - 22;
    line(cos(ang) * rOut, sin(ang) * rOut, cos(ang) * rIn, sin(ang) * rIn);
  }
  pop();
}

function drawLowerScoops() {
  push();
  translate(dialCenterX, dialCenterY);
  noStroke();
  fill(18);
  ellipse(-50, dialRadius * 0.34, 70, 46);
  ellipse(50, dialRadius * 0.34, 70, 46);
  fill(80);
  arc(0, dialRadius * 0.42, 120, 60, 180, 360, CHORD);
  pop();
}

function drawNeedle() {
  let ang = map(constrain(needleValue, 0, 100), 0, 100, -90, +90);
  push();
  translate(dialCenterX, dialCenterY);
  rotate(ang);
  noStroke();
  fill(NEEDLE_COLOR);
  beginShape();
  vertex(-8, 8);
  vertex(8, 8);
  vertex(3, -(dialRadius - 50));
  vertex(-3, -(dialRadius - 50));
  endShape(CLOSE);
  stroke(255, 80);
  strokeWeight(1);
  line(0, 6, 0, -(dialRadius - 56));
  noStroke();
  pop();
}

function drawLabels() {
  push();
  fill(240, 70, 120);
  textSize(32);
  text('RETRAINING FOR CHANGE', dialCenterX, dialCenterY + 85);

  textSize(22);
  text('+', dialCenterX + dialRadius - 28, dialCenterY - 8);
  text('–', dialCenterX - dialRadius + 28, dialCenterY - 8);

  textSize(25);
  noStroke();
  fill(10, 180);

  let lowMid   = lowBoundary / 2;
  let sweetMid = (lowBoundary + highBoundary) / 2;
  let highMid  = (highBoundary + 100) / 2;

  let lowAng   = map(lowMid, 0, 100, -180, 0);
  let sweetAng = map(sweetMid, 0, 100, -180, 0);
  let highAng  = map(highMid, 0, 100, -180, 0);

  let labelR = dialRadius * 0.50;

  text('TOO LITTLE', dialCenterX + cos(lowAng) * labelR, dialCenterY + sin(lowAng) * labelR);
  text('SWEET ZONE', dialCenterX + cos(sweetAng) * labelR, dialCenterY + sin(sweetAng) * labelR);
  text('TOO MUCH', dialCenterX + cos(highAng) * labelR, dialCenterY + sin(highAng) * labelR);

  let outerR = dialRadius + 20;
  drawArcWord("LESS", -160, outerR, 28, color(220, 90, 50));
  drawArcWord(uncertaintyText, -90, outerR, 32, color(255));
  drawArcWord("MORE", -20, outerR, 28, color(220, 90, 50));

  pop();
}

function drawHandles() {
  let lowAng = map(lowBoundary, 0, 100, -180, 0);
  let lx = dialCenterX + cos(lowAng) * dialRadius;
  let ly = dialCenterY + sin(lowAng) * dialRadius;

  fill(230, 200, 80);
  noStroke();
  ellipse(lx, ly, 12);

  let highAng = map(highBoundary, 0, 100, -180, 0);
  let hx = dialCenterX + cos(highAng) * dialRadius;
  let hy = dialCenterY + sin(highAng) * dialRadius;

  fill(200, 80, 80);
  ellipse(hx, hy, 12);
}

function getPointer(e) {
  if (touches.length > 0) { return {x: touches[0].x, y: touches[0].y}; }
  return {x: mouseX, y: mouseY};
}

function hitTestArcWord(str, centerAng, radius, txtSize, mx, my) {
  push();
  textSize(txtSize);
  let totalW = textWidth(str);
  let arcSpan = degrees(totalW / radius);
  let startAng = centerAng - arcSpan / 2;

  for (let i = 0; i < str.length; i++) {
    let letter = str[i];
    let lw = textWidth(letter);
    let midAng = startAng + degrees(lw / 2 / radius);
    let x = dialCenterX + cos(midAng) * radius;
    let y = dialCenterY + sin(midAng) * radius;
    let hitR = max(18, txtSize * 0.6);
    if (dist(mx, my, x, y) < hitR) { pop(); return true; }
    startAng += degrees(lw / radius);
  }
  pop();
  return false;
}

function startInteraction(x, y) {
  if (editingUnc) return;

  let d = dist(x, y, dialCenterX, dialCenterY);
  if (d < dialRadius + 8 && y < dialCenterY + 20) {
    draggingNeedle = true;
    updateNeedleFromPos(x, y);
  }

  let lowAng = map(lowBoundary, 0, 100, -180, 0);
  let lx = dialCenterX + cos(lowAng) * dialRadius;
  let ly = dialCenterY + sin(lowAng) * dialRadius;
  if (dist(x, y, lx, ly) < 14) { draggingLow = true; }

  let highAng = map(highBoundary, 0, 100, -180, 0);
  let hx = dialCenterX + cos(highAng) * dialRadius;
  let hy = dialCenterY + sin(highAng) * dialRadius;
  if (dist(x, y, hx, hy) < 14) { draggingHigh = true; }
}

function dragInteraction(x, y) {
  if (draggingNeedle) updateNeedleFromPos(x, y);
  if (draggingLow) updateBoundaryFromPos(x, y, 'low');
  if (draggingHigh) updateBoundaryFromPos(x, y, 'high');
}

function endInteraction() {
  draggingNeedle = false;
  draggingLow = false;
  draggingHigh = false;
}

function mousePressed() {
  let p = getPointer();
  let outerR = dialRadius + 20;
  if (hitTestArcWord(uncertaintyText, -90, outerR, 32, p.x, p.y)) {
    startEditingUnc(); return;
  }
  startInteraction(p.x, p.y);
}
function mouseDragged() { let p = getPointer(); dragInteraction(p.x, p.y); }
function mouseReleased() { endInteraction(); }

function touchStarted() {
  let p = getPointer();
  let outerR = dialRadius + 20;
  if (hitTestArcWord(uncertaintyText, -90, outerR, 32, p.x, p.y)) {
    startEditingUnc(); return false;
  }
  startInteraction(p.x, p.y);
  return false;
}
function touchMoved()  { let p = getPointer(); dragInteraction(p.x, p.y); return false; }
function touchEnded()  { endInteraction(); return false; }

function updateNeedleFromPos(mx, my) {
  let ang = atan2(my - dialCenterY, mx - dialCenterX);
  ang = constrain(ang, -180, 0);
  needleValue = map(ang, -180, 0, 0, 100);
  needleValue = constrain(needleValue, 0, 100);
}

function updateBoundaryFromPos(mx, my, which) {
  let ang = atan2(my - dialCenterY, mx - dialCenterX);
  ang = constrain(ang, -180, 0);
  let val = map(ang, -180, 0, 0, 100);
  if (which === 'low') { lowBoundary = constrain(val, 0, highBoundary - 5); }
  else if (which === 'high') { highBoundary = constrain(val, lowBoundary + 5, 100); }
}

function startEditingUnc() {
  if (editingUnc) return;
  editingUnc = true;
  inputUnc.value(uncertaintyText);
  inputUnc.show();

  textSize(32);
  let w = max(80, textWidth(uncertaintyText) + 20);
  inputUnc.size(w, 36);
  inputUnc.elt.style.fontSize = "32px";

  let outerR = dialRadius + 20;
  let centerAng = -90;
  let cx = dialCenterX + cos(centerAng) * outerR;
  let cy = dialCenterY + sin(centerAng) * outerR;

  let rect = canvasElem.elt.getBoundingClientRect();
  let pageX = rect.left + cx;
  let pageY = rect.top + cy - 16;

  inputUnc.position(pageX - w / 2, pageY - 18);
  inputUnc.elt.focus();
  inputUnc.elt.select();
}

function finishEditingUnc() {
  if (!editingUnc) return;
  uncertaintyText = inputUnc.value();
  editingUnc = false;
  inputUnc.hide();
}

function cancelEditingUnc() {
  editingUnc = false;
  inputUnc.hide();
}

function keyPressed() {
  const step = 2;
  const minWidth = 10;
  let center = (lowBoundary + highBoundary) / 2;
  let half = (highBoundary - lowBoundary) / 2;

  if (keyCode === RIGHT_ARROW) {
    let maxMove = 100 - highBoundary;
    let move = min(step, maxMove);
    lowBoundary += move; highBoundary += move;
  } else if (keyCode === LEFT_ARROW) {
    let maxMove = lowBoundary;
    let move = min(step, maxMove);
    lowBoundary -= move; highBoundary -= move;
  } else if (keyCode === DOWN_ARROW) {
    let desiredHalf = half + step / 2.0;
    let maxHalf = min(center, 100 - center);
    let newHalf = min(desiredHalf, maxHalf);
    lowBoundary = center - newHalf; highBoundary = center + newHalf;
  } else if (keyCode === UP_ARROW) {
    let desiredHalf = half - step / 2.0;
    let minHalf = minWidth / 2.0;
    let newHalf = max(desiredHalf, minHalf);
    let maxHalf = min(center, 100 - center);
    newHalf = constrain(newHalf, minHalf, maxHalf);
    lowBoundary = center - newHalf; highBoundary = center + newHalf;
  }
}

function mouseWheel(event) {
  needleValue = constrain(needleValue - event.delta / 50, 0, 100);
  return false;
}
