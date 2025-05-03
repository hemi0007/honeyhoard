// Global variables
let R = 5; // Hexagon radius (distance from center to corner)
let size = 30; // Hexagon radius in pixels
let origin = null; // Will be set in setup
let filled = new Set(); // Stores filled hex positions as "q,r" strings
let score = 0;
let piece; // Current falling piece
let bg; // Graphics buffer for background
let lastError = null; // Store last error for display
let honeyImg;
let bgImg; // Background image
let fallInterval = 45; // Start slower
let minFallInterval = 8; // Minimum speed
let lastFall = 0; // Last frame when the piece fell
let gameOver = false;
let softDrop = false;
let paused = false;
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
      hexPos: new Hex(0, -R), // Spawn at the top row
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

// Remove completed lines and handle chain reactions
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

// Setup function: initialize canvas and assets
function setup() {
  let canvas = createCanvas(800, 800);
  canvas.style('display', 'block');
  canvas.style('margin', 'auto');
  origin = createVector(width / 2, height / 2); // Center the grid

  // Initialize graphics buffer and draw the background image
  bg = createGraphics(width, height);
  if (bgImg) {
    // Draw at 109% of natural size, centered
    const scale = 1.22;
    const imgW = bgImg.width * scale;
    const imgH = bgImg.height * scale;
    let x = (width - imgW) / 2;
    let y = (height - imgH) / 2;
    bg.clear();
    bg.image(bgImg, x, y, imgW, imgH);
  }

  // Do not start the game until user clicks Start
  noLoop();
}

function preload() {
  honeyImg = loadImage('img/honey.png');
  bgImg = loadImage('img/tree.png'); // Load background image
}

// Draw function: render the game
function draw() {
  if (!gameStarted) {
    background(0, 0, 0, 0); // Blank screen until started
    return;
  }
  try {
    if (paused) {
      background(0, 0, 0, 180);
      fill(255, 255, 0);
      textSize(48);
      textAlign(CENTER, CENTER);
      text('Paused', width/2, height/2);
      return;
    }
    background(0);
    image(bg, 0, 0); // Draw background from buffer

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

    // Draw current piece
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
    }

    // Draw score as a button
    const scoreText = `Score: ${score}`;
    textSize(32);
    const paddingX = 32;
    const paddingY = 12;
    const btnW = textWidth(scoreText) + paddingX * 2;
    const btnH = 48;
    const btnX = width / 2 - btnW / 2;
    const btnY = 18;
    // Draw button background
    push();
    noStroke();
    fill(40, 30, 10, 220); // dark, semi-transparent shadow
    rect(btnX + 3, btnY + 4, btnW, btnH, 18); // shadow
    fill('#D68C1F'); // Play button yellow
    rect(btnX, btnY, btnW, btnH, 18);
    pop();
    // Draw score text
    fill('#F8F0DE');
    textAlign(CENTER, CENTER);
    text(scoreText, width / 2, btnY + btnH / 2);

    // Automatic falling (soft drop if down arrow held)
    let currentInterval = softDrop ? 6 : fallInterval;
    if (!dragging && frameCount - lastFall >= currentInterval) {
      movePieceDown();
      lastFall = frameCount;
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
  if (key === 'p' || key === 'P') {
    paused = !paused;
    if (paused) {
      noLoop();
    } else {
      loop();
    }
    return;
  }
  if (keyCode === LEFT_ARROW) {
    movePieceLeft();
  } else if (keyCode === RIGHT_ARROW) {
    movePieceRight();
  } else if ((keyCode === UP_ARROW || keyCode === 32) && frameCount - lastRotateFrame > 6) {
    rotatePiece();
    lastRotateFrame = frameCount;
  } else if (keyCode === DOWN_ARROW) {
    softDrop = true;
  }
}

function keyReleased() {
  if (keyCode === DOWN_ARROW) {
    softDrop = false;
  }
}

function mousePressed() {
  if (gameOver || paused) return;
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
  if (!dragging || gameOver || paused) return;
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
  if (!dragging || gameOver || paused) return;
  dragging = false;
  // Only place the piece if it was actually dragged
  if (draggedFarEnough && canPlace(piece.hexPos, piece.shape)) {
    placePiece();
  } else {
    piece.hexPos = dragStartHex;
  }
}

window.addEventListener('resize', function() {
  let minDim = Math.min(windowWidth, windowHeight) * 0.95;
  resizeCanvas(minDim, minDim);
  origin = createVector(width / 2, height / 2);
  // Redraw background buffer if needed
  if (bgImg) {
    bg = createGraphics(width, height);
    // Draw at 109% of natural size, centered
    const scale = 0.80;
    const imgW = bgImg.width * scale;
    const imgH = bgImg.height * scale;
    let x = (width - imgW) / 2;
    let y = (height - imgH) / 2;
    bg.clear();
    bg.image(bgImg, x, y, imgW, imgH);
  }
});

function startGame() {
  gameStarted = true;
  filled = new Set();
  score = 0;
  fallInterval = 45;
  lastFall = 0;
  gameOver = false;
  paused = false;
  loop();
  generatePiece();
}