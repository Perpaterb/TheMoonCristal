// Game canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const GRAVITY = 0.5;
const JUMP_STRENGTH = -12;
const MOVE_SPEED = 5;
const ARROW_SPEED = 8;
const ARROW_COOLDOWN = 500; // 500ms between arrows = 2 arrows per second
const INVINCIBILITY_TIME = 1000; // 1 second of invincibility after getting hit

// Arrow shooting cooldown
let lastArrowTime = 0;
let arrowPending = false;
let arrowPendingTime = 0;
const ARROW_DELAY = 200; // 0.2 second delay before arrow fires

// Game state
let gameOver = false;
let levelComplete = false;
let health = 3;
const maxHealth = 5; // Fixed max hearts
let invincible = false;
let invincibleTimer = 0;
let activeMessage = null; // Currently displayed message from message block

// Sprite sheets
const sprites = {
    run: { img: new Image(), frames: 8, loaded: false },
    jump: { img: new Image(), frames: 6, loaded: false },
    land: { img: new Image(), frames: 9, loaded: false },
    shoot: { img: new Image(), frames: 12, loaded: false }
};

// Load sprite sheets
sprites.run.img.onload = () => sprites.run.loaded = true;
sprites.jump.img.onload = () => sprites.jump.loaded = true;
sprites.land.img.onload = () => sprites.land.loaded = true;
sprites.shoot.img.onload = () => sprites.shoot.loaded = true;

sprites.run.img.src = 'Run/player run 48x48.png';
sprites.jump.img.src = 'Jump/player new jump 48x48.png';
sprites.land.img.src = 'Land/player land 48x48.png';
sprites.shoot.img.src = 'Shooting (two-handed)/player shoot 2H 48x48.png';

const SPRITE_SIZE = 48;
const SPRITE_SCALE = 2; // Draw sprite at 2x size

// Camera system
const camera = {
    x: 0,
    y: 0
};

// Center camera on a specific point (used for start point)
function centerCameraOn(x, y) {
    const level = getCurrentLevel();
    if (!level) return;

    // Center camera on the given position
    camera.x = x - canvas.width / 2;
    camera.y = y - canvas.height / 2;

    // Clamp camera to level bounds
    camera.x = Math.max(0, Math.min(camera.x, level.width - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, level.height - canvas.height));
}

// Current level
let currentLevelNum = 1;
let currentLevel = null;
let levelsLoaded = false;

// Load level from JSON file
async function loadLevel(levelNum) {
    try {
        const response = await fetch(`levels/${levelNum}.json`);
        if (!response.ok) {
            throw new Error(`Level ${levelNum} not found`);
        }
        const levelData = await response.json();
        return levelData;
    } catch (error) {
        console.error(`Error loading level ${levelNum}:`, error);
        return null;
    }
}

// Initialize game with first level
async function initGame() {
    console.log('initGame started');
    currentLevel = await loadLevel(currentLevelNum);

    if (!currentLevel) {
        console.error('Failed to load level 1');
        return;
    }

    console.log('Level loaded:', currentLevel);
    console.log('Player start:', currentLevel.playerStart);

    // Set player starting position from level's start point
    player.x = currentLevel.playerStart.x;
    player.y = currentLevel.playerStart.y;

    levelsLoaded = true;

    // Initialize monsters from level data
    initMonsters();

    // Center camera on start point
    centerCameraOn(currentLevel.playerStart.x, currentLevel.playerStart.y);

    console.log('Camera centered on start point:', camera.x, camera.y);
    console.log('Player position:', player.x, player.y);

    // Start game loop
    gameLoop();
}

// Get current level data
function getCurrentLevel() {
    return currentLevel;
}

// Input tracking
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    // Shoot arrow on spacebar press (with cooldown) or restart on game over/level complete
    if (e.key === ' ') {
        e.preventDefault();
        if (gameOver || levelComplete) {
            restartGame();
        } else {
            const currentTime = Date.now();
            if (currentTime - lastArrowTime >= ARROW_COOLDOWN && !arrowPending) {
                // Start shooting animation and delay arrow
                arrowPending = true;
                arrowPendingTime = currentTime;
                player.shootingTimer = currentTime;
                lastArrowTime = currentTime;
            }
        }
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Player object
const player = {
    x: 111,
    y: 2836, // Start in maze
    width: 48, // Collision box (1/8 smaller on each side)
    height: 56, // Collision box (half height, feet area)
    velocityX: 0,
    velocityY: 0,
    onGround: false,
    color: '#ff6b6b',
    facingRight: true, // Track which direction player is facing
    currentPlatform: null, // Track which platform player is standing on
    // Animation state
    animationFrame: 0,
    animationTimer: 0,
    state: 'idle', // idle, running, jumping, landing, shooting
    shootingTimer: 0,
    wasInAir: false // Track if player was in air (for landing animation)
};

// Animation constants
const ANIMATION_SPEED = 80; // ms per frame
const SHOOTING_DURATION = 400; // ms to show shooting animation (enough for all frames)

// Arrows array
const arrows = [];

// Monster constants
const MONSTER_SPEED = 2;
const MONSTER_JUMP_STRENGTH = -10;
const MONSTER_DETECTION_RANGE = 600;
const MONSTER_KNOCKBACK = 8;
const MONSTER_MAX_HEALTH = 3;

// Active monsters array (populated from level data)
let monsters = [];

// Initialize monsters from level data
function initMonsters() {
    const level = getCurrentLevel();
    if (!level || !level.monsters) {
        monsters = [];
        return;
    }

    monsters = level.monsters.map(m => ({
        x: m.x,
        y: m.y,
        width: 50,
        height: 40,
        velocityX: 0,
        velocityY: 0,
        health: MONSTER_MAX_HEALTH,
        patrolMinX: m.patrolMinX,
        patrolMaxX: m.patrolMaxX,
        patrolDir: 1, // 1 = right, -1 = left
        onGround: false,
        facingRight: true,
        isChasing: false,
        knockbackTimer: 0,
        animFrame: 0,
        animTimer: 0
    }));
}

// Update all monsters
function updateMonsters() {
    const level = getCurrentLevel();
    if (!level) return;

    for (let i = monsters.length - 1; i >= 0; i--) {
        const monster = monsters[i];

        // Skip if in knockback
        if (monster.knockbackTimer > 0) {
            monster.knockbackTimer--;
            monster.velocityX *= 0.8; // Friction during knockback
        } else {
            // Check distance to player
            const dx = player.x - monster.x;
            const dy = player.y - monster.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < MONSTER_DETECTION_RANGE) {
                // Chase player
                monster.isChasing = true;
                if (dx > 10) {
                    monster.velocityX = MONSTER_SPEED;
                    monster.facingRight = true;
                } else if (dx < -10) {
                    monster.velocityX = -MONSTER_SPEED;
                    monster.facingRight = false;
                } else {
                    monster.velocityX = 0;
                }

                // Jump if player is above and monster is on ground
                if (dy < -50 && monster.onGround) {
                    monster.velocityY = MONSTER_JUMP_STRENGTH;
                    monster.onGround = false;
                }
            } else {
                // Patrol mode
                monster.isChasing = false;
                monster.velocityX = MONSTER_SPEED * monster.patrolDir;
                monster.facingRight = monster.patrolDir > 0;

                // Reverse direction at patrol bounds
                if (monster.x <= monster.patrolMinX) {
                    monster.patrolDir = 1;
                } else if (monster.x + monster.width >= monster.patrolMaxX) {
                    monster.patrolDir = -1;
                }
            }
        }

        // Apply gravity
        monster.velocityY += GRAVITY;

        // Update position
        monster.x += monster.velocityX;
        monster.y += monster.velocityY;

        // Platform collision
        monster.onGround = false;
        for (let platform of level.platforms) {
            if (checkCollision(monster, platform)) {
                if (platform.solid) {
                    const prevBottom = monster.y + monster.height - monster.velocityY;

                    if (monster.velocityY > 0 && prevBottom <= platform.y) {
                        monster.y = platform.y - monster.height;
                        monster.velocityY = 0;
                        monster.onGround = true;
                    } else if (monster.velocityY < 0) {
                        monster.y = platform.y + platform.height;
                        monster.velocityY = 0;
                    }
                } else {
                    // Jump-through platform
                    if (monster.velocityY > 0 && monster.y + monster.height - monster.velocityY <= platform.y + 5) {
                        monster.y = platform.y - monster.height;
                        monster.velocityY = 0;
                        monster.onGround = true;
                    }
                }
            }
        }

        // Keep in level bounds
        if (monster.x < 0) monster.x = 0;
        if (monster.x + monster.width > level.width) monster.x = level.width - monster.width;
        if (monster.y + monster.height > level.height) {
            monster.y = level.height - monster.height;
            monster.velocityY = 0;
            monster.onGround = true;
        }

        // Check collision with player (damage player)
        if (checkCollision(monster, player)) {
            damagePlayer();
        }

        // Update animation
        monster.animTimer++;
        if (monster.animTimer > 10) {
            monster.animTimer = 0;
            monster.animFrame = (monster.animFrame + 1) % 4;
        }
    }
}

// Check arrow hits on monsters
function checkArrowMonsterCollisions() {
    for (let i = arrows.length - 1; i >= 0; i--) {
        const arrow = arrows[i];

        for (let j = monsters.length - 1; j >= 0; j--) {
            const monster = monsters[j];

            if (checkCollision(arrow, monster)) {
                // Damage monster
                monster.health--;

                // Knockback
                monster.velocityX = arrow.direction * MONSTER_KNOCKBACK;
                monster.velocityY = -3;
                monster.knockbackTimer = 15;

                // Remove arrow
                arrows.splice(i, 1);

                // Remove monster if dead
                if (monster.health <= 0) {
                    monsters.splice(j, 1);
                }

                break;
            }
        }
    }
}

// Draw spider monster
function drawMonster(monster) {
    const mx = monster.x - camera.x;
    const my = monster.y - camera.y;
    const w = monster.width;
    const h = monster.height;

    ctx.save();

    // Flip if facing left
    if (!monster.facingRight) {
        ctx.translate(mx + w, my);
        ctx.scale(-1, 1);
        ctx.translate(0, 0);
    } else {
        ctx.translate(mx, my);
    }

    // Flash red if recently hit
    if (monster.knockbackTimer > 0) {
        ctx.globalAlpha = 0.7;
    }

    // Spider body (oval)
    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2 + 5, w / 3, h / 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spider head
    ctx.beginPath();
    ctx.ellipse(w * 0.75, h / 2, w / 5, h / 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (red when chasing)
    ctx.fillStyle = monster.isChasing ? '#ff0000' : '#880000';
    ctx.beginPath();
    ctx.arc(w * 0.8, h / 2 - 3, 3, 0, Math.PI * 2);
    ctx.arc(w * 0.8, h / 2 + 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Legs (animated)
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 3;
    const legOffset = Math.sin(monster.animFrame * Math.PI / 2) * 3;

    // Left side legs
    for (let i = 0; i < 4; i++) {
        const baseX = w * 0.3 + i * 5;
        const baseY = h / 2 + 5;
        const offset = (i % 2 === 0) ? legOffset : -legOffset;

        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX - 15, baseY + 15 + offset);
        ctx.lineTo(baseX - 20, baseY + 25 + offset);
        ctx.stroke();
    }

    // Right side legs
    for (let i = 0; i < 4; i++) {
        const baseX = w * 0.3 + i * 5;
        const baseY = h / 2 + 5;
        const offset = (i % 2 === 0) ? -legOffset : legOffset;

        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX + 15, baseY + 15 + offset);
        ctx.lineTo(baseX + 20, baseY + 25 + offset);
        ctx.stroke();
    }

    // Health bar
    ctx.restore();
    const barWidth = 40;
    const barHeight = 4;
    const barX = monster.x - camera.x + (w - barWidth) / 2;
    const barY = monster.y - camera.y - 8;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(barX, barY, barWidth * (monster.health / MONSTER_MAX_HEALTH), barHeight);
}

// Draw all monsters
function drawMonsters() {
    for (let monster of monsters) {
        drawMonster(monster);
    }
}

// Update camera to follow player (keep player in middle 1/3)
function updateCamera() {
    const level = getCurrentLevel();

    // Middle 1/3 deadzone (player stays in this zone)
    const deadzoneLeft = canvas.width / 3;
    const deadzoneRight = canvas.width * 2 / 3;
    const deadzoneTop = canvas.height / 3;
    const deadzoneBottom = canvas.height * 2 / 3;

    // Player position on screen
    const playerScreenX = player.x - camera.x;
    const playerScreenY = player.y - camera.y;

    // Adjust camera if player goes outside deadzone
    if (playerScreenX < deadzoneLeft) {
        camera.x = player.x - deadzoneLeft;
    } else if (playerScreenX + player.width > deadzoneRight) {
        camera.x = player.x + player.width - deadzoneRight;
    }

    if (playerScreenY < deadzoneTop) {
        camera.y = player.y - deadzoneTop;
    } else if (playerScreenY + player.height > deadzoneBottom) {
        camera.y = player.y + player.height - deadzoneBottom;
    }

    // Clamp camera to level bounds
    camera.x = Math.max(0, Math.min(camera.x, level.width - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, level.height - canvas.height));
}

// Check for level exits
function checkExits() {
    const level = getCurrentLevel();

    if (!level.exits) return;

    for (let exit of level.exits) {
        if (checkCollision(player, exit)) {
            // Transition to new level
            currentLevelNum = exit.toLevel;
            player.x = exit.spawnX;
            player.y = exit.spawnY;
            player.velocityX = 0;
            player.velocityY = 0;

            // Center camera on spawn point for new level
            centerCameraOn(exit.spawnX, exit.spawnY);
            break;
        }
    }
}

// Check for end point (level completion)
function checkEndPoint() {
    const level = getCurrentLevel();

    if (level.endPoint && checkCollision(player, level.endPoint)) {
        levelComplete = true;
    }
}

// Check for message blocks - display message when player touches one
function checkMessageBlocks() {
    const level = getCurrentLevel();

    if (!level.messageBlocks) {
        activeMessage = null;
        return;
    }

    // Check if player is inside any message block
    for (let block of level.messageBlocks) {
        if (checkCollision(player, block)) {
            activeMessage = block.message;
            return;
        }
    }

    // Not in any message block
    activeMessage = null;
}

// Shoot arrow function
function shootArrow() {
    const direction = player.facingRight ? 1 : -1;
    const arrow = {
        x: player.facingRight ? player.x + player.width : player.x - 15,
        y: player.y + 46, // Shoot from chest height (10px lower)
        velocityX: ARROW_SPEED * direction,
        velocityY: -3, // Initial upward velocity for arc
        width: 15,
        height: 3,
        color: '#8B4513',
        direction: direction
    };
    arrows.push(arrow);
}

// Restart game function
async function restartGame() {
    gameOver = false;
    levelComplete = false;
    health = 3;
    invincible = false;
    invincibleTimer = 0;

    // Reload the current level to reset all data
    currentLevel = await loadLevel(currentLevelNum);

    if (!currentLevel) {
        console.error('Failed to reload level');
        return;
    }

    // Reset player to current level's start position
    player.x = currentLevel.playerStart.x;
    player.y = currentLevel.playerStart.y;
    player.velocityX = 0;
    player.velocityY = 0;
    player.onGround = false;
    player.facingRight = true;
    player.animationFrame = 0;
    player.state = 'idle';
    player.shootingTimer = 0;
    player.wasInAir = false;
    arrows.length = 0;

    // Reset monsters
    initMonsters();

    // Center camera on start point
    centerCameraOn(currentLevel.playerStart.x, currentLevel.playerStart.y);
}

// Damage player function
function damagePlayer() {
    if (!invincible) {
        health--;
        if (health <= 0) {
            gameOver = true;
        } else {
            invincible = true;
            invincibleTimer = Date.now();
        }
    }
}

// Check collision between player and platform
function checkCollision(player, platform) {
    return player.x < platform.x + platform.width &&
           player.x + player.width > platform.x &&
           player.y < platform.y + platform.height &&
           player.y + player.height > platform.y;
}

// Update player
function updatePlayer() {
    if (gameOver) return;

    // Update invincibility
    if (invincible) {
        if (Date.now() - invincibleTimer > INVINCIBILITY_TIME) {
            invincible = false;
        }
    }

    // Horizontal movement
    player.velocityX = 0;
    if (keys['ArrowLeft']) {
        player.velocityX = -MOVE_SPEED;
        player.facingRight = false;
    }
    if (keys['ArrowRight']) {
        player.velocityX = MOVE_SPEED;
        player.facingRight = true;
    }

    // Drop through platform
    if (keys['ArrowDown'] && player.onGround && player.currentPlatform && !player.currentPlatform.solid) {
        // Drop through jump-through platform only
        player.y += 10; // Move player down to pass through platform
        player.onGround = false;
        player.currentPlatform = null;
    }

    // Jump
    if (keys['ArrowUp'] && player.onGround) {
        player.velocityY = JUMP_STRENGTH;
        player.onGround = false;
    }

    // Apply gravity
    player.velocityY += GRAVITY;

    // Update position
    player.x += player.velocityX;
    player.y += player.velocityY;

    // Keep player in bounds (level bounds, not canvas)
    const level = getCurrentLevel();
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > level.width) player.x = level.width - player.width;

    // Platform collision
    player.onGround = false;
    let currentPlatform = null; // Track which platform player is standing on

    for (let platform of level.platforms) {
        // Check if player is colliding with platform
        if (checkCollision(player, platform)) {
            // For solid platforms or jump-through platforms when falling from above
            if (platform.solid) {
                // Calculate previous position
                const prevBottom = player.y + player.height - player.velocityY;
                const prevTop = player.y - player.velocityY;
                const prevRight = player.x + player.width - player.velocityX;
                const prevLeft = player.x - player.velocityX;

                // Collision from top (landing on platform)
                if (player.velocityY > 0 && prevBottom <= platform.y) {
                    player.y = platform.y - player.height;
                    player.velocityY = 0;
                    player.onGround = true;
                    currentPlatform = platform;
                }
                // Collision from bottom (hitting head)
                else if (player.velocityY < 0 && prevTop >= platform.y + platform.height) {
                    player.y = platform.y + platform.height;
                    player.velocityY = 0;
                }
                // Collision from right side (player moving left into platform)
                else if (player.velocityX < 0 && prevLeft >= platform.x + platform.width) {
                    player.x = platform.x + platform.width;
                }
                // Collision from left side (player moving right into platform)
                else if (player.velocityX > 0 && prevRight <= platform.x) {
                    player.x = platform.x - player.width;
                }
            } else {
                // Jump-through platform - only collide from top when falling (not when dropping through)
                if (player.velocityY > 0 && player.y + player.height - player.velocityY <= platform.y + 5) {
                    player.y = platform.y - player.height;
                    player.velocityY = 0;
                    player.onGround = true;
                    currentPlatform = platform;
                }
            }
        }
    }

    // Store the platform player is standing on
    player.currentPlatform = currentPlatform;

    // Prevent falling through bottom of level
    if (player.y + player.height > level.height) {
        player.y = level.height - player.height;
        player.velocityY = 0;
        player.onGround = true;
    }

    // Check spike collision (use smaller hitbox - 50% width, centered)
    for (let spike of level.spikes) {
        const spikeHitbox = {
            x: spike.x + spike.width * 0.25,
            y: spike.y,
            width: spike.width * 0.5,
            height: spike.height
        };
        if (checkCollision(player, spikeHitbox)) {
            damagePlayer();
        }
    }

    // Check health potion collision - only pick up if not at full health
    for (let potion of level.healthPotions) {
        if (!potion.collected && checkCollision(player, potion)) {
            if (health < maxHealth) {
                potion.collected = true;
                health++;
            }
        }
    }

    // Check for level exits
    checkExits();

    // Check for end point (level completion)
    checkEndPoint();

    // Check for message blocks
    checkMessageBlocks();

    // Update animation state
    const currentTime = Date.now();

    // Track if we just landed
    const justLanded = player.wasInAir && player.onGround;
    player.wasInAir = !player.onGround;

    // Determine state
    let newState = player.state;

    // Check if shooting
    if (currentTime - player.shootingTimer < SHOOTING_DURATION) {
        newState = 'shooting';
    } else if (!player.onGround) {
        // In the air - always show jump animation
        newState = 'jumping';
    } else if (player.velocityX !== 0) {
        // On ground and moving - running animation (interrupts jump/landing)
        newState = 'running';
    } else if (justLanded && player.state !== 'landing') {
        newState = 'landing';
        player.animationFrame = 0; // Reset to start of landing animation
    } else if (player.state === 'landing') {
        // Stay in landing until animation completes
        if (player.animationFrame >= sprites.land.frames - 1) {
            newState = 'standing';
        }
    } else {
        // Standing still - play landing backwards (crouch down)
        newState = 'standing';
    }

    // Reset frame when state changes
    if (newState !== player.state) {
        player.animationFrame = 0;
        player.animationTimer = currentTime;
    }
    player.state = newState;

    // Update animation frame
    if (currentTime - player.animationTimer > ANIMATION_SPEED) {
        player.animationTimer = currentTime;

        // Get max frames for current animation
        let maxFrames = 4;
        if (player.state === 'running') maxFrames = sprites.run.frames;
        else if (player.state === 'jumping') maxFrames = sprites.jump.frames;
        else if (player.state === 'landing') maxFrames = sprites.land.frames;
        else if (player.state === 'shooting') maxFrames = sprites.shoot.frames;
        else maxFrames = 1; // idle uses single frame

        player.animationFrame = (player.animationFrame + 1) % maxFrames;
    }
}

// Update arrows
function updateArrows() {
    const level = getCurrentLevel();

    for (let i = arrows.length - 1; i >= 0; i--) {
        const arrow = arrows[i];

        // Apply gravity to arrow for arc
        arrow.velocityY += GRAVITY * 0.4;

        // Update position
        arrow.x += arrow.velocityX;
        arrow.y += arrow.velocityY;

        // Remove if off level bounds
        if (arrow.x > level.width || arrow.y > level.height || arrow.x < 0 || arrow.y < 0) {
            arrows.splice(i, 1);
        }
    }
}

// Draw player using sprite sheets
function drawPlayer() {
    // Flash when invincible
    if (invincible && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    // Get the right sprite sheet and frame
    let sprite = sprites.run;
    let frame = player.animationFrame;

    if (player.state === 'running') {
        sprite = sprites.run;
    } else if (player.state === 'jumping') {
        sprite = sprites.jump;
    } else if (player.state === 'landing') {
        sprite = sprites.land;
    } else if (player.state === 'shooting') {
        sprite = sprites.shoot;
    } else {
        // Standing - play landing animation backwards (crouching)
        sprite = sprites.land;
        // Reverse the frame order so it plays backwards
        frame = sprites.land.frames - 1 - (player.animationFrame % sprites.land.frames);
    }

    // Calculate draw position (center sprite on collision box) with camera offset
    const scaledSize = SPRITE_SIZE * SPRITE_SCALE;
    const drawX = player.x - (scaledSize - player.width) / 2 - camera.x;
    const drawY = player.y - (scaledSize - player.height) + 15 - camera.y; // Character 1px higher

    // Draw the sprite
    if (sprite.loaded) {
        ctx.save();

        if (!player.facingRight) {
            // Flip horizontally for left-facing
            ctx.translate(drawX + scaledSize, drawY);
            ctx.scale(-1, 1);
            ctx.drawImage(
                sprite.img,
                frame * SPRITE_SIZE, 0, SPRITE_SIZE, SPRITE_SIZE,
                0, 0, scaledSize, scaledSize
            );
        } else {
            ctx.drawImage(
                sprite.img,
                frame * SPRITE_SIZE, 0, SPRITE_SIZE, SPRITE_SIZE,
                drawX, drawY, scaledSize, scaledSize
            );
        }

        ctx.restore();
    } else {
        // Fallback rectangle if sprites not loaded
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    ctx.globalAlpha = 1.0;
}

// Draw active message from message block
function drawMessage() {
    if (!activeMessage) return;

    // Semi-transparent background box at top of screen
    const padding = 20;
    const boxHeight = 60;
    const boxY = 50;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(padding, boxY, canvas.width - padding * 2, boxHeight);

    // White border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, boxY, canvas.width - padding * 2, boxHeight);

    // Message text (centered)
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(activeMessage, canvas.width / 2, boxY + boxHeight / 2 + 7);
    ctx.textAlign = 'left';
}

// Draw hearts
function drawHearts() {
    const heartSize = 20;
    const heartSpacing = 25;
    const startX = 10;
    const startY = 10;

    for (let i = 0; i < maxHealth; i++) {
        const x = startX + (i * heartSpacing);
        const y = startY;

        // Draw heart shape (simplified pixel heart)
        if (i < health) {
            ctx.fillStyle = '#ff0000';
        } else {
            ctx.fillStyle = '#555555';
        }

        // Draw pixel heart
        ctx.fillRect(x + 5, y + 3, 4, 4);
        ctx.fillRect(x + 11, y + 3, 4, 4);
        ctx.fillRect(x + 3, y + 7, 14, 4);
        ctx.fillRect(x + 5, y + 11, 10, 4);
        ctx.fillRect(x + 7, y + 15, 6, 4);
    }
}

// Draw spikes
function drawSpikes() {
    const level = getCurrentLevel();
    ctx.fillStyle = '#666666';
    for (let spike of level.spikes) {
        // Draw spike triangles
        const numSpikes = 4;
        const spikeWidth = spike.width / numSpikes;

        for (let i = 0; i < numSpikes; i++) {
            ctx.beginPath();
            ctx.moveTo(spike.x + (i * spikeWidth) - camera.x, spike.y + spike.height - camera.y);
            ctx.lineTo(spike.x + (i * spikeWidth) + spikeWidth / 2 - camera.x, spike.y - camera.y);
            ctx.lineTo(spike.x + (i * spikeWidth) + spikeWidth - camera.x, spike.y + spike.height - camera.y);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// Draw health potions
function drawHealthPotions() {
    const level = getCurrentLevel();
    for (let potion of level.healthPotions) {
        if (!potion.collected) {
            // Draw potion bottle
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(potion.x + 3 - camera.x, potion.y - camera.y, 9, 12);

            // Draw potion cap
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(potion.x + 4 - camera.x, potion.y - camera.y, 7, 3);

            // Draw shine effect
            ctx.fillStyle = '#ffaaff';
            ctx.fillRect(potion.x + 5 - camera.x, potion.y + 4 - camera.y, 2, 4);
        }
    }
}

// Draw end point (purple dot)
function drawEndPoint() {
    const level = getCurrentLevel();
    if (level.endPoint) {
        const ep = level.endPoint;
        const centerX = ep.x + ep.width / 2 - camera.x;
        const centerY = ep.y + ep.height / 2 - camera.y;
        const radius = ep.width / 2;

        // Draw glowing purple circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#8B00FF';
        ctx.fill();

        // Draw inner glow
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#CC66FF';
        ctx.fill();

        // Draw sparkle effect (pulsing)
        const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.3 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
    }
}

// Draw game over screen
function drawGameOver() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Game Over text
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);

    // Restart instruction
    ctx.font = '24px monospace';
    ctx.fillText('Press SPACE to restart', canvas.width / 2, canvas.height / 2 + 40);
    ctx.textAlign = 'left';
}

// Draw level complete screen
function drawLevelComplete() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Level Complete text
    ctx.fillStyle = '#FFD700';
    ctx.font = '48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, canvas.height / 2 - 20);

    // Restart instruction
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px monospace';
    ctx.fillText('Press SPACE to play again', canvas.width / 2, canvas.height / 2 + 40);
    ctx.textAlign = 'left';
}

// Draw platforms
function drawPlatforms() {
    const level = getCurrentLevel();
    for (let platform of level.platforms) {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x - camera.x, platform.y - camera.y, platform.width, platform.height);

        // Add border for visibility
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(platform.x - camera.x, platform.y - camera.y, platform.width, platform.height);
    }
}

// Draw arrows
function drawArrows() {
    ctx.fillStyle = '#8B4513';
    for (let arrow of arrows) {
        const ax = arrow.x - camera.x;
        const ay = arrow.y - camera.y;

        // Draw arrow as a small rectangle with a point
        ctx.fillRect(ax, ay, arrow.width, arrow.height);

        // Draw arrowhead based on direction
        ctx.beginPath();
        if (arrow.direction > 0) {
            // Right-facing arrow
            ctx.moveTo(ax + arrow.width, ay + arrow.height / 2);
            ctx.lineTo(ax + arrow.width + 5, ay - 2);
            ctx.lineTo(ax + arrow.width + 5, ay + arrow.height + 2);
        } else {
            // Left-facing arrow
            ctx.moveTo(ax, ay + arrow.height / 2);
            ctx.lineTo(ax - 5, ay - 2);
            ctx.lineTo(ax - 5, ay + arrow.height + 2);
        }
        ctx.closePath();
        ctx.fill();
    }
}

// Main game loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill background
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Check if level is loaded
    if (!levelsLoaded || !currentLevel) {
        ctx.fillStyle = '#000';
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Loading...', canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'left';
        console.log('Still loading...', levelsLoaded, currentLevel);
        requestAnimationFrame(gameLoop);
        return;
    }

    // Debug: confirm we got past loading
    if (!window.loggedOnce) {
        console.log('Game loop running, level loaded');
        window.loggedOnce = true;
    }

    // Update
    if (!gameOver && !levelComplete) {
        // Check if arrow should fire after delay
        if (arrowPending && Date.now() - arrowPendingTime >= ARROW_DELAY) {
            shootArrow();
            arrowPending = false;
        }

        updatePlayer();
        updateArrows();
        updateMonsters();
        checkArrowMonsterCollisions();
        updateCamera();
    }

    // Draw
    drawPlatforms();
    drawSpikes();
    drawHealthPotions();
    drawEndPoint();
    drawMonsters();
    drawPlayer();
    drawArrows();
    drawHearts();
    drawMessage();

    // Draw game over screen if game is over
    if (gameOver) {
        drawGameOver();
    }

    // Draw level complete screen if level is complete
    if (levelComplete) {
        drawLevelComplete();
    }

    // Debug info - draw last so it's on top
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(5, canvas.height - 25, 600, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`Player: ${Math.round(player.x)}, ${Math.round(player.y)} | Camera: ${Math.round(camera.x)}, ${Math.round(camera.y)} | Keys: ${keys['ArrowLeft'] ? 'L' : '-'}${keys['ArrowRight'] ? 'R' : '-'}${keys['ArrowUp'] ? 'U' : '-'}`, 10, canvas.height - 10);

    // Request next frame
    requestAnimationFrame(gameLoop);
}

// Start game
initGame();
