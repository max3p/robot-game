# Tabula Rasa: Complete Implementation Plan

## Document Version: 1.0

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [Technical Stack](#2-technical-stack)
3. [Project Structure](#3-project-structure)
4. [Core Game Mechanics](#4-core-game-mechanics)
5. [Entity Specifications](#5-entity-specifications)
6. [Level System](#6-level-system)
7. [Implementation Phases](#7-implementation-phases)
8. [Appendices](#appendices)

---

## 1. Game Overview

### 1.1 Concept

Tabula Rasa is a top-down 2D cooperative stealth game where 1-4 players must navigate through maze levels infested with hostile robots. One player carries a baby that must be protected at all costs. The core tension comes from the baby's need to stay calm (requiring stillness) versus the need to progress through the level while avoiding robot detection.

### 1.2 Genre and Style

- **Genre:** Top-down cooperative stealth/action
- **Visual Style:** 2D sprites (placeholder geometric shapes initially)
- **Perspective:** Top-down view
- **Platform:** Web browser (PC)

### 1.3 Win and Lose Conditions

**Win Condition:**
- Carry the baby from the level's start position to the exit zone

**Lose Conditions:**
- Baby is hit while on the ground (instant game over)
- Baby holder player is downed (reaches 0 hearts and falls) (instant game over)

### 1.4 Player Count Scaling

The game supports 1-4 players on a single keyboard. Difficulty scales based on player count:

- More players = easier coordination and defense
- Fewer players = must manage multiple weapons via swapping
- Robot count scales down with fewer players
- Single player experience is intentionally very challenging

---

## 2. Technical Stack

### 2.1 Core Framework

**Phaser 3** (version 3.70.0 or latest stable)

Phaser is a mature 2D game framework for web browsers that provides:
- Built-in physics and collision detection
- Sprite and animation management
- Input handling for multiple keyboard configurations
- Light2D rendering pipeline for dynamic lighting
- Scene management for level transitions
- Audio support

Documentation: https://phaser.io/docs

### 2.2 Language

**TypeScript** (version 5.x)

Provides type safety, better IDE support, and clearer code structure for a project of this complexity.

### 2.3 Build Tool

**Vite** (version 5.x)

Fast development server with hot module replacement. Simple configuration for TypeScript and static asset handling.

### 2.4 Additional Libraries

| Library | Purpose | Version |
|---------|---------|---------|
| phaser | Game framework | ^3.70.0 |
| typescript | Language | ^5.0.0 |
| vite | Build tool | ^5.0.0 |

No additional libraries required. Phaser handles all game engine needs.

### 2.5 Deployment

The game compiles to static HTML/JS/CSS files that can be hosted on:
- Itch.io (recommended for game distribution)
- GitHub Pages (free, easy CI/CD)
- Netlify (free tier available)
- Any static file host

Build command produces a `/dist` folder ready for upload.

---

## 3. Project Structure

```
/tabula-rasa
│
├── /public
│   └── /assets
│       ├── /audio           # Sound effects (future)
│       └── /sprites         # Sprite images (future)
│
├── /src
│   ├── /config
│   │   ├── gameConfig.ts    # Phaser game configuration
│   │   ├── constants.ts     # Game-wide constants
│   │   └── controls.ts      # Key bindings for all players
│   │
│   ├── /entities
│   │   ├── Player.ts        # Player class
│   │   ├── Baby.ts          # Baby entity and calm meter
│   │   ├── Robot.ts         # Base robot class
│   │   ├── SpiderBot.ts     # Spider-bot implementation
│   │   ├── ShockBot.ts      # Shock-bot implementation
│   │   ├── FlameBot.ts      # Flame-bot implementation
│   │   └── Weapon.ts        # Weapon base class and types
│   │
│   ├── /scenes
│   │   ├── BootScene.ts     # Asset loading
│   │   ├── MenuScene.ts     # Main menu and player count select
│   │   ├── GameScene.ts     # Main gameplay scene
│   │   ├── UIScene.ts       # HUD overlay (hearts, calm meter)
│   │   ├── PauseScene.ts    # Pause menu
│   │   ├── GameOverScene.ts # Game over screen
│   │   └── LevelCompleteScene.ts # Level completion screen
│   │
│   ├── /systems
│   │   ├── LightingSystem.ts    # Light cone rendering and management
│   │   ├── DetectionSystem.ts   # Robot detection logic
│   │   ├── CombatSystem.ts      # Damage, health, downed states
│   │   ├── SwapSystem.ts        # Item/weapon swapping logic
│   │   └── AudioSystem.ts       # Sound management (future)
│   │
│   ├── /levels
│   │   ├── levelData.ts     # All level definitions
│   │   ├── Level1.ts        # Level 1 specific data
│   │   ├── Level2.ts        # Level 2 specific data
│   │   ├── Level3.ts        # Level 3 specific data
│   │   ├── Level4.ts        # Level 4 specific data
│   │   ├── Level5.ts        # Level 5 specific data
│   │   └── Level6.ts        # Level 6 specific data
│   │
│   ├── /utils
│   │   ├── geometry.ts      # Vector math, cone calculations
│   │   ├── helpers.ts       # General utility functions
│   │   └── debug.ts         # Debug visualization tools
│   │
│   ├── /types
│   │   └── index.ts         # TypeScript type definitions
│   │
│   └── main.ts              # Entry point
│
├── index.html               # HTML entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 4. Core Game Mechanics

### 4.1 Movement System

#### 4.1.1 Control Scheme

All gameplay uses movement keys only. No action buttons exist.

| Player | Up | Down | Left | Right |
|--------|-----|------|------|-------|
| Player 1 | W | S | A | D |
| Player 2 | T | G | F | H |
| Player 3 | I | K | J | L |
| Player 4 | ↑ | ↓ | ← | → |

#### 4.1.2 Movement Properties

```
BASE_PLAYER_SPEED = 200 pixels/second
BABY_HOLDER_SPEED = 120 pixels/second (60% of base)
```

- Players move in 8 directions (including diagonals)
- Diagonal movement should be normalized to prevent faster diagonal speed
- Players collide with walls and cannot pass through them
- Players collide with each other (enables swapping mechanic)

#### 4.1.3 Facing Direction

Since there are only movement keys, player facing direction is determined by last movement direction. This affects:
- Auto-aim for shooting
- Visual sprite orientation (future)

If player is stationary, they retain their last facing direction.

### 4.2 Baby and Calm System

#### 4.2.1 Calm Meter

The baby has a calm meter that determines when it cries.

```
CALM_METER_MAX = 100
CALM_METER_DRAIN_RATE = 10 per second (while holder is moving)
CALM_METER_FILL_RATE = 15 per second (while holder is stationary)
CALM_METER_CRY_THRESHOLD = 0
```

**Behavior:**
- When baby holder moves: meter drains at DRAIN_RATE
- When baby holder is stationary: meter fills at FILL_RATE
- When meter reaches 0: baby cries
- Meter is capped at CALM_METER_MAX

#### 4.2.2 Baby Crying Event

When the baby cries:

1. Trigger a global "cry event"
2. ALL robots on the map immediately set their target to the baby's position
3. Robots enter "alert" state and move toward baby at increased speed
4. Cry effect lasts for 3 seconds, then robots return to patrol if they lose sight
5. Calm meter resets to 50 after crying ends (gives player a chance to recover)

```
CRY_ALERT_DURATION = 3 seconds
CRY_ROBOT_SPEED_MULTIPLIER = 1.5
CALM_METER_POST_CRY_RESET = 50
```

#### 4.2.3 Baby States

| State | Description |
|-------|-------------|
| HELD | Baby is carried by a player |
| GROUND | Baby has been placed on ground (via swap) |
| CRYING | Baby is currently crying (can be HELD or GROUND) |

Baby on ground can be killed by any robot touching it = instant game over.

### 4.3 Swapping System

Players always hold exactly one item (baby or weapon). Swapping is the only way to change what you hold.

#### 4.3.1 Ground Swap

When a player walks over an item on the ground:

1. Player's current item is placed at that ground position
2. Player picks up the ground item
3. Swap is instant

```
GROUND_ITEM_PICKUP_RADIUS = 20 pixels
```

#### 4.3.2 Player-to-Player Swap

When two players overlap and both remain stationary:

1. Start a swap timer
2. If both players remain stationary for SWAP_DURATION, swap their items
3. If either player moves, cancel the swap timer
4. Visual indicator should show swap progress

```
PLAYER_SWAP_DURATION = 2 seconds
PLAYER_OVERLAP_RADIUS = 30 pixels
```

### 4.4 Combat System

#### 4.4.1 Health

All players have 3 hearts (health points).

```
PLAYER_MAX_HEALTH = 3
```

**When a player takes damage:**
1. Reduce health by 1
2. Brief invincibility period (1 second)
3. Visual flash effect
4. If player is baby holder: baby cries immediately

**When health reaches 0:**
1. Player enters DOWNED state
2. Player cannot move
3. Player drops their item at their position
4. If downed player was baby holder: GAME OVER

```
INVINCIBILITY_DURATION = 1 second
```

#### 4.4.2 Downed State and Revival

Downed players can be revived by teammates:

1. Another player stands on the downed player
2. Revive timer begins
3. If reviving player remains stationary for REVIVE_DURATION, downed player is revived
4. Revived player returns with 1 heart
5. Revived player must pick up an item from ground (they have nothing)

```
REVIVE_DURATION = 3 seconds
REVIVE_HEALTH_RESTORE = 1
```

#### 4.4.3 Auto-Shooting

Players holding weapons automatically fire at robots.

**Targeting logic:**
1. Find all robots within weapon range
2. Filter to robots the player is roughly facing (90-degree arc in front)
3. Select the nearest robot
4. If a valid target exists and weapon is not on cooldown: fire

```
WEAPON_RANGE = 150 pixels
WEAPON_AIM_ARC = 90 degrees (45 degrees each side of facing direction)
```

**Projectile behavior:**
- Projectiles are instant (hitscan) for simplicity
- Visual effect shows a brief line/beam from player to target
- Sound effect plays (future)

### 4.5 Lighting System

Lighting is critical to gameplay. The level is mostly dark, with light sources revealing the environment.

#### 4.5.1 Ambient Light

Players have a tiny ambient light around them.

```
PLAYER_AMBIENT_LIGHT_RADIUS = 40 pixels
PLAYER_AMBIENT_LIGHT_INTENSITY = 0.3 (dim)
```

This allows players to see immediate walls but not much else.

#### 4.5.2 Robot Lights

Each robot emits a colored light cone in their facing direction.

```
SPIDER_BOT_LIGHT_RADIUS = 120 pixels
SPIDER_BOT_LIGHT_ANGLE = 60 degrees
SPIDER_BOT_LIGHT_COLOR = 0xFF69B4 (pink)

SHOCK_BOT_LIGHT_RADIUS = 150 pixels
SHOCK_BOT_LIGHT_ANGLE = 45 degrees
SHOCK_BOT_LIGHT_COLOR = 0x4169E1 (blue)

FLAME_BOT_LIGHT_RADIUS = 180 pixels
FLAME_BOT_LIGHT_ANGLE = 50 degrees
FLAME_BOT_LIGHT_COLOR = 0xFF4500 (red-orange)
```

#### 4.5.3 Light Sources Summary

| Source | Type | Radius | Permanent |
|--------|------|--------|-----------|
| Player | Point (360°) | 40px | While alive |
| Spider-bot | Cone | 120px | While alive |
| Shock-bot | Cone | 150px | While alive |
| Flame-bot | Cone | 180px | Always (can't be killed) |
| Spider lantern | Point (360°) | 100px | Permanent |
| Exit zone | Point (360°) | 60px | Permanent |

#### 4.5.4 Implementation Approach

Use Phaser's Light2D pipeline:

1. Enable light pipeline on the game scene
2. Set ambient light to very dark (near black)
3. Create light objects attached to entities
4. For cone lights: use a combination of point light and a shadow-casting mask, OR render a custom cone shape with additive blending

Alternative approach if Phaser's Light2D is insufficient for cones:
- Render light cones as semi-transparent colored triangles
- Use darkness overlay (full-screen dark sprite) with "destination-out" blend mode to "cut" light shapes

### 4.6 Detection System

Robots detect players only within their light cone.

#### 4.6.1 Cone Detection Logic

```
function isPlayerDetected(robot, player):
    // Get vector from robot to player
    directionToPlayer = player.position - robot.position
    distanceToPlayer = directionToPlayer.length()
    
    // Check distance
    if distanceToPlayer > robot.lightRadius:
        return false
    
    // Check angle
    angleToPlayer = atan2(directionToPlayer.y, directionToPlayer.x)
    angleDifference = normalizeAngle(angleToPlayer - robot.facingAngle)
    
    if abs(angleDifference) > robot.lightAngle / 2:
        return false
    
    // Check line of sight (no walls blocking)
    if wallsBetween(robot.position, player.position):
        return false
    
    return true
```

#### 4.6.2 Sound Detection

Shooting attracts nearby robots (but not all robots like crying does).

```
SHOOTING_SOUND_RADIUS = 200 pixels
```

When a player shoots:
1. Find all robots within SHOOTING_SOUND_RADIUS
2. Those robots turn toward the sound origin
3. They investigate for 2 seconds, then return to patrol

```
SOUND_INVESTIGATION_DURATION = 2 seconds
```

---

## 5. Entity Specifications

### 5.1 Players

#### 5.1.1 Player Properties

```typescript
interface Player {
    id: number                    // 1-4
    position: Vector2
    velocity: Vector2
    facingDirection: Vector2
    health: number                // 0-3
    state: PlayerState            // ACTIVE, DOWNED, INVINCIBLE
    heldItem: Item                // Baby or Weapon
    invincibilityTimer: number
}

enum PlayerState {
    ACTIVE,
    DOWNED,
    INVINCIBLE
}
```

#### 5.1.2 Placeholder Visual

- Circle with diameter of 32 pixels
- Colors: P1 = Green (#00FF00), P2 = Blue (#0088FF), P3 = Yellow (#FFFF00), P4 = Purple (#AA00FF)
- When holding baby: smaller white circle rendered on top
- When downed: reduced opacity (50%)

### 5.2 Baby

#### 5.2.1 Baby Properties

```typescript
interface Baby {
    position: Vector2             // Only relevant when on ground
    state: BabyState
    calmMeter: number             // 0-100
    holder: Player | null         // null if on ground
    cryTimer: number              // countdown during cry event
}

enum BabyState {
    HELD_CALM,
    HELD_CRYING,
    GROUND_CALM,
    GROUND_CRYING
}
```

#### 5.2.2 Placeholder Visual

- Small white circle, diameter 16 pixels
- When crying: pulsing red outline
- When on ground: rendered at ground position
- When held: rendered slightly offset on holder sprite

### 5.3 Weapons

#### 5.3.1 Weapon Properties

```typescript
interface Weapon {
    type: WeaponType
    position: Vector2             // Only relevant when on ground
    holder: Player | null
    cooldownTimer: number
    cooldownDuration: number
    range: number
    effectiveAgainst: RobotType
}

enum WeaponType {
    GOO_GUN,
    EMP_GUN,
    WATER_GUN
}
```

#### 5.3.2 Weapon Specifications

| Weapon | Cooldown | Range | Effective Against | Color |
|--------|----------|-------|-------------------|-------|
| Goo Gun | 0.8 sec | 150px | Spider-bot | Pink (#FF69B4) |
| EMP Gun | 1.2 sec | 150px | Shock-bot | Blue (#4169E1) |
| Water Gun | 1.0 sec | 150px | Flame-bot | Cyan (#00FFFF) |

#### 5.3.3 Placeholder Visual

- Triangle shape pointing in holder's facing direction
- Colored according to weapon type
- Size: 20px base, 30px height
- When on ground: points upward

### 5.4 Robots

#### 5.4.1 Base Robot Properties

```typescript
interface Robot {
    type: RobotType
    position: Vector2
    velocity: Vector2
    facingDirection: Vector2
    state: RobotState
    health: number                // Only spider-bot uses this
    patrolPath: Vector2[]         // Waypoints for patrol (legacy, robots now use random walk AI)
    currentPatrolIndex: number    // (legacy, not used with random walk AI)
    alertTarget: Vector2 | null
    lightRadius: number
    lightAngle: number
    lightColor: number
    speed: number
    attackRange: number
    attackCooldown: number
    attackTimer: number
}

enum RobotType {
    SPIDER_BOT,
    SHOCK_BOT,
    FLAME_BOT
}

enum RobotState {
    PATROL,
    ALERT,
    ATTACKING,
    INVESTIGATING,
    DISABLED,
    DEAD
}
```

#### 5.4.2 Spider-Bot

**Characteristics:**
- Smallest and fastest robot
- Melee attack (must touch player)
- Defeated by Goo Gun (becomes lantern)
- Pink light

**Stats:**
```
SPIDER_SPEED = 180 pixels/second
SPIDER_ATTACK_RANGE = 25 pixels (melee)
SPIDER_ATTACK_COOLDOWN = 1 second
SPIDER_ATTACK_DAMAGE = 1
SPIDER_GOO_HITS_TO_KILL = 3
```

**Goo Effect:**
- Each goo hit reduces spider speed by 33%
- After 3 hits: spider dies and becomes a lantern
- Lantern is a permanent pink point light (radius 100px)

**Placeholder Visual:**
- Pink rectangle, 24x24 pixels
- When slowed: darker pink tint per goo hit
- When dead: pink circle (lantern)

#### 5.4.3 Shock-Bot

**Characteristics:**
- Medium size and speed
- Ranged attack (arc lightning)
- Defeated permanently by EMP Gun
- Blue light
- When killed, light is removed (darkness trade-off)

**Stats:**
```
SHOCK_SPEED = 120 pixels/second
SHOCK_ATTACK_RANGE = 130 pixels
SHOCK_ATTACK_COOLDOWN = 2 seconds
SHOCK_ATTACK_DAMAGE = 1
SHOCK_EMP_HITS_TO_KILL = 1
```

**Attack Behavior:**
- Stops moving when attacking
- Brief charge-up visual (0.5 sec)
- Lightning arc drawn from robot to player
- Attack damages all players in a small radius at target point

```
SHOCK_ATTACK_CHARGE_TIME = 0.5 seconds
SHOCK_ATTACK_AOE_RADIUS = 30 pixels
```

**Placeholder Visual:**
- Blue rectangle, 36x36 pixels
- Lightning attack: jagged line from robot to target
- When dead: fades out and disappears

#### 5.4.4 Flame-Bot

**Characteristics:**
- Largest and slowest robot
- Ranged attack (fire breath)
- Cannot be killed, only temporarily disabled by Water Gun
- Red light
- Most intimidating, used as persistent obstacles

**Stats:**
```
FLAME_SPEED = 70 pixels/second
FLAME_ATTACK_RANGE = 140 pixels
FLAME_ATTACK_COOLDOWN = 2.5 seconds
FLAME_ATTACK_DAMAGE = 1
FLAME_DISABLE_DURATION = 4 seconds
FLAME_REIGNITE_TIME = 2 seconds
```

**Disable Behavior:**
1. Water gun hits flame-bot
2. Flame-bot enters DISABLED state
3. Flame-bot stops moving, light flickers
4. After DISABLE_DURATION, flame-bot begins reigniting
5. During REIGNITE_TIME, light pulses brighter
6. After reignite: returns to patrol

**Attack Behavior:**
- Continuous flame stream while attacking
- Damages any player caught in flame cone
- Flame cone: 40 degrees wide, 140px long

**Placeholder Visual:**
- Red rectangle, 48x48 pixels
- Flame attack: orange/red triangle cone in front
- When disabled: dark red with no light
- When reigniting: pulsing red

#### 5.4.5 Wrong Weapon Effect

When a robot is hit by the wrong weapon type:

1. Robot enters brief "confused" state
2. Robot stops moving for 0.5 seconds
3. Robot shakes slightly (visual effect)
4. After confusion, robot continues normal behavior

```
WRONG_WEAPON_CONFUSION_DURATION = 0.5 seconds
```

### 5.5 Robot AI Behavior

#### 5.5.1 Patrol State (Random Walk AI)

Robots use a random walk AI to patrol the level. Instead of following predefined paths, they randomly select neighboring floor tiles to move to:

```
function updateRandomWalk(robot):
    currentTile = worldToTileCoordinates(robot.position)
    
    // If no target or reached target, select new random neighbor
    if not robot.currentTargetTile or reachedTarget:
        neighbors = [
            {x: currentTile.x, y: currentTile.y - 1},  // Up
            {x: currentTile.x, y: currentTile.y + 1},  // Down
            {x: currentTile.x - 1, y: currentTile.y},  // Left
            {x: currentTile.x + 1, y: currentTile.y}   // Right
        ]
        
        // Filter to only valid floor tiles (not walls, within bounds)
        validNeighbors = neighbors.filter(tile => isValidFloorTile(tile))
        
        // Randomly select one valid neighbor
        robot.currentTargetTile = randomSelect(validNeighbors)
    
    // Move toward target tile
    directionToTarget = robot.currentTargetTile - robot.position
    robot.velocity = directionToTarget.normalize() * robot.speed
    robot.facingDirection = directionToTarget.normalize()
```

**Key features:**
- Robots randomly select from 4 neighboring tiles (up, down, left, right)
- Only moves to floor tiles (0), never walls (1)
- Checks bounds to stay within level
- After reaching a tile, waits briefly (500ms) before selecting a new target
- Creates unpredictable, organic movement patterns

#### 5.5.2 Alert State

When robot detects a player or hears baby cry:

```
function updateAlert(robot):
    directionToTarget = robot.alertTarget - robot.position
    
    if directionToTarget.length() < robot.attackRange:
        robot.state = ATTACKING
    else:
        robot.velocity = directionToTarget.normalize() * robot.speed * ALERT_SPEED_MULTIPLIER
        robot.facingDirection = directionToTarget.normalize()
    
    // If target is lost (can't see player), investigate
    if not canSeeAnyPlayer(robot) and not robot.cryAlerted:
        robot.state = INVESTIGATING
        robot.investigateTimer = INVESTIGATION_DURATION

ALERT_SPEED_MULTIPLIER = 1.3
```

#### 5.5.3 Investigating State

Robot heard a sound but can't see target:

```
function updateInvestigating(robot):
    // Move toward last known position
    directionToTarget = robot.alertTarget - robot.position
    
    if directionToTarget.length() < 20 or robot.investigateTimer <= 0:
        robot.state = PATROL
        robot.alertTarget = null
    else:
        robot.velocity = directionToTarget.normalize() * robot.speed
        robot.facingDirection = directionToTarget.normalize()
        robot.investigateTimer -= deltaTime
```

---

## 6. Level System

### 6.1 Level Data Structure

```typescript
interface LevelData {
    id: number
    name: string
    grid: number[][]              // 0 = floor, 1 = wall
    tileSize: number              // pixels per tile
    startPosition: Vector2        // player spawn (tile coordinates)
    exitPosition: Vector2         // exit zone (tile coordinates)
    robots: RobotSpawn[]
    groundItems: ItemSpawn[]      // for <4 player games
}

interface RobotSpawn {
    type: RobotType
    position: Vector2             // tile coordinates
    patrolPath: Vector2[]         // tile coordinates
}

interface ItemSpawn {
    type: WeaponType
    position: Vector2             // tile coordinates
    forPlayerCount: number[]      // spawn only if player count in this array
}
```

### 6.2 Level Specifications

#### Level 1: "Awakening"

**Size:** 10x10 tiles

**Robot types:** Spider-bots only (3 robots for 4 players)

**Purpose:** Teach basic movement, baby mechanics, and goo gun

**Layout concept:**
```
1 1 1 1 1 1 1 1 1 1
1 S 0 0 0 0 0 0 0 1
1 0 1 1 1 0 1 1 0 1
1 0 1 0 0 0 0 1 0 1
1 0 0 0 1 1 0 0 0 1
1 0 1 0 1 0 0 1 0 1
1 0 1 0 0 0 1 1 0 1
1 0 1 1 1 0 0 0 0 1
1 0 0 0 0 0 1 0 E 1
1 1 1 1 1 1 1 1 1 1

S = Start, E = Exit, 0 = floor, 1 = wall
```

#### Level 2: "Short Circuit"

**Size:** 12x12 tiles

**Robot types:** Spider-bots + Shock-bots (2 spider, 2 shock for 4 players)

**Purpose:** Introduce shock-bots and EMP gun, teach ranged danger

#### Level 3: "Trial by Fire"

**Size:** 12x12 tiles

**Robot types:** All three types (2 spider, 1 shock, 1 flame for 4 players)

**Purpose:** Introduce flame-bots, teach temporary disable mechanic

#### Level 4: "The Gauntlet"

**Size:** 14x14 tiles

**Robot types:** All three (3 spider, 2 shock, 2 flame for 4 players)

**Purpose:** Longer level, requires strategic weapon swapping

#### Level 5: "Blackout"

**Size:** 16x16 tiles

**Robot types:** All three (4 spider, 3 shock, 2 flame for 4 players)

**Purpose:** Larger dark areas, emphasizes light management

#### Level 6: "Extraction"

**Size:** 20x20 tiles

**Robot types:** All three (5 spider, 4 shock, 3 flame for 4 players)

**Purpose:** Final challenge, complex maze, multiple viable routes

### 6.3 Robot Scaling by Player Count

Reduce robot count for fewer players:

| Level | 4 Players | 3 Players | 2 Players | 1 Player |
|-------|-----------|-----------|-----------|----------|
| 1 | 3 spider | 2 spider | 2 spider | 1 spider |
| 2 | 2S + 2Sh | 2S + 1Sh | 1S + 1Sh | 1S + 1Sh |
| 3 | 2S + 1Sh + 1F | 1S + 1Sh + 1F | 1S + 1Sh + 1F | 1S + 1F |
| 4 | 3S + 2Sh + 2F | 2S + 2Sh + 1F | 2S + 1Sh + 1F | 1S + 1Sh + 1F |
| 5 | 4S + 3Sh + 2F | 3S + 2Sh + 2F | 2S + 2Sh + 1F | 2S + 1Sh + 1F |
| 6 | 5S + 4Sh + 3F | 4S + 3Sh + 2F | 3S + 2Sh + 2F | 2S + 2Sh + 1F |

S = Spider, Sh = Shock, F = Flame

### 6.4 Starting Loadout by Player Count

| Players | P1 | P2 | P3 | P4 | Ground Items |
|---------|-----|-----|-----|-----|--------------|
| 4 | Baby | Goo | EMP | Water | None |
| 3 | Baby | Goo | EMP | - | Water near start |
| 2 | Baby | Goo | - | - | EMP + Water near start |
| 1 | Baby | - | - | - | All 3 guns near start |

Ground items spawn within 3 tiles of start position.

### 6.5 Tile Rendering

**Tile size:** 96x96 pixels

**Tile types:**
- Wall (1): Black (#000000) square
- Floor (0): Dark gray (#1a1a1a) square
- Start zone: Floor with subtle green tint
- Exit zone: Bright green (#00FF00) square with point light

---

## 7. Implementation Phases

### Phase 1: Foundation

**Duration estimate:** 1-2 weeks

**Objective:** Set up project infrastructure and basic rendering.

#### Deliverables:

1. **Project Setup**
   - Initialize npm project with package.json
   - Configure TypeScript (tsconfig.json)
   - Configure Vite (vite.config.ts)
   - Install dependencies (phaser)
   - Create folder structure as specified in Section 3
   - Verify dev server runs with `npm run dev`

2. **Basic Phaser Configuration**
   - Create gameConfig.ts with Phaser.Game configuration
   - Set up canvas size: 960x960 pixels
   - Configure physics: Arcade physics
   - Enable Light2D pipeline
   - Set background color to black

3. **Scene Structure**
   - Implement BootScene (placeholder, just transitions to GameScene)
   - Implement basic GameScene skeleton
   - Scene should load and display without errors

4. **Level Rendering**
   - Create constants.ts with TILE_SIZE = 96
   - Implement level data structure in levelData.ts
   - Create Level1 data (10x10 grid as specified)
   - Render level grid in GameScene:
     - Black rectangles for walls
     - Dark gray rectangles for floors
     - Green square for exit zone
   - Verify level displays correctly

5. **Single Player Movement**
   - Create Player.ts class
   - Implement WASD input handling
   - Player rendered as green circle (32px diameter)
   - Player moves at BASE_PLAYER_SPEED
   - Player collides with walls (Arcade physics)
   - Player cannot exit map bounds

#### Phase 1 Acceptance Criteria:
- [ ] `npm run dev` starts development server
- [ ] Level 1 grid renders correctly
- [ ] Single player moves with WASD
- [ ] Player stops at walls
- [ ] No console errors

---

### Phase 2: Multi-Player and Items

**Duration estimate:** 1-2 weeks

**Objective:** Support all 4 players and implement item system.

#### Deliverables:

1. **Multi-Player Input**
   - Create controls.ts with key mappings for all 4 players
   - Modify Player class to accept playerId and key configuration
   - Spawn players based on selected player count (hardcode to 4 initially)
   - All 4 players move independently with their assigned keys
   - Players collide with each other

2. **Player Visuals**
   - Player 1: Green (#00FF00)
   - Player 2: Blue (#0088FF)
   - Player 3: Yellow (#FFFF00)
   - Player 4: Purple (#AA00FF)
   - Each player clearly distinguishable

3. **Baby Implementation**
   - Create Baby.ts class
   - Baby rendered as small white circle (16px)
   - When held: rendered offset on holder's sprite
   - Baby holder moves at BABY_HOLDER_SPEED
   - Calm meter implemented:
     - Decreases when holder moves
     - Increases when holder stationary
     - Visual bar above baby holder showing meter level

4. **Weapon Implementation**
   - Create Weapon.ts class with WeaponType enum
   - Three weapon types with distinct colors
   - Weapons rendered as triangles pointing in holder's facing direction
   - When on ground: rendered at position, pointing up

5. **Item Swap System - Ground**
   - Implement SwapSystem.ts
   - When player walks over ground item:
     - Player's current item placed at ground position
     - Player picks up ground item
   - Items on ground rendered clearly

6. **Item Swap System - Player to Player**
   - When two players overlap and both stationary:
     - Start 2-second timer
     - Visual indicator (progress bar or pulsing)
   - If both remain still for 2 seconds: swap items
   - If either moves: cancel swap

7. **Starting Loadout**
   - Player 1 always starts with baby
   - Remaining players start with weapons in order: Goo, EMP, Water
   - For fewer players: extra weapons spawn on ground near start

#### Phase 2 Acceptance Criteria:
- [ ] 4 players can move independently
- [ ] Baby holder moves slower
- [ ] Calm meter depletes/fills correctly
- [ ] Ground item swap works
- [ ] Player-to-player swap works with 2-second delay
- [ ] Starting loadout correct for 4/3/2/1 players

---

### Phase 3: Robots and Detection

**Duration estimate:** 2-3 weeks

**Objective:** Implement all robot types with AI and detection.

#### Deliverables:

1. **Base Robot Class**
   - Create Robot.ts with common properties
   - Implement random walk patrol AI (randomly selects neighboring floor tiles)
   - Robot rendered as colored rectangle
   - Robot faces direction of movement

2. **Lighting System - DEFFERRED**
    - use phaser-raycaster https://github.com/wiserim/phaser-raycaster
   - Create LightingSystem.ts
   - Set scene ambient light to very dark
   - Implement player ambient light (small radius)
   - Implement robot cone lights:
     - Use Phaser Light2D or custom cone rendering
     - Cone points in robot's facing direction
     - Correct color per robot type

3. **Detection System**
   - Create DetectionSystem.ts
   - Implement cone-based detection (see Section 4.6.1)
   - Check line-of-sight (raycast against walls)
   - When player detected: robot enters ALERT state

4. **Spider-Bot Implementation**
   - Create SpiderBot.ts extending Robot
   - Stats as specified (fast, melee)
   - Pink light cone
   - Random walk patrol behavior (selects random neighboring floor tiles)
   - Alert: chase detected player
   - Attack: damage on contact

5. **Shock-Bot Implementation**
   - Create ShockBot.ts extending Robot
   - Stats as specified (medium speed, ranged)
   - Blue light cone
   - Ranged attack with charge-up visual
   - Arc lightning visual (line from robot to target)
   - AOE damage at target point

6. **Flame-Bot Implementation**
   - Create FlameBot.ts extending Robot
   - Stats as specified (slow, ranged, unkillable)
   - Red light cone
   - Continuous flame attack visual
   - Damages players in flame cone

7. **Robot Spawning**
   - Read robot spawn data from level data
   - Create robots at specified positions (patrol paths in level data are legacy, not used)
   - Robots use random walk AI starting from spawn position
   - Scale robot count based on player count

8. **Sound Detection - DEFERRED**
   - When player shoots: nearby robots investigate
   - Robots turn toward sound, move to location
   - Return to patrol after investigation duration

#### Phase 3 Acceptance Criteria:
- [ ] All 3 robot types rendered with correct visuals
- [ ] Robots patrol with random AI behavior
- [ ] Players detected only when in detection cone
- [ ] Each robot type attacks correctly

---

### Phase 4: Combat and Weapons

**Duration estimate:** 1-2 weeks

**Objective:** Implement weapon effects and combat system.

#### Deliverables:

1. **Auto-Shooting System**
   - Implement CombatSystem.ts
   - Weapon holders auto-target nearest robot in range
   - Only target robots in front arc (90 degrees)
   - Respect weapon cooldowns
   - Visual: brief line/flash from player to target

2. **Goo Gun Effect**
   - Hits spider-bot: reduce speed by 33%
   - Track goo hits per spider
   - After 3 hits: spider dies, becomes lantern
   - Lantern: permanent pink point light at death position

3. **EMP Gun Effect**
   - Hits shock-bot: dazes bot for 2 seconds, removed 25% of health
   - Shock-bot fades out
   - Light removed (area becomes darker)

4. **Water Gun Effect**
   - Hits flame-bot: enter DISABLED state
   - Light flickers/dims during disabled
   - After 2 seconds: begin reignite
   - After 2 more seconds: fully reignited, resume patrol

5. **Wrong Weapon Effect**
   - Any weapon hitting wrong robot type
   - Robot enters brief "confused" state (0.5 sec)
   - Visual: robot shakes/vibrates
   - Then continues normal behavior

6. **Player Health System**
   - Players have 3 hearts
   - Robot attacks deal 1 damage
   - Brief invincibility after damage (1 sec)
   - Visual: player flashes during invincibility

7. **Baby Holder Damage**
   - When baby holder takes damage:
     - Lose 1 heart (normal)
     - Baby immediately cries (triggers cry event)

8. **Downed State**
   - At 0 health: player enters DOWNED state
   - Player cannot move, rendered at 50% opacity
   - Player's item drops to ground at their position

9. **Revival System**
   - Another player stands on downed player
   - Progress indicator shows revival progress
   - After 3 seconds: downed player revives with 1 heart

#### Phase 4 Acceptance Criteria:
- [ ] Auto-shooting works for all weapon types
- [ ] Goo gun slows and eventually kills spider-bots
- [ ] Spider lanterns created on death
- [ ] EMP gun kills shock-bots, removes light
- [ ] Water gun disables flame-bots temporarily
- [ ] Wrong weapon causes confusion
- [ ] Players take damage and show invincibility
- [ ] Baby cries when holder is hit
- [ ] Downed players can be revived

---

### Phase 5: Win/Lose Conditions and Baby Crying

**Duration estimate:** 1 week

**Objective:** Implement game over, level complete, and baby cry mechanics.

#### Deliverables:

1. **Baby Cry Event**
   - Trigger when calm meter hits 0
   - Trigger when baby holder takes damage
   - All robots globally alerted
   - Robots set target to baby position
   - Cry lasts 3 seconds
   - After cry ends: calm meter resets to 50

2. **Game Over - Baby Killed**
   - If robot touches baby while on ground: game over
   - Display GameOverScene
   - Show "Baby was found!" message
   - Option to retry level

3. **Game Over - Baby Holder Downed**
   - If baby holder reaches 0 health: game over
   - Display GameOverScene
   - Show "Baby holder down!" message
   - Option to retry level

4. **Level Complete**
   - Exit zone detects collision with baby holder
   - When baby reaches exit: level complete
   - Display LevelCompleteScene
   - Show time taken (optional)
   - Option to proceed to next level

5. **Scene Transitions**
   - GameOverScene: Retry button returns to same level
   - LevelCompleteScene: Next Level button loads next level
   - After Level 6: show "Victory" screen

#### Phase 5 Acceptance Criteria:
- [ ] Baby cries when meter depletes or holder hit
- [ ] All robots converge when baby cries
- [ ] Game over when baby killed on ground
- [ ] Game over when baby holder downed
- [ ] Level complete when baby reaches exit
- [ ] Scene transitions work correctly

---

### Phase 6: UI and Menus

**Duration estimate:** 1 week

**Objective:** Implement all UI elements and menu screens.

#### Deliverables:

1. **HUD (UIScene)**
   - Render as overlay on GameScene
   - Display each player's hearts (top of screen)
   - Display calm meter bar near baby holder
   - Color-coded by player

2. **Main Menu (MenuScene)**
   - Game title: "Tabula Rasa"
   - Player count selection: 1, 2, 3, or 4 players
   - Level selection (unlocked levels only, or all for testing)
   - Start button

3. **Pause Menu (PauseScene)**
   - Activated by Escape key
   - Pauses game
   - Options: Resume, Restart Level, Main Menu
   - Click Resume or press Escape to unpause

4. **Game Over Screen**
   - "Game Over" text
   - Reason: "Baby was found!" or "Baby holder down!"
   - Buttons: Retry, Main Menu

5. **Level Complete Screen**
   - "Level Complete!" text
   - Show level name
   - Buttons: Next Level, Main Menu

6. **Asset Loading (BootScene)**
   - Show loading bar
   - Load any assets (placeholder for future sprites)
   - Transition to MenuScene when complete

#### Phase 6 Acceptance Criteria:
- [ ] HUD displays hearts and calm meter
- [ ] Main menu allows player count and level selection
- [ ] Pause menu works correctly
- [ ] Game over screen displays with retry option
- [ ] Level complete screen advances to next level

---

### Phase 7: All Levels and Polish

**Duration estimate:** 1-2 weeks

**Objective:** Create all 6 levels and polish gameplay.

#### Deliverables:

1. **Level Design**
   - Create Level 2-6 grid data
   - Define robot spawn positions and patrol paths
   - Define ground item positions for each player count
   - Test each level for playability

2. **Level Progression**
   - Level 1: Tutorial, spider-bots only
   - Level 2: Introduce shock-bots
   - Level 3: Introduce flame-bots
   - Level 4-6: Increasing complexity and size

3. **Difficulty Tuning**
   - Playtest each level solo and with multiple players
   - Adjust robot counts
   - Adjust robot patrol paths
   - Ensure levels are hard but fair

4. **Visual Polish**
   - Consistent color scheme
   - Clear visual feedback for all actions
   - Smooth animations (where applicable)

5. **Bug Fixes**
   - Fix any collision issues
   - Fix any state machine bugs
   - Fix any edge cases

6. **Build and Deploy**
   - Create production build (`npm run build`)
   - Test production build locally
   - Deploy to hosting platform (Itch.io recommended)
   - Write game description and controls for store page

#### Phase 7 Acceptance Criteria:
- [ ] All 6 levels playable
- [ ] Difficulty scales appropriately
- [ ] No game-breaking bugs
- [ ] Production build works
- [ ] Successfully deployed to hosting platform

---

## Appendices

### Appendix A: Constants Reference

```typescript
// src/config/constants.ts

// Display
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 960;
export const TILE_SIZE = 96;

// Player
export const BASE_PLAYER_SPEED = 200;
export const BABY_HOLDER_SPEED = 120;
export const PLAYER_MAX_HEALTH = 3;
export const PLAYER_RADIUS = 16;
export const PLAYER_AMBIENT_LIGHT_RADIUS = 40;
export const PLAYER_AMBIENT_LIGHT_INTENSITY = 0.3;
export const INVINCIBILITY_DURATION = 1000; // ms

// Baby
export const CALM_METER_MAX = 100;
export const CALM_METER_DRAIN_RATE = 10; // per second
export const CALM_METER_FILL_RATE = 15; // per second
export const CRY_ALERT_DURATION = 3000; // ms
export const CRY_ROBOT_SPEED_MULTIPLIER = 1.5;
export const CALM_METER_POST_CRY_RESET = 50;
export const BABY_RADIUS = 8;

// Weapons
export const WEAPON_RANGE = 150;
export const WEAPON_AIM_ARC = 90; // degrees
export const GOO_GUN_COOLDOWN = 800; // ms
export const EMP_GUN_COOLDOWN = 1200; // ms
export const WATER_GUN_COOLDOWN = 1000; // ms

// Swapping
export const GROUND_ITEM_PICKUP_RADIUS = 20;
export const PLAYER_SWAP_DURATION = 2000; // ms
export const PLAYER_OVERLAP_RADIUS = 30;

// Revival
export const REVIVE_DURATION = 3000; // ms
export const REVIVE_HEALTH_RESTORE = 1;

// Spider-Bot
export const SPIDER_SPEED = 180;
export const SPIDER_ATTACK_RANGE = 25;
export const SPIDER_ATTACK_COOLDOWN = 1000; // ms
export const SPIDER_ATTACK_DAMAGE = 1;
export const SPIDER_GOO_HITS_TO_KILL = 3;
export const SPIDER_LIGHT_RADIUS = 120;
export const SPIDER_LIGHT_ANGLE = 60; // degrees
export const SPIDER_LIGHT_COLOR = 0xFF69B4;
export const SPIDER_SIZE = 24;
export const SPIDER_LANTERN_RADIUS = 100;

// Shock-Bot
export const SHOCK_SPEED = 120;
export const SHOCK_ATTACK_RANGE = 130;
export const SHOCK_ATTACK_COOLDOWN = 2000; // ms
export const SHOCK_ATTACK_DAMAGE = 1;
export const SHOCK_ATTACK_CHARGE_TIME = 500; // ms
export const SHOCK_ATTACK_AOE_RADIUS = 30;
export const SHOCK_LIGHT_RADIUS = 150;
export const SHOCK_LIGHT_ANGLE = 45; // degrees
export const SHOCK_LIGHT_COLOR = 0x4169E1;
export const SHOCK_SIZE = 36;

// Flame-Bot
export const FLAME_SPEED = 70;
export const FLAME_ATTACK_RANGE = 140;
export const FLAME_ATTACK_COOLDOWN = 2500; // ms
export const FLAME_ATTACK_DAMAGE = 1;
export const FLAME_DISABLE_DURATION = 4000; // ms
export const FLAME_REIGNITE_TIME = 2000; // ms
export const FLAME_LIGHT_RADIUS = 180;
export const FLAME_LIGHT_ANGLE = 50; // degrees
export const FLAME_LIGHT_COLOR = 0xFF4500;
export const FLAME_SIZE = 48;

// Detection
export const SHOOTING_SOUND_RADIUS = 200;
export const SOUND_INVESTIGATION_DURATION = 2000; // ms
export const WRONG_WEAPON_CONFUSION_DURATION = 500; // ms
export const ALERT_SPEED_MULTIPLIER = 1.3;

// Colors
export const PLAYER_COLORS = [0x00FF00, 0x0088FF, 0xFFFF00, 0xAA00FF];
export const WALL_COLOR = 0x000000;
export const FLOOR_COLOR = 0x1A1A1A;
export const EXIT_COLOR = 0x00FF00;
export const BABY_COLOR = 0xFFFFFF;
export const GOO_GUN_COLOR = 0xFF69B4;
export const EMP_GUN_COLOR = 0x4169E1;
export const WATER_GUN_COLOR = 0x00FFFF;
```

### Appendix B: Key Bindings Reference

```typescript
// src/config/controls.ts

export const PLAYER_CONTROLS = {
  1: {
    up: 'W',
    down: 'S',
    left: 'A',
    right: 'D'
  },
  2: {
    up: 'T',
    down: 'G',
    left: 'F',
    right: 'H'
  },
  3: {
    up: 'I',
    down: 'K',
    left: 'J',
    right: 'L'
  },
  4: {
    up: 'UP',
    down: 'DOWN',
    left: 'LEFT',
    right: 'RIGHT'
  }
};

export const SYSTEM_CONTROLS = {
  pause: 'ESC'
};
```

### Appendix C: Type Definitions

```typescript
// src/types/index.ts

export interface Vector2 {
  x: number;
  y: number;
}

export enum PlayerState {
  ACTIVE = 'ACTIVE',
  DOWNED = 'DOWNED',
  INVINCIBLE = 'INVINCIBLE'
}

export enum BabyState {
  HELD_CALM = 'HELD_CALM',
  HELD_CRYING = 'HELD_CRYING',
  GROUND_CALM = 'GROUND_CALM',
  GROUND_CRYING = 'GROUND_CRYING'
}

export enum WeaponType {
  GOO_GUN = 'GOO_GUN',
  EMP_GUN = 'EMP_GUN',
  WATER_GUN = 'WATER_GUN'
}

export enum RobotType {
  SPIDER_BOT = 'SPIDER_BOT',
  SHOCK_BOT = 'SHOCK_BOT',
  FLAME_BOT = 'FLAME_BOT'
}

export enum RobotState {
  PATROL = 'PATROL',
  ALERT = 'ALERT',
  ATTACKING = 'ATTACKING',
  INVESTIGATING = 'INVESTIGATING',
  DISABLED = 'DISABLED',
  DEAD = 'DEAD'
}

export interface LevelData {
  id: number;
  name: string;
  grid: number[][];
  tileSize: number;
  startPosition: Vector2;
  exitPosition: Vector2;
  robots: RobotSpawn[];
  groundItems: ItemSpawn[];
}

export interface RobotSpawn {
  type: RobotType;
  position: Vector2;
  patrolPath: Vector2[];
}

export interface ItemSpawn {
  type: WeaponType;
  position: Vector2;
  forPlayerCount: number[];
}

export type Item = { type: 'baby' } | { type: 'weapon'; weaponType: WeaponType };
```

### Appendix D: Phaser Game Configuration

```typescript
// src/config/gameConfig.ts

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants';
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { GameScene } from '../scenes/GameScene';
import { UIScene } from '../scenes/UIScene';
import { PauseScene } from '../scenes/PauseScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { LevelCompleteScene } from '../scenes/LevelCompleteScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false // Set to true during development
    }
  },
  scene: [
    BootScene,
    MenuScene,
    GameScene,
    UIScene,
    PauseScene,
    GameOverScene,
    LevelCompleteScene
  ],
  render: {
    pixelArt: true,
    antialias: false
  },
  // Enable Light2D pipeline
  pipeline: { 
    Light2D: Phaser.Renderer.WebGL.Pipelines.LightPipeline 
  }
};
```

### Appendix E: Sample Level 1 Data

```typescript
// src/levels/Level1.ts

import { LevelData, RobotType, WeaponType } from '../types';

export const Level1: LevelData = {
  id: 1,
  name: 'Awakening',
  tileSize: 96,
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  startPosition: { x: 1, y: 1 },
  exitPosition: { x: 8, y: 8 },
  robots: [
    {
      type: RobotType.SPIDER_BOT,
      position: { x: 5, y: 2 },
      patrolPath: [
        { x: 5, y: 2 },
        { x: 5, y: 4 },
        { x: 3, y: 4 },
        { x: 3, y: 2 }
      ]
    },
    {
      type: RobotType.SPIDER_BOT,
      position: { x: 7, y: 5 },
      patrolPath: [
        { x: 7, y: 5 },
        { x: 7, y: 8 },
        { x: 5, y: 8 },
        { x: 5, y: 5 }
      ]
    },
    {
      type: RobotType.SPIDER_BOT,
      position: { x: 2, y: 7 },
      patrolPath: [
        { x: 2, y: 7 },
        { x: 2, y: 5 },
        { x: 4, y: 5 }
      ]
    }
  ],
  groundItems: [
    {
      type: WeaponType.EMP_GUN,
      position: { x: 2, y: 1 },
      forPlayerCount: [1, 2]
    },
    {
      type: WeaponType.WATER_GUN,
      position: { x: 3, y: 1 },
      forPlayerCount: [1, 2, 3]
    }
  ]
};
```

### Appendix F: Geometry Utility Functions

```typescript
// src/utils/geometry.ts

import { Vector2 } from '../types';

/**
 * Calculate distance between two points
 */
export function distance(a: Vector2, b: Vector2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalize a vector to unit length
 */
export function normalize(v: Vector2): Vector2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * Get angle of vector in radians (-PI to PI)
 */
export function vectorToAngle(v: Vector2): number {
  return Math.atan2(v.y, v.x);
}

/**
 * Convert angle to unit vector
 */
export function angleToVector(angle: number): Vector2 {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle)
  };
}

/**
 * Normalize angle to range -PI to PI
 */
export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Check if point is within a cone
 * @param origin - Origin point of the cone
 * @param direction - Direction the cone faces (unit vector)
 * @param angle - Total cone angle in radians
 * @param radius - Cone radius/length
 * @param point - Point to check
 */
export function isPointInCone(
  origin: Vector2,
  direction: Vector2,
  angle: number,
  radius: number,
  point: Vector2
): boolean {
  // Check distance first
  const dist = distance(origin, point);
  if (dist > radius) return false;
  
  // Get vector to point
  const toPoint: Vector2 = {
    x: point.x - origin.x,
    y: point.y - origin.y
  };
  
  // Get angles
  const dirAngle = vectorToAngle(direction);
  const pointAngle = vectorToAngle(toPoint);
  
  // Check if within cone angle
  const angleDiff = Math.abs(normalizeAngle(pointAngle - dirAngle));
  return angleDiff <= angle / 2;
}

/**
 * Check line of sight between two points against wall grid
 * Uses simple grid-based raycasting
 */
export function hasLineOfSight(
  from: Vector2,
  to: Vector2,
  grid: number[][],
  tileSize: number
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist / (tileSize / 2));
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    
    const tileX = Math.floor(x / tileSize);
    const tileY = Math.floor(y / tileSize);
    
    // Check bounds
    if (tileY < 0 || tileY >= grid.length || 
        tileX < 0 || tileX >= grid[0].length) {
      return false;
    }
    
    // Check wall
    if (grid[tileY][tileX] === 1) {
      return false;
    }
  }
  
  return true;
}
```

### Appendix G: Testing Checklist

Use this checklist to verify each phase is complete:

#### Phase 1 Testing
- [ ] Game loads without errors
- [ ] Level grid displays correctly (walls black, floor gray)
- [ ] Exit zone visible as green
- [ ] Player 1 spawns at start position
- [ ] WASD moves player 1
- [ ] Player cannot walk through walls
- [ ] Player cannot leave map bounds

#### Phase 2 Testing
- [ ] All 4 players spawn with correct colors
- [ ] Each player moves with correct keys
- [ ] Players collide with each other
- [ ] Baby holder is visibly carrying baby
- [ ] Baby holder moves slower
- [ ] Calm meter bar visible above baby holder
- [ ] Calm meter drains when moving
- [ ] Calm meter fills when stationary
- [ ] Walking over ground item swaps items
- [ ] Two players standing still together swap after 2 seconds
- [ ] Correct loadout for each player count

#### Phase 3 Testing
- [ ] Spider-bots patrol their paths
- [ ] Shock-bots patrol their paths
- [ ] Flame-bots patrol their paths
- [ ] Each robot type has correct colored light cone
- [ ] Light cones point in robot facing direction
- [ ] Player ambient light visible (small radius)
- [ ] Level is dark outside of light sources
- [ ] Robot detects player only when in light cone
- [ ] Robot enters alert state when player detected
- [ ] Robot chases detected player
- [ ] Robot returns to patrol when player escapes

#### Phase 4 Testing
- [ ] Weapons auto-fire at nearby robots
- [ ] Weapons respect cooldown
- [ ] Goo gun slows spider-bots
- [ ] Spider-bot dies after 3 goo hits
- [ ] Dead spider becomes lantern (permanent light)
- [ ] EMP gun kills shock-bot in one hit
- [ ] Dead shock-bot's light disappears
- [ ] Water gun disables flame-bot
- [ ] Flame-bot reignites after delay
- [ ] Wrong weapon causes confusion pause
- [ ] Player takes damage from robot attacks
- [ ] Player flashes during invincibility
- [ ] Baby cries when holder takes damage
- [ ] Player enters downed state at 0 health
- [ ] Downed player drops their item
- [ ] Standing on downed player starts revive
- [ ] Player revives with 1 health after duration

#### Phase 5 Testing
- [ ] Baby cries when calm meter hits 0
- [ ] All robots converge when baby cries
- [ ] Robots move faster during cry alert
- [ ] Alert ends after 3 seconds
- [ ] Calm meter resets to 50 after cry
- [ ] Game over when robot touches ground baby
- [ ] Game over when baby holder downed
- [ ] Level complete when baby holder reaches exit
- [ ] GameOverScene displays correctly
- [ ] LevelCompleteScene displays correctly
- [ ] Can retry level from game over
- [ ] Can proceed to next level

#### Phase 6 Testing
- [ ] HUD shows all players' hearts
- [ ] HUD shows calm meter
- [ ] Main menu displays
- [ ] Can select player count
- [ ] Can select level
- [ ] Pause menu works with Escape
- [ ] Can resume from pause
- [ ] Can restart level from pause
- [ ] Can return to menu from pause

#### Phase 7 Testing
- [ ] All 6 levels load correctly
- [ ] Each level has appropriate difficulty
- [ ] Robot scaling works for all player counts
- [ ] No game-breaking bugs
- [ ] Production build works
- [ ] Deployment successful

---

## Document End

This implementation plan contains all information necessary to build Tabula Rasa from start to finish. Each phase builds upon the previous, with clear deliverables and acceptance criteria. The appendices provide ready-to-use code structures, constants, and utility functions.

For questions or clarifications during development, refer to the relevant section of this document. Good luck, and protect that baby!