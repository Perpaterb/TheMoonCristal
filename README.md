# TheMoonCristal

A simple pixel art platformer game for kids built with JavaScript and HTML5 Canvas.

## Game Overview

TheMoonCristal is a 2D platformer where you control a character named "you" who can jump, shoot arrows, and collect health potions while avoiding spikes.

## Technical Specifications

- **Screen Size:** 1000px wide × 600px high (fixed)
- **Art Style:** Pixel art
- **Platform:** Web browser (HTML5 Canvas)

## Current Features

### Player Mechanics
- **Movement:** Left/Right arrow keys
- **Jump:** Up arrow key
- **Drop Through Platforms:** Down arrow (when on jump-through ledges)
- **Shoot Arrows:** Spacebar (max 2 arrows per second)
- **Arrow Direction:** Arrows shoot in the direction the player last moved (left/right)
- **Arrow Physics:** Arrows have an arcing trajectory affected by gravity

### Health System
- **Starting Health:** 3 hearts
- **Max Health:** Can be increased up to 5 hearts by collecting health potions
- **Invincibility:** 1 second of invincibility after taking damage (player flashes)
- **Health Display:** Hearts shown in top-left corner (red = full, gray = lost)
- **Game Over:** When all hearts are lost, game pauses and shows Game Over screen
- **Restart:** Press Space on Game Over screen to restart

### Level Elements (Test Screen)
- **Ground:** Full-width brown platform at bottom
- **Solid Boxes:** Two climbable boxes (one standalone, one under first ledge)
- **Jump-Through Ledges:** Two golden platforms you can jump through from below
- **Spikes:** Gray spike traps that damage the player
- **Health Potions:** Collectible magenta potions that increase max health (disappear after collection)

### Current Test Level Layout
- Solid box at position (300, 450)
- Box under ledge at (600, 450)
- First jump-through ledge at (600, 350)
- Second jump-through ledge at (750, 250)
- Spike trap at (450, 530)
- Health potion on upper ledge at (800, 220)

## Controls

| Key | Action |
|-----|--------|
| ← → | Move left/right |
| ↑ | Jump |
| ↓ | Drop through jump-through platforms |
| Space | Shoot arrow / Restart game (on Game Over) |

## File Structure

```
TheMoonCristal/
├── index.html       # Main HTML file with canvas
├── style.css        # Styling and pixel art rendering
├── game.js          # Game logic and mechanics
├── README.md        # This file
├── next-steps.md    # Development roadmap
└── claude.md        # Technical notes and development log
```

## How to Run

1. Open `index.html` in a modern web browser
2. Use arrow keys and spacebar to play
3. No build process or dependencies required

## Game Constants

- Gravity: 0.5
- Jump Strength: -12
- Move Speed: 5 pixels/frame
- Arrow Speed: 8 pixels/frame
- Arrow Cooldown: 500ms (2 arrows/second)
- Invincibility Duration: 1000ms (1 second)

## Development Status

Currently in prototype/testing phase. The test screen is being used to refine core mechanics before building full levels.
