# Claude - Technical Development Notes

## IMPORTANT: Git Commit Rules

**RULE: Commit after every change.**

When working on this project, Claude MUST:

1. **Commit after every meaningful change** - After completing any code modification, feature addition, bug fix, or file change, immediately create a git commit.

2. **Use descriptive commit messages** - Each commit message should clearly describe what was changed and why.

3. **Commit format**:
   ```bash
   git add -A && git commit -m "Brief description of change"
   ```

4. **Push regularly** - After commits, push to GitHub to ensure changes are backed up:
   ```bash
   git push origin main
   ```

5. **Why this matters**: Frequent commits make it easy to:
   - Roll back if something goes wrong
   - Track what changes were made and when
   - Understand the history of the project
   - Recover from mistakes quickly

**Example workflow**:
- Make a change to game.js
- `git add -A && git commit -m "Add enemy collision detection"`
- `git push origin main`
- Continue to next task

---

## Project Overview
TheMoonCristal is a JavaScript-based 2D platformer game designed for children. The game uses vanilla JavaScript with HTML5 Canvas for rendering, with a pixel art aesthetic.

## Architecture

### Core Technologies
- **HTML5 Canvas** for rendering
- **Vanilla JavaScript** (no frameworks)
- **CSS** for layout and pixel-perfect rendering
- **RequestAnimationFrame** for game loop

### Code Structure

#### Main Game Loop
The game uses a standard game loop pattern with `requestAnimationFrame`:
```javascript
gameLoop() {
    update()  // Update game state
    draw()    // Render everything
    requestAnimationFrame(gameLoop)
}
```

#### Key Systems

1. **Input System**
   - Event-driven keyboard input
   - Key state tracking via `keys` object
   - Separate handlers for keydown/keyup

2. **Physics System**
   - Gravity: 0.5 pixels/frame²
   - Velocity-based movement
   - Basic AABB collision detection

3. **Health System**
   - Current health and max health tracking
   - Invincibility frames after damage
   - Visual feedback (flashing) during invincibility

4. **Combat System**
   - Arrow projectiles with arc physics
   - Rate limiting (2 arrows/second)
   - Directional shooting based on player facing

## Implementation Details

### Player Object Structure
```javascript
player = {
    x, y,              // Position
    width, height,     // Dimensions
    velocityX, velocityY,  // Movement
    onGround,          // Ground state
    facingRight,       // Direction
    currentPlatform    // Platform tracking for jump-through
}
```

### Collision Detection
Uses Axis-Aligned Bounding Box (AABB) collision:
```javascript
checkCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y
}
```

### Platform System
Two types of platforms:
- **Solid platforms** (`solid: true`): Full collision on all sides
- **Jump-through platforms** (`solid: false`): Only top collision when falling

### Jump-Through Mechanics
- Player can jump up through jump-through platforms
- Player lands on top when falling
- Down arrow drops through when standing on one
- Tracks `currentPlatform` to know which platform player is on

### Arrow Physics
Arrows use simplified projectile motion:
- Constant horizontal velocity (ARROW_SPEED * direction)
- Vertical velocity affected by gravity (0.4 * GRAVITY)
- Creates arcing trajectory

### Health & Damage System
- **Damage Function**: Reduces health, triggers invincibility, checks for game over
- **Invincibility**: 1000ms timer-based, prevents repeated damage
- **Visual Feedback**: Player flashes by alternating opacity during invincibility
- **Health Potions**: Increase both current health and max health

### Game State Management
Currently using global flags:
- `gameOver`: Boolean for game over state
- `health`: Current health value
- `maxHealth`: Maximum health capacity
- `invincible`: Invincibility state
- `invincibleTimer`: Timestamp for invincibility duration

## Technical Decisions

### Why Vanilla JavaScript?
- No build process needed
- Lightweight and fast
- Easy to understand for educational purposes
- Simple deployment (just open HTML file)

### Why Fixed Screen Size?
- Simplifies level design
- Easier collision detection
- Pixel-perfect rendering
- Consistent gameplay experience

### Rendering Approach
Using `image-rendering: pixelated` CSS property to maintain sharp pixel art when scaling if needed.

## Performance Considerations

### Current Optimization Strategies
- Remove off-screen arrows to prevent memory buildup
- Use array splicing for efficient removal
- Fixed delta time (assumes 60fps) - may need variable delta time later

### Potential Optimizations Needed
- Spatial partitioning for collision detection if many objects
- Object pooling for arrows if performance issues arise
- Canvas layering if background is complex

## Known Limitations

1. **Fixed Time Step**: Assumes consistent 60fps, may behave differently on slower devices
2. **No Camera System**: Screen is fixed, limits level size
3. **Global State**: All state is global, could be refactored into game state object
4. **No Asset Loading**: Everything is drawn with primitives, no image/sprite support yet
5. **Collision Detection**: Basic AABB only, no slope support

## Game Constants Reference

```javascript
GRAVITY = 0.5
JUMP_STRENGTH = -12
MOVE_SPEED = 5
ARROW_SPEED = 8
ARROW_COOLDOWN = 500ms
INVINCIBILITY_TIME = 1000ms
```

## Platform Coordinates (Test Level)

| Element | X | Y | Width | Height | Type |
|---------|---|---|-------|--------|------|
| Ground | 0 | 550 | 1000 | 50 | Solid |
| Box 1 | 300 | 450 | 100 | 100 | Solid |
| Box 2 | 600 | 450 | 100 | 100 | Solid |
| Ledge 1 | 600 | 350 | 150 | 20 | Jump-through |
| Ledge 2 | 750 | 250 | 150 | 20 | Jump-through |
| Spike | 450 | 530 | 40 | 20 | Hazard |
| Health Potion | 800 | 220 | 15 | 15 | Collectible |

## Development Timeline

### Session 1 - Core Mechanics
1. Created basic HTML/CSS structure
2. Implemented player movement and controls
3. Added jump mechanics
4. Added platform collision (solid and jump-through)
5. Implemented arrow shooting with directional facing
6. Added drop-through mechanic for jump-through platforms
7. Implemented health system with hearts display
8. Added spike hazards and damage
9. Added invincibility frames
10. Implemented health potions
11. Added game over and restart functionality

## Future Technical Considerations

### Refactoring Needs
- Move to class-based architecture (Player, Enemy, Projectile, Platform classes)
- Implement game state machine for menu/playing/paused/gameover states
- Create level data structure for easier level design
- Add asset loading system for sprites

### Scalability
- Camera/viewport system for larger levels
- Tilemap system for efficient level rendering
- Entity component system if complexity increases

### Code Quality
- Add JSDoc comments
- Split into multiple files/modules
- Add error handling
- Implement debug mode with collision box visualization

## Testing Notes
- All core mechanics tested in test screen
- Need to test edge cases (simultaneous damage sources, collecting potion at max health, etc.)
- Need playtesting with target audience
