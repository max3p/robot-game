import Phaser from 'phaser';
import { Level1 } from '../levels/Level1';
import { WALL_COLOR, FLOOR_COLOR, EXIT_COLOR, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, PLAYER_RADIUS, MAX_PUSH_VELOCITY, PUSH_VELOCITY_THRESHOLD, SPIDER_SPEED, SPIDER_SIZE, SPIDER_COLOR } from '../config/constants';
import { Player } from '../entities/Player';
import { Baby } from '../entities/Baby';
import { Weapon } from '../entities/Weapon';
import { Robot } from '../entities/Robot';
import { SpiderBot } from '../entities/SpiderBot';
import { ShockBot } from '../entities/ShockBot';
import { FlameBot } from '../entities/FlameBot';
import { SwapSystem } from '../systems/SwapSystem';
import { DetectionSystem } from '../systems/DetectionSystem';
import { RobotSpawn, WeaponType, RobotType } from '../types';

export class GameScene extends Phaser.Scene {
  private levelData = Level1;
  private levelOffsetX = 0;
  private levelOffsetY = 0;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private players: Player[] = [];
  private robots: Robot[] = [];
  private baby!: Baby;
  private swapSystem!: SwapSystem;
  private detectionSystem!: DetectionSystem;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    console.log(`🎮 Level started: ${this.levelData.name} (${this.levelData.grid.length}x${this.levelData.grid[0].length})`);
    
    this.renderLevel();
    this.createWallCollisions();
    this.spawnPlayers();
    this.initializeSwapSystem();
    this.initializeDetectionSystem();
    this.setupStartingLoadout(this.players.length);
    this.spawnRobots(); // Phase 3.7: Robust spawning system
    
    // Set up collisions between players and walls
    this.physics.add.collider(this.players, this.walls, this.handlePlayerWallCollision.bind(this));
    
    // Set up collisions between players (they can push each other)
    this.physics.add.collider(this.players, this.players, this.handlePlayerPlayerCollision.bind(this));
    
    // Set up collisions between robots and walls
    this.physics.add.collider(this.robots, this.walls, this.handleRobotWallCollision.bind(this));
    
    console.log(`✨ Game scene initialized and ready!`);
  }

  update(time: number, delta: number) {
    // Update all players (apply input and movement)
    this.players.forEach(player => {
      player.update();
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
        child.update();
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
   * Spawns all players at the level start position with slight offsets
   */
  private spawnPlayers() {
    const startPos = this.levelData.startPosition;
    const tileSize = this.levelData.tileSize;
    
    // Base position in world coordinates
    const baseX = startPos.x * tileSize + this.levelOffsetX + tileSize / 2;
    const baseY = startPos.y * tileSize + this.levelOffsetY + tileSize / 2;
    
    // Spawn 4 players with slight offsets so they don't overlap
    const offsetDistance = 24; // pixels
    const offsets = [
      { x: -offsetDistance, y: -offsetDistance }, // Player 1: top-left
      { x: offsetDistance, y: -offsetDistance },  // Player 2: top-right
      { x: -offsetDistance, y: offsetDistance },  // Player 3: bottom-left
      { x: offsetDistance, y: offsetDistance }    // Player 4: bottom-right
    ];
    
    // Spawn players based on configuration (currently hardcoded to 4 for Phase 2)
    const playerCount = 4;
    for (let i = 1; i <= playerCount; i++) {
      const offset = offsets[i - 1];
      const player = new Player(this, baseX + offset.x, baseY + offset.y, i);
      this.players.push(player);
    }
    
    console.log(`✅ Players spawned: ${this.players.length} players at position (${baseX.toFixed(0)}, ${baseY.toFixed(0)})`);
  }

  /**
   * Sets up the starting loadout for all players based on player count
   * @param playerCount Number of players (1-4)
   */
  private setupStartingLoadout(playerCount: number) {
    // Phase 2.7: Starting Loadout
    // Player 1 always starts with baby
    this.baby = new Baby(this);
    const player1 = this.players.find(p => p.playerId === 1);
    if (player1) {
      player1.setHeldBaby(this.baby);
      console.log(`📦 Starting loadout: Player 1 received Baby`);
    }

    // Remaining players start with weapons in order: Goo, EMP, Water
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

    // For fewer players: extra weapons spawn on ground near start
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
   * Spawns all robots from level data based on player count
   * Phase 3.7: Robust spawning system
   * Scales robot count based on number of players
   */
  private spawnRobots() {
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
  private handleRobotWallCollision(robotObj: Phaser.GameObjects.GameObject, wallObj: Phaser.GameObjects.GameObject) {
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
  private handlePlayerWallCollision(playerObj: Phaser.GameObjects.GameObject, wallObj: Phaser.GameObjects.GameObject) {
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
  private handlePlayerPlayerCollision(player1Obj: Phaser.GameObjects.GameObject, player2Obj: Phaser.GameObjects.GameObject) {
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
}

