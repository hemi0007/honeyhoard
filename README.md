# Honey Hoard

A browser-based hexagonal honeycomb puzzle game built with p5.js.

## Features
- True hexagonal grid gameplay
- Drag-and-drop or keyboard controls
- Responsive, visually appealing UI
- Multiple honeycomb piece shapes (including tetrominoes)
- Lines of 5 or more honeycombs clear and score points
- Game starts slow and speeds up every 30 seconds
- Pause, restart, and how-to-play modal

## How to Play
- **Start the game** by clicking the "Start Game" button. The game begins immediately.
- **Move** the falling honeycomb piece left/right with the arrow keys or **A/D** keys, or drag it with your mouse.
- **Rotate** the piece with the up arrow, **W**, or spacebar.
- **Soft drop** the piece with the down arrow or **S** key (release to stop soft drop).
- **Pause/unpause** the game with the **P** key at any time.
- **Clear lines** by connecting 5 or more honeycombs in a row.
- The game ends if a piece reaches the top of the board.

## Controls
- **Left/Right Arrow** or **A/D**: Move piece left/right
- **Down Arrow** or **S**: Soft drop (release to stop)
- **Up Arrow**, **W**, or **Spacebar**: Rotate piece
- **P**: Pause/unpause
- **Mouse**: Drag and drop pieces

## Setup & Running Locally
1. Clone or download this repository.
2. Make sure you have a local web server (e.g. [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for VSCode, or `python -m http.server`).
3. Place all files (including the `img` folder with images) in the same directory.
4. Open `index.html` in your browser via your local server.

## Credits
- Built with [p5.js](https://p5js.org/)
- Art assets: Provided in the `img` folder (tree background, honeycomb, etc.)

---
Enjoy playing Honey Hoard! 