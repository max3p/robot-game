import Phaser from 'phaser';
import { Level1 } from '../levels/Level1';
import { WALL_COLOR, FLOOR_COLOR, EXIT_COLOR, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config/constants';
import { Player } from '../entities/Player';
import { Baby } from '../entities/Baby';
import { Weapon } from '../entities/Weapon';
import { SwapSystem } from '../systems/SwapSystem';
import { WeaponType } from '../types';

export class GameScene extends Phaser.Scene {
  private levelData = Level1;
  private levelOffsetX = 0;
  private levelOffsetY = 0;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private players: Player[] = [];
  private baby!: Baby;
  private swapSystem!: SwapSystem;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    console.log(`🎮 Level started: ${this.levelData.name} (${this.levelData.grid.length}x${this.levelData.grid[0].length})`);
    
    this.renderLevel();
    this.createWallCollisions();
    this.spawnPlayers();
    this.initializeSwapSystem();
    this.setupStartingLoadout(4); // Currently hardcoded to 4 players
    
    // Set up collisions between players and walls
    this.physics.add.collider(this.players, this.walls);
    
    // Set up collisions between players (they can push each other)
    this.physics.add.collider(this.players, this.players);
    
    console.log(`✨ Game scene initialized and ready!`);
  }

  update(time: number, delta: number) {
    // Update all players
    this.players.forEach(player => {
      player.update();
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
    
    // Hardcode to 4 players for Phase 2.1
    for (let i = 1; i <= 4; i++) {
      const offset = offsets[i - 1];
      const player = new Player(this, baseX + offset.x, baseY + offset.y, i);
      this.players.push(player);
    }
    
    console.log(`✅ Players spawned: ${this.players.length} players at position (${baseX.toFixed(0)}, ${baseY.toFixed(0)})`);
  }

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
        const weaponType = weaponTypes[i - 2]; // i-2 because Player 1 is index 0 in weapon array
        
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
      
      // Determine which weapons need to spawn on ground
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

      // Spawn weapons on ground within 3 tiles of start position
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

  private generateGroundItemSpawnOffsets(count: number): Array<{ x: number; y: number }> {
    // Generate spawn positions within 3 tiles of start
    const maxOffset = 3 * TILE_SIZE;
    const offsets: Array<{ x: number; y: number }> = [];
    
    // Generate offsets in a circle/spiral pattern around start
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

  private initializeSwapSystem() {
    // Initialize swap system for ground item pickup
    this.swapSystem = new SwapSystem(this);
    this.swapSystem.setPlayers(this.players);
    
    // Currently no ground items, but this will be used when items are dropped or spawned
    // The swap system will track items added via addGroundItem()
  }

  private constrainPlayerToBounds(player: Player) {
    const grid = this.levelData.grid;
    const tileSize = this.levelData.tileSize;
    const levelWidth = grid[0].length * tileSize;
    const levelHeight = grid.length * tileSize;
    
    // Calculate level bounds in world coordinates (accounting for player radius)
    const playerRadius = 16;
    const minX = this.levelOffsetX + playerRadius;
    const maxX = this.levelOffsetX + levelWidth - playerRadius;
    const minY = this.levelOffsetY + playerRadius;
    const maxY = this.levelOffsetY + levelHeight - playerRadius;
    
    // Only constrain if player is outside bounds
    if (player.x < minX || player.x > maxX || 
        player.y < minY || player.y > maxY) {
      const playerX = Phaser.Math.Clamp(player.x, minX, maxX);
      const playerY = Phaser.Math.Clamp(player.y, minY, maxY);
      player.setPosition(playerX, playerY);
      // Stop velocity if hitting bounds
      if (player.x <= minX || player.x >= maxX) {
        player.body.setVelocityX(0);
      }
      if (player.y <= minY || player.y >= maxY) {
        player.body.setVelocityY(0);
      }
    }
  }
}

