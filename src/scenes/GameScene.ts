import Phaser from 'phaser';
import { Level1 } from '../levels/Level1';
import { WALL_COLOR, FLOOR_COLOR, EXIT_COLOR, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, PLAYER_RADIUS, MAX_PUSH_VELOCITY, PUSH_VELOCITY_THRESHOLD, DEBUG_MODE } from '../config/constants';
import { Player } from '../entities/Player';
import { Baby } from '../entities/Baby';
import { Weapon } from '../entities/Weapon';
import { Robot } from '../entities/Robot';
import { SpiderBot } from '../entities/SpiderBot';
import { ShockBot } from '../entities/ShockBot';
import { FlameBot } from '../entities/FlameBot';
import { SwapSystem } from '../systems/SwapSystem';
import { DetectionSystem } from '../systems/DetectionSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { Lantern } from '../entities/Lantern';
import { RobotSpawn, WeaponType, RobotType, RobotState, LevelData } from '../types';
import { GameOverData } from './GameOverScene';
import { LevelCompleteData } from './LevelCompleteScene';

/**
 * Main gameplay scene
 * Handles level rendering, entity management, game logic, and UI
 */
export class GameScene extends Phaser.Scene {
  private levelData!: LevelData;
  private playerCount: number = 4;
  private levelOffsetX = 0;
  private levelOffsetY = 0;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private players: Player[] = [];
  private robots: Robot[] = [];
  private baby!: Baby;
  private swapSystem!: SwapSystem;
  private detectionSystem!: DetectionSystem;
  private combatSystem!: CombatSystem;
  private lanterns: Lantern[] = [];
  private exitZone!: Phaser.GameObjects.Rectangle;
  
  // Game state flags
  private isGameOver: boolean = false;
  private isLevelComplete: boolean = false;
  private isPaused: boolean = false;
  private escapeKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data?: { levelData?: LevelData; playerCount?: number }) {
    // Accept level data and player count from scene transition, or default to Level1 and 4 players
    this.levelData = data?.levelData || Level1;
    this.playerCount = data?.playerCount || 4;
    this.isGameOver = false; // Reset game over flag
    this.isLevelComplete = false; // Reset level complete flag (Phase 5.4)
    
    // Ensure arrays are reset (defensive)
    this.players = [];
    this.robots = [];
    this.lanterns = [];
  }

  /**
   * Called when scene is shut down (e.g., when transitioning to another scene)
   * Phaser automatically cleans up game objects, we just reset references
   */
  shutdown(): void {
    // Stop UIScene when leaving GameScene
    if (this.scene.isActive('UIScene')) {
      this.scene.stop('UIScene');
    }

    // Stop PauseScene if it's active
    if (this.scene.isActive('PauseScene')) {
      this.scene.stop('PauseScene');
    }

    this.players = [];
    this.robots = [];
    this.lanterns = [];
    this.baby = undefined!;
    this.walls = undefined!;
    this.exitZone = undefined!;
    this.swapSystem = undefined!;
    this.detectionSystem = undefined!;
    this.combatSystem = undefined!;
    this.levelOffsetX = 0;
    this.levelOffsetY = 0;
    this.isPaused = false;
  }

  create() {
    console.log(`🎮 Level started: ${this.levelData.name} (${this.levelData.grid.length}x${this.levelData.grid[0].length})`);
    
    this.renderLevel();
    this.createWallCollisions();
    this.createExitZone();
    this.spawnPlayers();
    this.initializeSwapSystem();
    this.initializeDetectionSystem();
    this.initializeCombatSystem();
    this.setupStartingLoadout(this.players.length);
    this.spawnRobots(); // Phase 3.7: Robust spawning system
    
    // Listen for spider-bot death events to create lanterns
    this.events.on('spider-bot-died', this.handleSpiderBotDeath.bind(this));
    
    // Listen for baby cry events to alert all robots (Phase 4.7)
    this.events.on('baby-cried', this.handleBabyCry.bind(this));
    
    // Set up collisions between players and walls
    this.physics.add.collider(this.players, this.walls, this.handlePlayerWallCollision);
    
    // Set up collisions between players (they can push each other)
    this.physics.add.collider(this.players, this.players, this.handlePlayerPlayerCollision);
    
    // Set up collisions between robots and walls
    this.physics.add.collider(this.robots, this.walls, this.handleRobotWallCollision);
    
    // Set up collision between players and exit zone (Phase 5.4)
    // This is set up after players are spawned, so players array is populated
    this.physics.add.overlap(this.players, this.exitZone, this.handleExitZoneOverlap);
    
    // Launch UIScene as overlay
    this.scene.launch('UIScene');
    
    // Send initial player data to UIScene
    this.sendUIUpdate();
    
    // Set up Escape key to pause game
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escapeKey.on('down', () => {
      this.togglePause();
    });
    
    // Listen for unpause event from PauseScene
    this.events.on('unpause', () => {
      this.resumeGame();
    });
    
    console.log(`✨ Game scene initialized and ready!`);
  }

  update(time: number, delta: number) {
    // CRITICAL: If paused, don't update anything
    // All systems (players, robots, baby, weapons, combat, detection, swap) are paused
    // Physics world is also paused via this.physics.pause() in pauseGame()
    // This ensures NO movement, timers, or game logic runs while paused
    if (this.isPaused) {
      return;
    }

    // Phase 5.2: Check for game over (baby holder downed) - check early to prevent further updates
    if (!this.isGameOver && !this.isLevelComplete && this.baby) {
      const babyHolder = this.players.find(player => player.heldBaby === this.baby);
      if (babyHolder && babyHolder.isDowned) {
        this.triggerGameOver('Baby holder down!');
        return; // Stop all updates
      }
    }

    // If game over or level complete, don't update anything
    if (this.isGameOver || this.isLevelComplete) {
      return;
    }

    // Update all players (apply input and movement)
    this.players.forEach(player => {
      player.update(delta);
    });
    
    // Constrain ALL players to bounds (including pushed players)
    this.players.forEach(player => {
      this.constrainPlayerToBounds(player);
    });
    
    // Update baby (handles calm meter and rendering)
    if (this.baby) {
      this.baby.update(delta);
    }
    
    // Update swap system (handles ground item pickup and player-to-player swaps)
    this.swapSystem.update(delta);
    
    // Update all weapons (both held and on ground)
    this.children.list.forEach(child => {
      if (child instanceof Weapon) {
        child.update(delta);
      }
    });
    
    // Update all robots
    this.robots.forEach(robot => {
      // SpiderBot, ShockBot, FlameBot and other specific robot types need player list
      if (robot instanceof SpiderBot || robot instanceof ShockBot || robot instanceof FlameBot) {
        robot.update(delta, this.players);
      } else {
        // Base Robot class uses standard update
        robot.update(delta);
      }
    });
    
    // Update detection system (checks if robots detect players)
    this.detectionSystem.update();
    
    // Update combat system (handles auto-shooting)
    this.combatSystem.update(delta);
    
    // Update UI scene with current player and baby data
    this.sendUIUpdate();
  }

  private renderLevel() {
    const grid = this.levelData.grid;
    const tileSize = this.levelData.tileSize;
    const exitPos = this.levelData.exitPosition;

    // Calculate offset to center the level on screen
    const levelWidth = grid[0].length * tileSize;
    const levelHeight = grid.length * tileSize;
    this.levelOffsetX = (GAME_WIDTH - levelWidth) / 2;
    this.levelOffsetY = (GAME_HEIGHT - levelHeight) / 2;

    // Render each tile in the grid
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const tileValue = grid[row][col];
        const x = col * tileSize + this.levelOffsetX;
        const y = row * tileSize + this.levelOffsetY;
        const isExit = col === exitPos.x && row === exitPos.y;

        // Determine tile color
        let tileColor: number;
        if (isExit) {
          tileColor = EXIT_COLOR;
        } else if (tileValue === 1) {
          tileColor = WALL_COLOR;
        } else {
          tileColor = FLOOR_COLOR;
        }

        // Draw the tile as a rectangle
        this.add.rectangle(
          x + tileSize / 2, // Center of tile
          y + tileSize / 2, // Center of tile
          tileSize,
          tileSize,
          tileColor
        );
      }
    }
  }

  private createWallCollisions() {
    const grid = this.levelData.grid;
    const tileSize = this.levelData.tileSize;

    // Create static physics group for walls
    this.walls = this.physics.add.staticGroup();

    // Create collision bodies for each wall tile
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col] === 1) {
          // This is a wall tile - create invisible static body for collision
          const x = col * tileSize + this.levelOffsetX + tileSize / 2;
          const y = row * tileSize + this.levelOffsetY + tileSize / 2;
          
          // Create invisible rectangle for collision and add as static body
          const wall = this.add.rectangle(x, y, tileSize, tileSize, 0x000000, 0);
          wall.setVisible(false);
          this.physics.add.existing(wall, true); // true = static body (already immovable)
          this.walls.add(wall);
        }
      }
    }
  }

  /**
   * Creates the exit zone collision area (Phase 5.4)
   * @throws Error if level data is invalid
   */
  private createExitZone(): void {
    if (!this.levelData?.exitPosition) {
      throw new Error('Invalid level data: missing exit position');
    }

    const exitPos = this.levelData.exitPosition;
    const tileSize = this.levelData.tileSize;

    // Calculate exit zone position in world coordinates
    const exitX = exitPos.x * tileSize + this.levelOffsetX + tileSize / 2;
    const exitY = exitPos.y * tileSize + this.levelOffsetY + tileSize / 2;

    // Create exit zone as an invisible physics rectangle
    this.exitZone = this.add.rectangle(exitX, exitY, tileSize, tileSize, EXIT_COLOR, 0);
    this.exitZone.setVisible(false);
    this.physics.add.existing(this.exitZone, true); // true = static body
  }

  /**
   * Spawns all players at the level start position with slight offsets
   * @throws Error if level data is invalid
   */
  private spawnPlayers(): void {
    if (!this.levelData?.startPosition) {
      throw new Error('Invalid level data: missing start position');
    }

    const startPos = this.levelData.startPosition;
    const tileSize = this.levelData.tileSize;
    
    // Base position in world coordinates
    const baseX = startPos.x * tileSize + this.levelOffsetX + tileSize / 2;
    const baseY = startPos.y * tileSize + this.levelOffsetY + tileSize / 2;
    
    // Spawn 4 players with slight offsets so they don't overlap
    const PLAYER_SPAWN_OFFSET = 24; // pixels
    const offsets = [
      { x: -PLAYER_SPAWN_OFFSET, y: -PLAYER_SPAWN_OFFSET }, // Player 1: top-left
      { x: PLAYER_SPAWN_OFFSET, y: -PLAYER_SPAWN_OFFSET },  // Player 2: top-right
      { x: -PLAYER_SPAWN_OFFSET, y: PLAYER_SPAWN_OFFSET },  // Player 3: bottom-left
      { x: PLAYER_SPAWN_OFFSET, y: PLAYER_SPAWN_OFFSET }    // Player 4: bottom-right
    ];
    
    // Spawn players based on selected player count
    for (let i = 1; i <= this.playerCount; i++) {
      const offset = offsets[i - 1];
      const player = new Player(this, baseX + offset.x, baseY + offset.y, i);
      this.players.push(player);
    }
    
    console.log(`✅ Players spawned: ${this.players.length} players at position (${baseX.toFixed(0)}, ${baseY.toFixed(0)})`);
  }

  /**
   * Sets up the starting loadout for all players based on player count
   * @param playerCount Number of players (1-4)
   * @throws Error if player count is invalid or players array is empty
   */
  private setupStartingLoadout(playerCount: number): void {
    if (playerCount < 1 || playerCount > 4) {
      throw new Error(`Invalid player count: ${playerCount}. Must be between 1 and 4.`);
    }
    
    if (this.players.length === 0) {
      throw new Error('Cannot setup starting loadout: no players spawned');
    }
    // Phase 2.7: Starting Loadout
    // Player 1 always starts with baby
    this.baby = new Baby(this);
    const player1 = this.players.find(p => p.playerId === 1);
    if (!player1) {
      throw new Error('Player 1 not found in players array');
    }
    player1.setHeldBaby(this.baby);
    console.log(`📦 Starting loadout: Player 1 received Baby`);

    // Remaining players start with weapons in order: Goo, EMP, Water
    // Each active player gets exactly one item (baby or weapon)
    // No ground items - simplified system
    const weaponTypes = [WeaponType.GOO_GUN, WeaponType.EMP_GUN, WeaponType.WATER_GUN];
    
    for (let i = 2; i <= Math.min(playerCount, 4); i++) {
      const player = this.players.find(p => p.playerId === i);
      if (player) {
        const weaponType = weaponTypes[i - 2]; // i-2 because Player 1 (index 0) holds baby, not a weapon
        
        // Create weapon at player position (will be held immediately)
        const weapon = new Weapon(this, weaponType, player.x, player.y);
        player.setHeldWeapon(weapon);
        console.log(`📦 Starting loadout: Player ${i} received ${weaponType}`);
      }
    }

    // DISABLED: Ground item spawning system (kept for future use)
    // For fewer players: extra weapons spawn on ground near start
    /*
    if (playerCount < 4) {
      const startPos = this.levelData.startPosition;
      const tileSize = this.levelData.tileSize;
      const baseX = startPos.x * tileSize + this.levelOffsetX + tileSize / 2;
      const baseY = startPos.y * tileSize + this.levelOffsetY + tileSize / 2;
      
      // Get weapons to spawn on ground based on player count
      const weaponsToSpawn = this.getWeaponsForGroundSpawn(playerCount);
      
      // Spawn weapons on ground in a circular pattern around start position
      const spawnOffsets = this.generateGroundItemSpawnOffsets(weaponsToSpawn.length);
      
      weaponsToSpawn.forEach((weaponType, index) => {
        const offset = spawnOffsets[index];
        const spawnX = baseX + offset.x;
        const spawnY = baseY + offset.y;
        
        const weapon = new Weapon(this, weaponType, spawnX, spawnY);
        weapon.placeOnGround(spawnX, spawnY);
        this.swapSystem.addGroundItem(weapon);
        console.log(`📦 Starting loadout: ${weaponType} spawned on ground at (${spawnX.toFixed(0)}, ${spawnY.toFixed(0)})`);
      });
    }
    */
  }

  /**
   * Determines which weapons should spawn on ground based on player count
   * @param playerCount Number of active players
   * @returns Array of weapon types to spawn on ground
   */
  private getWeaponsForGroundSpawn(playerCount: number): WeaponType[] {
    const weaponsToSpawn: WeaponType[] = [];
    
    if (playerCount === 3) {
      // Player 1 (Baby), Player 2 (Goo), Player 3 (EMP)
      // Need Water on ground
      weaponsToSpawn.push(WeaponType.WATER_GUN);
    } else if (playerCount === 2) {
      // Player 1 (Baby), Player 2 (Goo)
      // Need EMP and Water on ground
      weaponsToSpawn.push(WeaponType.EMP_GUN, WeaponType.WATER_GUN);
    } else if (playerCount === 1) {
      // Player 1 (Baby)
      // Need all 3 guns on ground
      weaponsToSpawn.push(WeaponType.GOO_GUN, WeaponType.EMP_GUN, WeaponType.WATER_GUN);
    }
    
    return weaponsToSpawn;
  }

  /**
   * Generates spawn offsets for ground items in a circular pattern around start position
   * @param count Number of items to spawn
   * @returns Array of offset positions
   */
  private generateGroundItemSpawnOffsets(count: number): Array<{ x: number; y: number }> {
    const offsets: Array<{ x: number; y: number }> = [];
    
    // Generate offsets in a circular pattern around start position
    if (count === 0) return offsets;
    
    const angleStep = (2 * Math.PI) / count;
    const radius = TILE_SIZE * 1.5; // Spawn 1.5 tiles away from start
    
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      offsets.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
    }
    
    return offsets;
  }

  /**
   * Initializes the swap system for handling item exchanges
   */
  private initializeSwapSystem() {
    this.swapSystem = new SwapSystem(this);
    this.swapSystem.setPlayers(this.players);
  }

  /**
   * Initializes the detection system for robot player detection
   */
  private initializeDetectionSystem() {
    this.detectionSystem = new DetectionSystem();
    this.detectionSystem.setPlayers(this.players);
    this.detectionSystem.setLevelInfo(
      this.levelData.grid,
      this.levelData.tileSize,
      this.levelOffsetX,
      this.levelOffsetY
    );
    // Robots will be set after they're spawned
  }

  /**
   * Initializes the combat system for auto-shooting
   * Phase 4.1: Auto-Shooting System
   */
  private initializeCombatSystem() {
    this.combatSystem = new CombatSystem(this);
    this.combatSystem.setPlayers(this.players);
    this.combatSystem.setLevelInfo(
      this.levelData.grid,
      this.levelData.tileSize,
      this.levelOffsetX,
      this.levelOffsetY
    );
    // Connect detection system for sound detection
    this.combatSystem.setDetectionSystem(this.detectionSystem);
    // Robots will be set after they're spawned
  }
  
  /**
   * Handles spider-bot death event - creates a lantern
   * Phase 4.2: Lantern creation
   */
  private handleSpiderBotDeath(data: { x: number; y: number }): void {
    const lantern = new Lantern(this, data.x, data.y);
    this.lanterns.push(lantern);
    console.log(`💡 Lantern created at (${data.x.toFixed(0)}, ${data.y.toFixed(0)})`);
  }

  /**
   * Handles baby cry event - alerts all robots to baby's location
   * Phase 4.7: Baby Holder Damage
   */
  private handleBabyCry(data: { x: number; y: number }): void {
    // Alert all robots to the baby's location
    let alertedCount = 0;
    for (const robot of this.robots) {
      // Check robot state before alerting
      const previousState = robot.state;
      robot.alertToLocation({ x: data.x, y: data.y });
      
      // Count if robot was successfully alerted (state changed to ALERT)
      if (robot.state === RobotState.ALERT) {
        alertedCount++;
      }
      
      if (DEBUG_MODE && previousState !== robot.state) {
        console.log(`[Robot ${robot.robotType}] State changed from ${previousState} to ${robot.state} due to baby cry`);
      }
    }
    
    if (DEBUG_MODE) {
      console.log(`😭 Baby cried! ${alertedCount}/${this.robots.length} robots alerted to location (${data.x.toFixed(0)}, ${data.y.toFixed(0)})`);
    }
  }


  /**
   * Spawns all robots from level data based on player count
   * Phase 3.7: Robust spawning system
   * Scales robot count based on number of players
   * @throws Error if level data is invalid
   */
  private spawnRobots(): void {
    if (!this.levelData) {
      throw new Error('Cannot spawn robots: level data not initialized');
    }
    const tileSize = this.levelData.tileSize;
    const playerCount = this.players.length;
    
    if (this.levelData.robots.length === 0) {
      console.log('⚠️ No robots defined in level data');
      return;
    }
    
    // Get robots to spawn based on player count scaling
    const robotsToSpawn = this.getRobotsForPlayerCount(playerCount);
    
    if (robotsToSpawn.length === 0) {
      console.log(`⚠️ No robots to spawn for ${playerCount} player(s)`);
      return;
    }
    
    // Spawn each robot
    let spawnedCount = 0;
    for (const robotSpawn of robotsToSpawn) {
      // Convert spawn position from tile coordinates to world coordinates
      const worldX = robotSpawn.position.x * tileSize + this.levelOffsetX + tileSize / 2;
      const worldY = robotSpawn.position.y * tileSize + this.levelOffsetY + tileSize / 2;
      
      // Create robot based on type
      let robot: Robot;
      
      if (robotSpawn.type === RobotType.SPIDER_BOT) {
        robot = new SpiderBot(
          this,
          worldX,
          worldY,
          this.levelOffsetX,
          this.levelOffsetY,
          tileSize
        );
      } else if (robotSpawn.type === RobotType.SHOCK_BOT) {
        robot = new ShockBot(
          this,
          worldX,
          worldY,
          this.levelOffsetX,
          this.levelOffsetY,
          tileSize
        );
      } else if (robotSpawn.type === RobotType.FLAME_BOT) {
        robot = new FlameBot(
          this,
          worldX,
          worldY,
          this.levelOffsetX,
          this.levelOffsetY,
          tileSize
        );
      } else {
        // Unknown robot type - skip with warning
        console.warn(`⚠️ Unknown robot type: ${robotSpawn.type}, skipping spawn`);
        continue;
      }
      
      // Set level grid for random walk AI and pathfinding
      robot.setLevelGrid(this.levelData.grid);
      
      // Add robot to scene
      this.robots.push(robot);
      spawnedCount++;
      
      console.log(`🤖 Robot spawned: ${robotSpawn.type} at tile (${robotSpawn.position.x}, ${robotSpawn.position.y}) [world: (${worldX.toFixed(0)}, ${worldY.toFixed(0)})]`);
    }
    
    console.log(`✅ Robots spawned: ${spawnedCount} robot(s) for ${playerCount} player(s)`);
    
    // Update detection system with robots after spawning
    if (this.detectionSystem) {
      this.detectionSystem.setRobots(this.robots);
    }
    
    // Update combat system with robots after spawning
    if (this.combatSystem) {
      this.combatSystem.setRobots(this.robots);
    }
  }
  
  /**
   * Gets robots to spawn based on player count scaling
   * Phase 3.7: Scales robot count according to player count
   * @param playerCount Number of players
   * @returns Array of robot spawns to actually spawn
   */
  private getRobotsForPlayerCount(playerCount: number): RobotSpawn[] {
    // For now, Level 1 has one of each type (Spider-Bot, Shock-Bot, Flame-Bot)
    // Future: Implement proper scaling logic based on level and player count
    // For Level 1, spawn all robots regardless of player count
    // (Scaling can be implemented in future levels)
    
    // Return all robots from level data
    // TODO: Implement proper scaling per level (see implementation-docs.md section 6.3)
    return this.levelData.robots;
  }

  /**
   * Handles collision between a robot and a wall
   * Stops robot velocity to prevent going through walls
   */
  private handleRobotWallCollision = (robotObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile, wallObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile) => {
    const robot = robotObj as Robot;
    if (robot.body.touching.left || robot.body.touching.right) {
      robot.body.setVelocityX(0);
    }
    if (robot.body.touching.up || robot.body.touching.down) {
      robot.body.setVelocityY(0);
    }
  }

  private clampPlayerVelocity(player: Player) {
    // Clamp velocity to prevent excessive push speeds
    if (Math.abs(player.body.velocity.x) > MAX_PUSH_VELOCITY || Math.abs(player.body.velocity.y) > MAX_PUSH_VELOCITY) {
      player.body.setVelocity(
        Phaser.Math.Clamp(player.body.velocity.x, -MAX_PUSH_VELOCITY, MAX_PUSH_VELOCITY),
        Phaser.Math.Clamp(player.body.velocity.y, -MAX_PUSH_VELOCITY, MAX_PUSH_VELOCITY)
      );
    }
  }

  /**
   * Handles collision between a player and a wall
   * Stops player velocity to prevent being pushed through walls
   */
  private handlePlayerWallCollision = (playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile, wallObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile) => {
    const player = playerObj as Player;
    if (player.body.touching.left || player.body.touching.right) {
      player.body.setVelocityX(0);
    }
    if (player.body.touching.up || player.body.touching.down) {
      player.body.setVelocityY(0);
    }
  }

  /**
   * Handles collision between two players
   * Tracks pushing relationships for speed reduction and clamps excessive velocities
   */
  private handlePlayerPlayerCollision = (player1Obj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile, player2Obj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile) => {
    const player1 = player1Obj as Player;
    const player2 = player2Obj as Player;
    
    // Determine which player is pushing (the one with higher velocity)
    const p1Vel = Math.sqrt(player1.body.velocity.x ** 2 + player1.body.velocity.y ** 2);
    const p2Vel = Math.sqrt(player2.body.velocity.x ** 2 + player2.body.velocity.y ** 2);
    
    // Track pushing relationships for speed reduction
    if (p1Vel > p2Vel + PUSH_VELOCITY_THRESHOLD) {
      // Player 1 is pushing player 2
      player1.pushingPlayers.add(player2);
    } else if (p2Vel > p1Vel + PUSH_VELOCITY_THRESHOLD) {
      // Player 2 is pushing player 1
      player2.pushingPlayers.add(player1);
    }
    
    // Clamp velocity to prevent excessive push speeds
    this.clampPlayerVelocity(player1);
    this.clampPlayerVelocity(player2);
  }

  /**
   * Constrains a player's position and velocity to stay within level bounds
   * @param player The player to constrain
   */
  private constrainPlayerToBounds(player: Player) {
    const grid = this.levelData.grid;
    const tileSize = this.levelData.tileSize;
    const levelWidth = grid[0].length * tileSize;
    const levelHeight = grid.length * tileSize;
    
    // Calculate level bounds in world coordinates (accounting for player radius)
    const minX = this.levelOffsetX + PLAYER_RADIUS;
    const maxX = this.levelOffsetX + levelWidth - PLAYER_RADIUS;
    const minY = this.levelOffsetY + PLAYER_RADIUS;
    const maxY = this.levelOffsetY + levelHeight - PLAYER_RADIUS;
    
    // Constrain player position and velocity to prevent going out of bounds
    let needsCorrection = false;
    let newX = player.x;
    let newY = player.y;
    
    if (player.x < minX) {
      newX = minX;
      needsCorrection = true;
      player.body.setVelocityX(0);
    } else if (player.x > maxX) {
      newX = maxX;
      needsCorrection = true;
      player.body.setVelocityX(0);
    }
    
    if (player.y < minY) {
      newY = minY;
      needsCorrection = true;
      player.body.setVelocityY(0);
    } else if (player.y > maxY) {
      newY = maxY;
      needsCorrection = true;
      player.body.setVelocityY(0);
    }
    
    if (needsCorrection) {
      player.setPosition(newX, newY);
    }
  }

  /**
   * Sends player data to UIScene for display
   */
  private sendUIUpdate(): void {
    const uiScene = this.scene.get('UIScene');
    if (uiScene && uiScene.scene.isActive()) {
      // Send player data
      uiScene.events.emit('update-players', this.players);
    }
  }

  /**
   * Toggles pause state - launches or stops PauseScene
   */
  private togglePause(): void {
    // Don't pause if game is over or level is complete
    if (this.isGameOver || this.isLevelComplete) {
      return;
    }

    if (this.isPaused) {
      // Unpause - stop PauseScene and resume physics
      this.scene.stop('PauseScene');
      this.resumeGame();
    } else {
      // Pause - stop all movement and launch PauseScene
      this.pauseGame();
      this.scene.launch('PauseScene', {
        levelData: this.levelData,
        playerCount: this.playerCount
      });
    }
  }

  /**
   * Pauses all game systems - stops physics and all movement
   */
  private pauseGame(): void {
    this.isPaused = true;
    
    // Pause Phaser physics world
    this.physics.pause();
    
    // Stop all player velocities
    this.players.forEach(player => {
      if (player.body) {
        player.body.setVelocity(0, 0);
      }
    });
    
    // Stop all robot velocities
    this.robots.forEach(robot => {
      if (robot.body) {
        robot.body.setVelocity(0, 0);
      }
    });
    
    // Stop all weapon velocities (if any have physics bodies)
    this.children.list.forEach(child => {
      if (child instanceof Weapon && (child as any).body) {
        (child as any).body.setVelocity(0, 0);
      }
    });
    
    console.log('⏸️ Game paused - all systems stopped');
  }

  /**
   * Resumes all game systems - resumes physics
   */
  private resumeGame(): void {
    this.isPaused = false;
    
    // Resume Phaser physics world
    this.physics.resume();
    
    console.log('▶️ Game resumed - all systems active');
  }

  /**
   * Triggers game over and transitions to GameOverScene (Phase 5.2)
   * @param reason The reason for game over (e.g., "Baby holder down!")
   */
  private triggerGameOver(reason: string): void {
    if (this.isGameOver) {
      return; // Already triggered, prevent duplicate transitions
    }

    if (!reason || reason.trim().length === 0) {
      console.warn('Game over triggered with empty reason, using default');
      reason = 'Game Over';
    }

    this.isGameOver = true;

    // Prepare game over data
    const gameOverData: GameOverData = {
      reason: reason,
      levelData: this.levelData
    };

    // Transition to GameOverScene
    this.scene.start('GameOverScene', gameOverData);

    if (DEBUG_MODE) {
      console.log(`💀 Game Over triggered: ${reason}`);
    }
  }

  /**
   * Handles overlap between player and exit zone (Phase 5.4)
   * @param playerObj The player that overlapped with exit zone
   * @param exitZoneObj The exit zone rectangle (unused, but required by Phaser overlap callback)
   */
  private handleExitZoneOverlap = (
    playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
    exitZoneObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile
  ): void => {
    if (this.isLevelComplete || this.isGameOver) {
      return; // Already triggered or game over
    }

    if (!(playerObj instanceof Player)) {
      return; // Safety check: ensure it's actually a Player
    }

    const player = playerObj;
    
    // Check if this player is holding the baby
    if (player.heldBaby === this.baby && !player.isDowned) {
      // Baby holder reached exit - level complete!
      this.triggerLevelComplete();
    }
  }

  /**
   * Triggers level complete and transitions to LevelCompleteScene (Phase 5.4)
   */
  private triggerLevelComplete(): void {
    if (this.isLevelComplete) {
      return; // Already triggered
    }

    this.isLevelComplete = true;

    // Prepare level complete data
    // For now, next level is the same level (since we only have one level)
    const levelCompleteData: LevelCompleteData = {
      levelData: this.levelData,
      nextLevelData: this.levelData // Same level for now
    };

    // Transition to LevelCompleteScene
    this.scene.start('LevelCompleteScene', levelCompleteData);

    if (DEBUG_MODE) {
      console.log(`🎉 Level Complete: ${this.levelData.name}`);
    }
  }

  /**
   * Cleans up all entities and resets scene state
   * NOTE: This method is currently unused as Phaser handles cleanup automatically.
   * Kept for reference in case manual cleanup is needed in the future.
   * @deprecated Phaser automatically cleans up scenes on shutdown
   */
  private cleanupScene(): void {
    // Destroy all players
    if (this.players) {
      this.players.forEach(player => {
        if (player && player.active) {
          player.destroy();
        }
      });
    }
    this.players = [];

    // Destroy all robots
    if (this.robots) {
      this.robots.forEach(robot => {
        if (robot && robot.active) {
          robot.destroy();
        }
      });
    }
    this.robots = [];

    // Destroy baby
    if (this.baby && this.baby.active) {
      this.baby.destroy();
    }
    this.baby = undefined as any;

    // Destroy all lanterns
    if (this.lanterns) {
      this.lanterns.forEach(lantern => {
        if (lantern && lantern.active) {
          lantern.destroy(true);
        }
      });
    }
    this.lanterns = [];

    // Destroy all weapons (check all children for Weapon instances)
    // Use a snapshot of the list to avoid modification during iteration
    const childrenSnapshot = [...this.children.list];
    childrenSnapshot.forEach(child => {
      if (child instanceof Weapon && child.active) {
        child.destroy(true);
      }
    });

    // Destroy walls group
    if (this.walls) {
      this.walls.clear(true, true);
    }
    this.walls = undefined as any;

    // Destroy hearts UI
    if (this.heartsUI && this.heartsUI.active) {
      this.heartsUI.destroy(true);
    }
    this.heartsUI = undefined as any;

    // Clear all physics colliders
    if (this.physics && this.physics.world && this.physics.world.colliders) {
      this.physics.world.colliders.destroy();
    }

    // Remove all event listeners
    this.events.removeAllListeners();

    // Reset systems (will be reinitialized in create())
    this.swapSystem = undefined as any;
    this.detectionSystem = undefined as any;
    this.combatSystem = undefined as any;

    // Reset offsets (will be recalculated in renderLevel)
    this.levelOffsetX = 0;
    this.levelOffsetY = 0;

    if (DEBUG_MODE) {
      console.log('🧹 Scene cleaned up - ready for fresh start');
    }
  }
}

