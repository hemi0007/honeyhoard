// HOW TO PLAY:
//
// - Use LEFT ARROW or 'A' to move the honeycomb left.
// - Use RIGHT ARROW or 'D' to move the honeycomb right.
// - Use DOWN ARROW or 'S' to make the honeycomb fall faster (soft drop). Release to stop soft drop.
// - Use UP ARROW, 'W', or SPACEBAR to rotate the honeycomb.
// - Press 'P' to pause or unpause the game at any time.
// - Press SPACEBAR to unpause if you paused with spacebar (but 'P' is recommended).
// - Click the Start button to begin playing immediately.
//
// The game starts slow and speeds up every 30 seconds. Fill lines to score points. Drag and drop is also supported for moving pieces.
//
// Enjoy!

// Global variables
let R = 5; // Hexagon radius (distance from center to corner)
let size = 30; // Hexagon radius in pixels
let origin = null; // Will be set in setup
let filled = new Set(); // Stores filled hex positions as "q,r" strings
let score = 0;
let piece; // Current falling piece
let lastError = null; // Store last error for display
let honeyImg;
let bgImg; // Background image
let treeBgImg; // Tree background image
let fallInterval = 120; // Start much slower (2 seconds per drop at 60fps)
let minFallInterval = 20; // Minimum speed
let speedupInterval = 1800; // 30 seconds at 60fps
let lastSpeedupFrame = 0;
let lastFall = 0; // Last frame when the piece fell
let gameOver = false;
let softDrop = false;
let lastRotateFrame = 0;
let gameStarted = false;

// Drag-and-drop state
let dragging = false;
let dragOffset = null;
let dragStartHex = null;
let dragStartPos = null;
let draggedFarEnough = false;

// Predefined shapes (polyhexes) as arrays of [q,r] offsets
const shapes = [
  [[0, 0]],                     // Single hex
  [[0, 0], [1, 0]],            // Domino
  [[0, 0], [1, 0], [2, 0]],    // Straight tromino
  [[0, 0], [1, 0], [0, 1]],    // Bent tromino
  // 4-hex (tetromino) shapes
  [[0, 0], [1, 0], [2, 0], [3, 0]], // Straight tetromino
  [[0, 0], [1, 0], [0, 1], [0, 2]], // L-shape
  [[0, 0], [1, 0], [1, 1], [2, 1]], // S-shape
  [[0, 0], [1, 0], [1, 1], [2, 0]], // T-shape
  [[0, 0], [1, 0], [0, 1], [-1, 1]], // Z-shape
  [[0, 0], [1, 0], [0, 1], [1, 1]], // Square (diamond) shape
];

// Directions for line checking: three pairs of opposite directions
const directions = [
  [[1, 0], [-1, 0]],    // Horizontal
  [[0, 1], [0, -1]],    // Vertical-ish
  [[1, -1], [-1, 1]]    // Diagonal
];

// Hex class for axial coordinates
class Hex {
  constructor(q, r) {
    this.q = q;
    this.r = r;
  }
  add(other) {
    return new Hex(this.q + other.q, this.r + other.r);
  }
  toString() {
    return `${this.q},${this.r}`;
  }
}

// Convert hex coordinates to pixel coordinates (pointy-top orientation)
function hexToPixel(hex) {
  const x = size * Math.sqrt(3) * (hex.q + hex.r / 2);
  const y = size * (3 / 2) * hex.r;
  return createVector(origin.x + x, origin.y + y);
}

// Convert pixel coordinates to hex coordinates (pointy-top orientation)
function pixelToHex(p) {
  const q = ((p.x - origin.x) * Math.sqrt(3) / 3 - (p.y - origin.y) / 3) / size;
  const r = (2 / 3 * (p.y - origin.y)) / size;
  return roundHex(new Hex(q, r));
}

// Round fractional hex coordinates to nearest hex
function roundHex(frac) {
  let q = Math.round(frac.q);
  let r = Math.round(frac.r);
  let s = Math.round(-frac.q - frac.r);
  const q_diff = Math.abs(q - frac.q);
  const r_diff = Math.abs(r - frac.r);
  const s_diff = Math.abs(s + frac.q + frac.r);
  if (q_diff > r_diff && q_diff > s_diff) {
    q = -r - s;
  } else if (r_diff > s_diff) {
    r = -q - s;
  }
  return new Hex(q, r);
}

// Check if a hex is within grid bounds
function isWithinBounds(hex) {
  let s = -hex.q - hex.r;
  return Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(s)) <= R;
}

// Draw a pointy-top hexagon at (x, y) with given radius
function drawHexagon(x, y, radius) {
  beginShape();
  for (let i = 0; i < 6; i++) {
    let angle = PI / 3 * i + PI / 6; // 30 degrees offset for pointy-top
    let vx = x + radius * cos(angle);
    let vy = y + radius * sin(angle);
    vertex(vx, vy);
  }
  endShape(CLOSE);
}

// Generate a new piece at the top of the grid
function generatePiece() {
  try {
    const shapeIndex = floor(random(shapes.length));
    const shape = shapes[shapeIndex].map(([dq, dr]) => new Hex(dq, dr));
    piece = {
      hexPos: new Hex(2, -R), // Spawn two hexes to the right at the top row
      shape: shape
    };
    lastError = null;
  } catch (err) {
    lastError = err;
    console.error('Error in generatePiece:', err);
  }
}

// Check if a piece can be placed at a given hex position
function canPlace(hexPos, shape) {
  for (let offset of shape) {
    let absHex = hexPos.add(offset);
    if (!isWithinBounds(absHex) || filled.has(absHex.toString())) {
      return false;
    }
  }
  return true;
}

// Move the piece down by one row
function movePieceDown() {
  let newHexPos = new Hex(piece.hexPos.q, piece.hexPos.r + 1);
  if (canPlace(newHexPos, piece.shape)) {
    piece.hexPos = newHexPos;
  } else {
    placePiece();
  }
}

// Move the piece left
function movePieceLeft() {
  let newHexPos = new Hex(piece.hexPos.q - 1, piece.hexPos.r);
  if (canPlace(newHexPos, piece.shape)) {
    piece.hexPos = newHexPos;
  }
}

// Move the piece right
function movePieceRight() {
  let newHexPos = new Hex(piece.hexPos.q + 1, piece.hexPos.r);
  if (canPlace(newHexPos, piece.shape)) {
    piece.hexPos = newHexPos;
  }
}

// Rotate the piece 60 degrees clockwise
function rotatePiece() {
  let rotatedShape = piece.shape.map(offset => {
    let newQ = offset.q + offset.r;
    let newR = -offset.q;
    return new Hex(newQ, newR);
  });
  if (canPlace(piece.hexPos, rotatedShape)) {
    piece.shape = rotatedShape;
  }
}

// Place the piece on the grid and check for game over
function placePiece() {
  let gameOverFlag = false;
  for (let offset of piece.shape) {
    let absHex = piece.hexPos.add(offset);
    filled.add(absHex.toString());
    if (absHex.r < -R) {
      gameOverFlag = true;
    }
  }
  removeLines();
  generatePiece();
  // Speed up the fall after each piece
  fallInterval = max(minFallInterval, fallInterval - 1);
  if (gameOverFlag || !canPlace(piece.hexPos, piece.shape)) {
    noLoop();
    showGameOver();
  }
}

function showGameOver() {
  gameOver = true;
  if (typeof document !== 'undefined') {
    const scoreElem = document.getElementById('finalScore');
    if (scoreElem) scoreElem.textContent = `Your Score: ${score}`;
    const overlay = document.getElementById('gameOverOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
      setTimeout(() => overlay.classList.add('show'), 10);
    }
  }
}

function restartGame() {
  filled = new Set();
  score = 0;
  fallInterval = 45;
  lastFall = 0;
  gameOver = false;
  loop();
  generatePiece();
  if (typeof document !== 'undefined') {
    const overlay = document.getElementById('gameOverOverlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => overlay.style.display = 'none', 500);
    }
  }
}

// === UI POLISH START ===
// Font setup
let uiFont;
let clearedHexes = new Set();
let clearAnimFrame = 0;
const CLEAR_ANIM_DURATION = 12; // frames for pop/glow

function preload() {
  treeBgImg = loadImage('img/background.png');
  honeyImg = loadImage('img/honey.png');
  bgImg = loadImage('img/background.png');
  // Use a modern, readable font
  uiFont = 'Segoe UI, Roboto, Arial, sans-serif';
}

function removeLines() {
  let removed;
  do {
    let toRemove = new Set();
    for (let hexStr of filled) {
      let [q, r] = hexStr.split(',').map(Number);
      let hex = new Hex(q, r);
      for (let orient = 0; orient < 3; orient++) {
        let dir1 = new Hex(directions[orient][0][0], directions[orient][0][1]);
        let dir2 = new Hex(directions[orient][1][0], directions[orient][1][1]);
        let line = [hex];
        let current = hex.add(dir1);
        while (filled.has(current.toString()) && isWithinBounds(current)) {
          line.push(current);
          current = current.add(dir1);
        }
        current = hex.add(dir2);
        while (filled.has(current.toString()) && isWithinBounds(current)) {
          line.push(current);
          current = current.add(dir2);
        }
        if (line.length >= 5) {
          for (let h of line) {
            toRemove.add(h.toString());
          }
        }
      }
    }
    if (toRemove.size > 0) {
      // Store for pop/glow animation
      clearedHexes = new Set(toRemove);
      clearAnimFrame = CLEAR_ANIM_DURATION;
      for (let h of toRemove) {
        filled.delete(h);
      }
      score += toRemove.size * 10;
      removed = true;
    } else {
      removed = false;
    }
  } while (removed);
}
// === UI POLISH END ===

// Setup function: initialize canvas and assets
function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.style('display', 'block');
  pixelDensity(window.devicePixelRatio); // Handle high-DPI displays
  origin = createVector(width / 2, height / 2); // Center the grid

  // Dynamically calculate hex size to fit grid in window
  let maxGridWidth = width * 0.7; // 70% of width for more margin
  let maxGridHeight = height * 0.7; // 70% of height for more margin
  let sizeW = maxGridWidth / (Math.sqrt(3) * (2 * R + 1));
  let sizeH = maxGridHeight / (1.5 * (2 * R + 1));
  size = Math.min(sizeW, sizeH) * 0.85;

  // Do not start the game until user clicks Start
  noLoop();
}

// Draw function: render the game
function draw() {
  if (!gameStarted) {
    if (bgImg) {
      image(bgImg, 0, 0, width, height);
    } else {
      background(30, 20, 10);
    }
    fill('#F8F0DE');
    textAlign(CENTER, TOP);
    textSize(54); // Larger title
    textFont(uiFont);
    text('How to Play', width / 2, 60);

    textSize(28); // Larger instructions
    textFont(uiFont);
    const instructions = [
      "- LEFT ARROW or 'A': Move left",
      "- RIGHT ARROW or 'D': Move right",
      "- DOWN ARROW or 'S': Soft drop (hold to fall faster)",
      "- UP ARROW, 'W', or SPACEBAR: Rotate",
      "- P: Pause or unpause",
      "- SPACEBAR: Unpause if paused with spacebar",
      "- Drag and drop: Move and place the piece",
      "- Click Start: Begin playing",
      '',
      'The game starts slow and speeds up every 30 seconds.',
      'Fill lines to score points. Drag and drop is also supported.',
      '',
      'Enjoy!'
    ];
    let y = 120;
    for (let line of instructions) {
      text(line, width / 2, y);
      y += 40;
    }
    return;
  }
  try {
    if (bgImg) {
      image(bgImg, 0, 0, width, height);
    } else {
      background(0); // Opaque black background to cover full canvas
    }

    // Image size to cover hex without gaps
    const imgW = size * Math.sqrt(3) * 1.15; // Slightly larger to fill
    const imgH = size * 2 * 1.15;

    // Draw hexagonal grid
    for (let q = -R; q <= R; q++) {
      for (let r = -R; r <= R; r++) {
        let s = -q - r;
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > R) continue;
        let hex = new Hex(q, r);
        let p = hexToPixel(hex);
        // Glow/pop effect for cleared hexes
        if (clearedHexes.has(hex.toString()) && clearAnimFrame > 0) {
          let t = clearAnimFrame / CLEAR_ANIM_DURATION;
          push();
          noFill();
          stroke(255, 255, 0, 180 * t);
          strokeWeight(10 * t);
          drawHexagon(p.x, p.y, size * (1 + 0.2 * t));
          pop();
        }
        if (filled.has(hex.toString())) {
          if (honeyImg) {
            imageMode(CENTER);
            image(honeyImg, p.x, p.y, imgW, imgH);
            imageMode(CORNER);
          } else {
            fill(255, 204, 0);
            noStroke();
            drawHexagon(p.x, p.y, size);
          }
        } else {
          fill('#B37419');
          stroke('#5C2E00');
          strokeWeight(2);
          drawHexagon(p.x, p.y, size);
          noStroke();
        }
      }
    }

    // Draw current piece with highlight if dragging
    for (let offset of piece.shape) {
      let absHex = piece.hexPos.add(offset);
      let p = hexToPixel(absHex);
      if (honeyImg) {
        imageMode(CENTER);
        image(honeyImg, p.x, p.y, imgW, imgH);
        imageMode(CORNER);
      } else {
        fill(255, 204, 0);
        noStroke();
        drawHexagon(p.x, p.y, size);
      }
      // Highlight if dragging
      if (dragging) {
        push();
        noFill();
        stroke(0, 200, 255, 180); // cyan glow
        strokeWeight(7);
        drawHexagon(p.x, p.y, size * 1.08);
        pop();
      }
    }

    // Draw score as a button
    const scoreText = `Score: ${score}`;
    textSize(44); // Larger score
    textFont(uiFont);
    const paddingX = 32;
    const paddingY = 12;
    const btnW = textWidth(scoreText) + paddingX * 2;
    const btnH = 60;
    const btnX = width / 2 - btnW / 2;
    const btnY = 64;
    push();
    noStroke();
    fill(40, 30, 10, 220);
    rect(btnX + 3, btnY + 4, btnW, btnH, 18);
    fill('#D68C1F');
    rect(btnX, btnY, btnW, btnH, 18);
    pop();
    fill('#F8F0DE');
    textAlign(CENTER, CENTER);
    text(scoreText, width / 2, btnY + btnH / 2);

    // Automatic falling (soft drop if down arrow held)
    let currentInterval = softDrop ? 6 : fallInterval;
    if (!dragging && frameCount - lastFall >= currentInterval) {
      movePieceDown();
      lastFall = frameCount;
    }

    // Progressive speedup every 30 seconds
    if (frameCount - lastSpeedupFrame >= speedupInterval && fallInterval > minFallInterval) {
      fallInterval = Math.max(minFallInterval, fallInterval - 10); // Decrease by 10 every 30s
      lastSpeedupFrame = frameCount;
    }

    // Animate pop/glow
    if (clearAnimFrame > 0) {
      clearAnimFrame--;
      if (clearAnimFrame === 0) clearedHexes.clear();
    }

    lastError = null;
  } catch (err) {
    lastError = err;
    console.error('Error in draw:', err);
    background(50, 0, 0);
    fill(255, 0, 0);
    textSize(24);
    textAlign(CENTER, CENTER);
    text('An error occurred. See console for details.', width / 2, height / 2);
    if (err && err.message) {
      textSize(16);
      text(err.message, width / 2, height / 2 + 40);
    }
  }
}

// Handle key presses for piece control
function keyPressed() {
  if (gameOver) return;
  if (keyCode === LEFT_ARROW || key === 'a') {
    movePieceLeft();
  } else if (keyCode === RIGHT_ARROW || key === 'd') {
    movePieceRight();
  } else if ((keyCode === UP_ARROW || key === 'w' || keyCode === 32) && frameCount - lastRotateFrame > 6) {
    rotatePiece();
    lastRotateFrame = frameCount;
  } else if (keyCode === DOWN_ARROW || key === 's') {
    softDrop = true;
  }
}

function keyReleased() {
  if (keyCode === DOWN_ARROW || key === 's' || key === 'S') {
    softDrop = false;
  }
}

function mousePressed() {
  if (gameOver) return;
  for (let offset of piece.shape) {
    let absHex = piece.hexPos.add(offset);
    let p = hexToPixel(absHex);
    let d = dist(mouseX, mouseY, p.x, p.y);
    if (d < size * 1.1) {
      dragging = true;
      dragStartHex = piece.hexPos;
      dragStartPos = createVector(mouseX, mouseY);
      draggedFarEnough = false;
      let pieceOriginPx = hexToPixel(piece.hexPos);
      dragOffset = createVector(mouseX - pieceOriginPx.x, mouseY - pieceOriginPx.y);
      return;
    }
  }
}

function mouseDragged() {
  if (!dragging || gameOver) return;
  let px = createVector(mouseX - dragOffset.x, mouseY - dragOffset.y);
  let hex = pixelToHex(px);
  if (canPlace(hex, piece.shape)) {
    piece.hexPos = hex;
  }
  // Check if mouse moved far enough to count as a drag
  if (dragStartPos && dist(mouseX, mouseY, dragStartPos.x, dragStartPos.y) > 5) {
    draggedFarEnough = true;
  }
}

function mouseReleased() {
  if (!dragging || gameOver) return;
  dragging = false;
  // Only place the piece if it was actually dragged
  if (draggedFarEnough && canPlace(piece.hexPos, piece.shape)) {
    placePiece();
  } else {
    piece.hexPos = dragStartHex;
  }
}

// Handle window resizing
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  pixelDensity(window.devicePixelRatio); // Re-apply for high-DPI displays
  origin = createVector(width / 2, height / 2);

  // Dynamically recalculate hex size to fit grid in window
  let maxGridWidth = width * 0.7;
  let maxGridHeight = height * 0.7;
  let sizeW = maxGridWidth / (Math.sqrt(3) * (2 * R + 1));
  let sizeH = maxGridHeight / (1.5 * (2 * R + 1));
  size = Math.min(sizeW, sizeH) * 0.85;
}

function startGame() {
  gameStarted = true;
  filled = new Set();
  score = 0;
  fallInterval = 120;
  lastFall = 0;
  gameOver = false;
  loop(); // Start the draw loop immediately
  generatePiece();
}

window.startGame = startGame;

function drawHexPatternOverlay(gfx, w, h) {
  // Subtle hex grid overlay
  const hexRadius = Math.min(w, h) / 18; // scale with canvas
  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  gfx.push();
  gfx.stroke(255, 255, 255, 22); // very light white, alpha
  gfx.strokeWeight(1);
  for (let y = -hexHeight; y < h + hexHeight; y += hexHeight * 0.75) {
    for (let x = -hexWidth; x < w + hexWidth; x += hexWidth) {
      let offsetX = ((Math.floor(y / (hexHeight * 0.75)) % 2) === 0) ? 0 : hexWidth / 2;
      drawHexagonOnGfx(gfx, x + offsetX, y, hexRadius);
    }
  }
  gfx.pop();
}

function drawHexagonOnGfx(gfx, x, y, radius) {
  gfx.beginShape();
  for (let i = 0; i < 6; i++) {
    let angle = Math.PI / 3 * i + Math.PI / 6;
    let vx = x + radius * Math.cos(angle);
    let vy = y + radius * Math.sin(angle);
    gfx.vertex(vx, vy);
  }
  gfx.endShape(gfx.CLOSE);
}