import Phaser from 'phaser';
import { Level1 } from '../levels/Level1';
import { WALL_COLOR, FLOOR_COLOR, EXIT_COLOR, GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { Player } from '../entities/Player';

export class GameScene extends Phaser.Scene {
  private levelData = Level1;
  private levelOffsetX = 0;
  private levelOffsetY = 0;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private player!: Player;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.renderLevel();
    this.createWallCollisions();
    this.spawnPlayer();
    
    // Set up collision between player and walls
    this.physics.add.collider(this.player, this.walls);
  }

  update() {
    if (this.player) {
      this.player.update();
      this.constrainPlayerToBounds();
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

  private spawnPlayer() {
    const startPos = this.levelData.startPosition;
    const tileSize = this.levelData.tileSize;
    
    // Convert tile coordinates to world coordinates
    const worldX = startPos.x * tileSize + this.levelOffsetX + tileSize / 2;
    const worldY = startPos.y * tileSize + this.levelOffsetY + tileSize / 2;
    
    this.player = new Player(this, worldX, worldY);
  }

  private constrainPlayerToBounds() {
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
    if (this.player.x < minX || this.player.x > maxX || 
        this.player.y < minY || this.player.y > maxY) {
      const playerX = Phaser.Math.Clamp(this.player.x, minX, maxX);
      const playerY = Phaser.Math.Clamp(this.player.y, minY, maxY);
      this.player.setPosition(playerX, playerY);
      // Stop velocity if hitting bounds
      if (this.player.x <= minX || this.player.x >= maxX) {
        this.player.body.setVelocityX(0);
      }
      if (this.player.y <= minY || this.player.y >= maxY) {
        this.player.body.setVelocityY(0);
      }
    }
  }
}

