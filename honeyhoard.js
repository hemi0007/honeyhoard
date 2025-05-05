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
let fallInterval = 150; // Start at 2.5 seconds per drop (60fps)
let minFallInterval = 20; // Minimum speed (frames per drop)
let speedupInterval = 1800; // 30 seconds at 60fps
let lastSpeedupFrame = 0;
let lastFall = 0; // Last frame when the piece fell
let gameOver = false;
let softDrop = false;
let lastRotateFrame = 0;
let gameStarted = false;
let bearHoneyImg;
let bee2Img;
let bee1Img;
let gameOverSound;
let streakSound;
let soundVolume = 1.0; // Global sound volume (0.0 to 1.0)
let allSounds = [];
let clearedHexes = new Set(); // <-- moved here to ensure early initialization
let clearAnimFrame = 0;
const CLEAR_ANIM_DURATION = 12; // frames for pop/glow
let scoreAnimFrame = 0;
const SCORE_ANIM_DURATION = 24; // frames (0.4s at 60fps)
let lastScore = 0;
let uiFont; // <-- moved here to ensure early initialization

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

// Draw a hexagon with a radial gradient fill and a soft drop shadow
function drawGradientHexagonWithShadow(x, y, radius, colorCenter, colorEdge) {
  // Draw soft shadow
  push();
  noStroke();
  fill(40, 20, 0, 60); // Soft brown shadow, semi-transparent
  drawHexagon(x + radius * 0.12, y + radius * 0.18, radius * 1.08);
  pop();
  // Draw the gradient hexagon
  drawGradientHexagon(x, y, radius, colorCenter, colorEdge);
  // Draw gold border (thicker)
  push();
  stroke(255, 215, 80); // Gold
  strokeWeight(5);
  noFill();
  drawHexagon(x, y, radius);
  pop();
  // Draw dark brown outer border (thinner)
  push();
  stroke(92, 46, 0); // Dark brown
  strokeWeight(2);
  noFill();
  drawHexagon(x, y, radius * 1.04);
  pop();
}

// Draw a hexagon with a radial gradient fill
function drawGradientHexagon(x, y, radius, colorCenter, colorEdge) {
  let gfx = createGraphics(radius * 2, radius * 2);
  gfx.noStroke();
  for (let r = radius; r > 0; --r) {
    let inter = map(r, 0, radius, 0, 1);
    let c = lerpColor(colorCenter, colorEdge, inter);
    gfx.fill(c);
    gfx.push();
    gfx.translate(radius, radius);
    gfx.beginShape();
    for (let i = 0; i < 6; i++) {
      let angle = PI / 3 * i + PI / 6;
      let vx = r * cos(angle);
      let vy = r * sin(angle);
      gfx.vertex(vx, vy);
    }
    gfx.endShape(CLOSE);
    gfx.pop();
  }
  image(gfx, x - radius, y - radius);
}

// Generate a new piece at the top of the grid
function generatePiece() {
  try {
    const shapeIndex = floor(random(shapes.length));
    const shape = shapes[shapeIndex].map(([dq, dr]) => new Hex(dq, dr));
    const startHex = new Hex(2, -R); // or your spawn logic
    piece = {
      hexPos: startHex,
      shape: shape,
      pixelPos: hexToPixel(startHex) // NEW: track pixel position
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
  // Move the piece's pixel position straight down by one hex row
  let newPixelPos = piece.pixelPos.copy();
  newPixelPos.y += size * 1.5; // vertical distance between hex rows (pointy-top)

  // Snap to nearest hex
  let newHexPos = pixelToHex(newPixelPos);

  if (canPlace(newHexPos, piece.shape)) {
    piece.pixelPos = newPixelPos;
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
    piece.pixelPos = hexToPixel(newHexPos);
  }
}

// Move the piece right
function movePieceRight() {
  let newHexPos = new Hex(piece.hexPos.q + 1, piece.hexPos.r);
  if (canPlace(newHexPos, piece.shape)) {
    piece.hexPos = newHexPos;
    piece.pixelPos = hexToPixel(newHexPos);
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
    // pixelPos stays the same, hexPos stays the same
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

// === SUPABASE LEADERBOARD INTEGRATION START ===
// Add your Supabase project URL and anon key here
const SUPABASE_URL = 'https://ikfbshpayzrrqzcppfez.supabase.co'; // TODO: Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmJzaHBheXpycnF6Y3BwZmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0NzE5NDIsImV4cCI6MjA2MjA0Nzk0Mn0.748o5jqh5Flo5_Hz_o7IqBllbc4olKT3OBU0dU8Bvwg'; // TODO: Replace with your anon key
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Show leaderboard in the game over popup only
async function showLeaderboardInGameOver() {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('username, score')
    .order('score', { ascending: false })
    .limit(10);
  const overlay = document.getElementById('gameOverOverlay');
  if (!overlay) return;
  // Find the inner div (the popup box)
  const innerDiv = overlay.querySelector('div');
  if (!innerDiv) return;
  // Remove any previous leaderboard
  let oldBoard = innerDiv.querySelector('.leaderboard-box');
  if (oldBoard) oldBoard.remove();
  let html = '<div class="leaderboard-box" style="margin-bottom:24px;">';
  html += '<h2 style="color:#a0522d;margin-bottom:10px;">Top 10 Leaders</h2>';
  if (error) {
    html += '<div style="color:#c00;">Error loading leaderboard.</div>';
  } else {
    html += '<ol style="text-align:left; font-size:1.2em; margin:0 auto; display:inline-block;">';
    for (const row of data) {
      html += `<li><b>${row.username}</b>: ${row.score}</li>`;
    }
    html += '</ol>';
  }
  html += '</div>';
  // Insert leaderboard before the h1 (Game Over)
  const h1 = innerDiv.querySelector('h1');
  if (h1) {
    h1.insertAdjacentHTML('beforebegin', html);
  } else {
    innerDiv.insertAdjacentHTML('afterbegin', html);
  }
}

function showGameOver() {
  gameOver = true;
  if (gameOverSound && gameOverSound.isLoaded()) {
    gameOverSound.setVolume(soundVolume);
    gameOverSound.play();
  }
  if (typeof document !== 'undefined') {
    const scoreElem = document.getElementById('finalScore');
    if (scoreElem) scoreElem.textContent = `Your Score: ${score}`;
    const overlay = document.getElementById('gameOverOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
      setTimeout(() => overlay.classList.add('show'), 10);
      // Show leaderboard above Game Over
      showLeaderboardInGameOver();
    }
    // Attach event listeners for Share My Score and My Receipts buttons
    const shareBtn = document.getElementById('shareScoreBtn');
    if (shareBtn) {
      shareBtn.onclick = shareScore;
    }
    const addToLeaderboardBtn = document.getElementById('addToLeaderboardBtn');
    const usernameModal = document.getElementById('usernameModal');
    if (addToLeaderboardBtn && usernameModal) {
      addToLeaderboardBtn.onclick = () => {
        usernameModal.style.display = 'flex';
        document.getElementById('usernameInput').value = '';
        document.getElementById('usernameError').textContent = '';
      };
    }
  }
}

function restartGame() {
  filled = new Set();
  score = 0;
  fallInterval = 150;
  lastFall = 0;
  gameOver = false;
  loop();
  generatePiece();
  lastSpeedupFrame = frameCount;
  if (typeof document !== 'undefined') {
    const overlay = document.getElementById('gameOverOverlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => overlay.style.display = 'none', 500);
    }
  }
}

// === UI POLISH START ===
function preload() {
  treeBgImg = loadImage('img/background.png');
  honeyImg = loadImage('img/honey.png');
  bgImg = loadImage('img/background.png');
  bearHoneyImg = loadImage('img/bearhoney.png');
  bee2Img = loadImage('img/bee2.png');
  bee1Img = loadImage('img/bee1.png');
  gameOverSound = loadSound('sounds/gameover.mp3', (snd) => {
    snd.setVolume(soundVolume);
  });
  streakSound = loadSound('sounds/streak.mp3', (snd) => {
    snd.setVolume(soundVolume);
  });
  allSounds = [gameOverSound, streakSound];
  // Use a modern, readable font
  uiFont = 'Segoe UI, Roboto, Arial, sans-serif';
}

function setAllSoundVolumes() {
  for (const snd of allSounds) {
    if (snd) snd.setVolume(soundVolume);
  }
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
    if (toRemove.size >= 5) {
      if (streakSound && streakSound.isLoaded()) {
        streakSound.stop();
        streakSound.setVolume(soundVolume);
        streakSound.play();
      }
    }
    if (toRemove.size > 0) {
      // Store for pop/glow animation
      clearedHexes = new Set(toRemove);
      clearAnimFrame = CLEAR_ANIM_DURATION;
      for (let h of toRemove) {
        filled.delete(h);
      }
      let previousScore = score;
      score += toRemove.size * 10;
      if (score > previousScore) {
        scoreAnimFrame = SCORE_ANIM_DURATION;
      }
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
  // Make canvas focusable for keyboard events
  if (canvas.elt) {
    canvas.elt.setAttribute('tabindex', '0');
  }
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
            let scale = 1.0;
            if (isMouseOverHex(p, size) && !gameOver) {
              scale = 1.12;
            }
            drawGradientHexagonWithShadow(
              p.x, p.y, size * scale,
              color(255, 230, 80, 255),   // Center: bright honey
              color(210, 140, 0, 255)     // Edge: deep honey/gold
            );
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
        let scale = 1.0;
        if (isMouseOverHex(p, size) && !gameOver) {
          scale = 1.12;
        }
        if (dragging && absHex.toString() === dragStartHex?.toString()) {
          scale = 1.18;
        }
        drawGradientHexagonWithShadow(
          p.x, p.y, size * scale,
          color(255, 230, 80, 255),   // Center: bright honey
          color(210, 140, 0, 255)     // Edge: deep honey/gold
        );
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
    if (scoreAnimFrame > 0) {
      let animScale = 1 + 0.25 * (scoreAnimFrame / SCORE_ANIM_DURATION);
      let animAlpha = 255 * (0.5 + 0.5 * (scoreAnimFrame / SCORE_ANIM_DURATION));
      push();
      translate(width / 2, btnY + btnH / 2);
      scale(animScale);
      fill(255, 255, 180, animAlpha);
      text(scoreText, 0, 0);
      pop();
      scoreAnimFrame--;
    } else {
      text(scoreText, width / 2, btnY + btnH / 2);
    }

    // Draw bearhoney.png at bottom right, fixed
    if (bearHoneyImg) {
      let marginX, marginY, bearW, bearH;
      if (windowWidth < 700) { // Mobile adjustments: move bear further in
        marginX = 60; // positive margin to move in
        marginY = 10;
        bearW = Math.min(width, height) * 0.22 * 0.9;
      } else {
        marginX = 350;
        marginY = 80;
        bearW = Math.min(width, height) * 0.22 * 1.3 * 1.2;
      }
      bearH = bearW * (bearHoneyImg.height / bearHoneyImg.width);
      image(
        bearHoneyImg,
        width - bearW - marginX,
        height - bearH - marginY,
        bearW,
        bearH
      );
    }

    // Draw three bee2.png images on the left side, scattered and animated
    if (bee2Img) {
      let beeW, beeH, beePositions;
      if (windowWidth < 700) { // Mobile adjustments: move bees further in
        beeW = Math.min(width, height) * 0.08;
        beeH = beeW * (bee2Img.height / bee2Img.width);
        beePositions = [
          { x: 60, y: height * 0.12 + 10 * Math.sin(frameCount * 0.04) },
          { x: 100, y: height * 0.28 + 12 * Math.sin(frameCount * 0.05 + 1) },
          { x: 120, y: height * 0.55 + 8 * Math.sin(frameCount * 0.06 + 2) }
        ];
      } else {
        beeW = Math.min(width, height) * 0.10;
        beeH = beeW * (bee2Img.height / bee2Img.width);
        beePositions = [
          { x: 200, y: height * 0.18 + 18 * Math.sin(frameCount * 0.04) },
          { x: 350, y: height * 0.38 + 22 * Math.sin(frameCount * 0.05 + 1) },
          { x: 400, y: height * 0.65 + 16 * Math.sin(frameCount * 0.06 + 2) }
        ];
      }
      for (let i = 0; i < 2; i++) {
        const pos = beePositions[i];
        image(
          bee2Img,
          pos.x,
          pos.y,
          beeW,
          beeH
        );
      }
    }

    // Draw one bee1.png image on the right side, animated
    if (bee1Img) {
      let beeW, beeH, marginX, y, x;
      if (windowWidth < 700) { // Mobile adjustments: move bee further in
        beeW = Math.min(width, height) * 0.08;
        beeH = beeW * (bee1Img.height / bee1Img.width);
        marginX = 60; // positive margin to move in
        y = height * 0.45 + 10 * Math.sin(frameCount * 0.045 + 3);
        x = width - beeW - marginX + 6 * Math.cos(frameCount * 0.03 + 2);
      } else {
        beeW = Math.min(width, height) * 0.10;
        beeH = beeW * (bee1Img.height / bee1Img.width);
        marginX = 425;
        y = height * 0.45 + 20 * Math.sin(frameCount * 0.045 + 3);
        x = width - beeW - marginX + 12 * Math.cos(frameCount * 0.03 + 2);
      }
      image(
        bee1Img,
        x,
        y,
        beeW,
        beeH
      );
    }

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
  // Allow rotation even while dragging
  if ((keyCode === UP_ARROW || key === 'w' || keyCode === 32) && frameCount - lastRotateFrame > 6) {
    rotatePiece();
    lastRotateFrame = frameCount;
  } else if (!dragging) {
    if (keyCode === LEFT_ARROW || key === 'a') {
      movePieceLeft();
    } else if (keyCode === RIGHT_ARROW || key === 'd') {
      movePieceRight();
    } else if (keyCode === DOWN_ARROW || key === 's') {
      softDrop = true;
    }
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
      // Ensure canvas is focused for keyboard events
      if (window._renderer && window._renderer.canvas) {
        window._renderer.canvas.focus();
      }
      return;
    }
  }
}

function mouseDragged() {
  if (!dragging || gameOver) return;
  // Ensure canvas is focused for keyboard events
  if (window._renderer && window._renderer.canvas) {
    window._renderer.canvas.focus();
  }
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
  fallInterval = 150;
  lastFall = 0;
  gameOver = false;
  loop(); // Start the draw loop immediately
  generatePiece();
  lastSpeedupFrame = frameCount;
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

const GAME_URL = "https://hemi0007.github.io/honeyhoard/";

function shareScore() {
  let shareText = `🐝 I scored ${score} in Honey Hoard! 🍯 Can you beat me?`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  window.open(tweetUrl, '_blank');
}

window.addEventListener('DOMContentLoaded', () => {
  const slider = document.getElementById('soundVolumeSlider');
  const label = document.getElementById('soundVolumeLabel');
  if (slider && label) {
    slider.value = Math.round(soundVolume * 100);
    label.textContent = `${slider.value}%`;
    slider.addEventListener('input', () => {
      soundVolume = slider.value / 100;
      label.textContent = `${slider.value}%`;
      setAllSoundVolumes();
    });
  }
  // === SUPABASE LEADERBOARD INTEGRATION: USERNAME MODAL LOGIC ===
  const usernameModal = document.getElementById('usernameModal');
  const usernameInput = document.getElementById('usernameInput');
  const usernameError = document.getElementById('usernameError');
  const submitUsernameBtn = document.getElementById('submitUsernameBtn');

  function validateUsername(name) {
    // Allow 1-25 alphanumeric, no spaces/symbols, uppercase
    return /^[A-Z0-9]{1,25}$/.test(name);
  }

  async function submitUsernameAndScore() {
    const username = usernameInput.value.trim().toUpperCase();
    if (!validateUsername(username)) {
      usernameError.textContent = 'Username must be 1-25 letters/numbers.';
      return;
    }
    if (score === 0) {
      usernameError.textContent = 'Score must be greater than 0 to submit.';
      return;
    }
    // Insert score (no uniqueness check)
    const { error: insertError } = await supabase
      .from('leaderboard')
      .insert([{ username, score }]);
    if (insertError) {
      usernameError.textContent = 'Error saving score. Try again.';
      return;
    }
    // Hide modal and show leaderboard
    usernameModal.style.display = 'none';
    showLeaderboardInGameOver();
  }

  if (submitUsernameBtn) {
    submitUsernameBtn.addEventListener('click', submitUsernameAndScore);
  }
  if (usernameInput) {
    usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitUsernameAndScore();
    });
  }
});

// Listen for right-click (contextmenu) to rotate while dragging
window.addEventListener('contextmenu', function(e) {
  if (dragging) {
    e.preventDefault();
    rotatePiece();
    lastRotateFrame = frameCount;
    return false;
  }
}, false);

// Touch gesture: two-finger tap to rotate while dragging
window.addEventListener('touchstart', function(e) {
  if (dragging && e.touches.length === 2) {
    rotatePiece();
    lastRotateFrame = frameCount;
    // Optionally, prevent zoom
    e.preventDefault();
  }
}, { passive: false });

// Utility: check if mouse is over a hex center
function isMouseOverHex(p, size) {
  return dist(mouseX, mouseY, p.x, p.y) < size * 0.95;
}