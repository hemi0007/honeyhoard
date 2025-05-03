// Global variables
let R = 5; // Hexagon radius (distance from center to corner)
let size = 20; // Hexagon radius in pixels
let origin = null; // Will be set in setup
let filled = new Set(); // Stores filled hex positions as "q,r" strings
let score = 0;
let piece; // Current draggable piece
let dragging = false;
let bg; // Graphics buffer for background

// Predefined shapes (polyhexes) as arrays of [q,r] offsets
const shapes = [
  [[0, 0]],                     // Single hex
  [[0, 0], [1, 0]],            // Domino
  [[0, 0], [1, 0], [2, 0]],    // Straight tromino
  [[0, 0], [1, 0], [0, 1]]     // Bent tromino
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
  const q = ((p.x - origin.x) * Math.sqrt(3)/3 - (p.y - origin.y) / 3) / size;
  const r = (2/3 * (p.y - origin.y)) / size;
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
  // Hex is within hexagonal boundary if max(|q|, |r|, |s|) <= R
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

// Generate a new piece with shape and pixel offsets
function generatePiece() {
  const shapeIndex = floor(random(shapes.length));
  const shape = shapes[shapeIndex].map(([dq, dr]) => new Hex(dq, dr));
  const pixelOffsets = shape.map(offset => p5.Vector.sub(hexToPixel(offset), hexToPixel(new Hex(0, 0))));
  piece = {
    shape: shape,
    pixelOffsets: pixelOffsets,
    pos: createVector(width / 2, height - 100) // Starting position below grid
  };
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
        if (line.length >= 3) {
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
      score += toRemove.size * 10; // 10 points per hex removed
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

  // Generate tree bark background with noise
  bg = createGraphics(width, height);
  bg.loadPixels();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let n = noise(x * 0.01, y * 0.01);
      let c = color(139 + n * 50, 69 + n * 50, 19 + n * 50); // Brown shades
      bg.set(x, y, c);
    }
  }
  bg.updatePixels();

  generatePiece();
}

// Draw function: render the game
function draw() {
  background(0);
  // if (treeBgImg) {
  //   image(treeBgImg, 0, 0, width, height);
  // }
  image(bg, 0, 0); // Draw tree bark background

  // Draw hexagonal grid (true hexagon)
  for (let q = -R; q <= R; q++) {
    for (let r = -R; r <= R; r++) {
      let s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > R) continue;
      let hex = new Hex(q, r);
      let p = hexToPixel(hex);
      if (filled.has(hex.toString())) {
        fill(255, 204, 0); // Yellow for honey-filled hexes
      } else {
        fill(200); // Gray for empty hexes
      }
      noStroke();
      drawHexagon(p.x, p.y, size);
    }
  }

  // Draw current piece
  for (let i = 0; i < piece.shape.length; i++) {
    let offset = piece.pixelOffsets[i];
    let drawPos = p5.Vector.add(piece.pos, offset);
    fill(255, 204, 0); // Yellow for honey
    noStroke();
    drawHexagon(drawPos.x, drawPos.y, size);
  }

  // Draw score
  textSize(32);
  fill(255);
  text(`Score: ${score}`, 10, 30);
}

// Handle mouse press to start dragging
function mousePressed() {
  let d = dist(mouseX, mouseY, piece.pos.x, piece.pos.y);
  if (d < size * 1.5) { // Clicked near piece center
    dragging = true;
  }
}

// Update piece position while dragging
function mouseDragged() {
  if (dragging) {
    piece.pos.set(mouseX, mouseY);
  }
}

// Handle mouse release to place piece
function mouseReleased() {
  if (dragging) {
    dragging = false;
    let targetHex = pixelToHex(piece.pos);
    let canPlace = true;
    for (let offset of piece.shape) {
      let absHex = targetHex.add(offset);
      if (!isWithinBounds(absHex) || filled.has(absHex.toString())) {
        canPlace = false;
        break;
      }
    }
    if (canPlace) {
      for (let offset of piece.shape) {
        let absHex = targetHex.add(offset);
        filled.add(absHex.toString());
      }
      removeLines();
      generatePiece();
    }
  }
}