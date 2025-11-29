import Phaser from 'phaser';
import { Level1 } from '../levels/Level1';
import { WALL_COLOR, FLOOR_COLOR, EXIT_COLOR, GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { Player } from '../entities/Player';
import { Baby } from '../entities/Baby';

export class GameScene extends Phaser.Scene {
  private levelData = Level1;
  private levelOffsetX = 0;
  private levelOffsetY = 0;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private players: Player[] = [];
  private baby!: Baby;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.renderLevel();
    this.createWallCollisions();
    this.spawnPlayers();
    this.createBaby();
    
    // Set up collisions between players and walls
    this.physics.add.collider(this.players, this.walls);
    
    // Set up collisions between players (they can push each other)
    this.physics.add.collider(this.players, this.players);
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
    const offsetDistance = 20; // pixels
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
  }

  private createBaby() {
    // Create baby and give it to Player 1 (Phase 2.3: Baby Implementation)
    this.baby = new Baby(this);
    const player1 = this.players.find(p => p.playerId === 1);
    if (player1) {
      player1.setHeldBaby(this.baby);
    }
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

