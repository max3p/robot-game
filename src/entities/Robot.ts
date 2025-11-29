import Phaser from 'phaser';
import { RobotType, RobotState, Vector2 } from '../types';
import { TILE_SIZE } from '../config/constants';

export class Robot extends Phaser.GameObjects.Rectangle {
  public body!: Phaser.Physics.Arcade.Body;
  public robotType: RobotType;
  public state: RobotState = RobotState.PATROL;
  public facingDirection: Vector2 = { x: 0, y: -1 }; // Default facing up
  public patrolPath: Vector2[]; // World coordinates
  public currentPatrolIndex: number = 0;
  public alertTarget: Vector2 | null = null;
  public speed: number;
  public size: number;
  public color: number;
  
  // Properties for future phases (not used in Phase 3.1)
  public health: number = 1;
  public lightRadius: number = 0;
  public lightAngle: number = 0;
  public lightColor: number = 0;
  public attackRange: number = 0;
  public attackCooldown: number = 0;
  public attackTimer: number = 0;

  private waypointReachDistance: number = 10; // pixels

  /**
   * Creates a new Robot instance
   * @param scene The Phaser scene this robot belongs to
   * @param robotType Type of robot (SPIDER_BOT, SHOCK_BOT, FLAME_BOT)
   * @param x Initial X position in world coordinates
   * @param y Initial Y position in world coordinates
   * @param patrolPathTileCoords Patrol path in tile coordinates
   * @param levelOffsetX X offset of level in world coordinates
   * @param levelOffsetY Y offset of level in world coordinates
   * @param tileSize Size of each tile in pixels
   * @param speed Movement speed in pixels per second
   * @param size Size of robot rectangle (width and height)
   * @param color Color of robot rectangle
   */
  constructor(
    scene: Phaser.Scene,
    robotType: RobotType,
    x: number,
    y: number,
    patrolPathTileCoords: Vector2[],
    levelOffsetX: number,
    levelOffsetY: number,
    tileSize: number,
    speed: number,
    size: number,
    color: number
  ) {
    super(scene, x, y, size, size, color);
    
    this.robotType = robotType;
    this.speed = speed;
    this.size = size;
    this.color = color;
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Set up physics body
    this.body.setSize(size, size);
    this.body.setCollideWorldBounds(false); // We'll handle bounds manually if needed
    this.body.setImmovable(false);
    
    // Convert patrol path from tile coordinates to world coordinates
    this.patrolPath = patrolPathTileCoords.map(tileCoord => ({
      x: tileCoord.x * tileSize + levelOffsetX + tileSize / 2,
      y: tileCoord.y * tileSize + levelOffsetY + tileSize / 2
    }));
    
    // Set initial position to first waypoint if patrol path exists
    if (this.patrolPath.length > 0) {
      this.setPosition(this.patrolPath[0].x, this.patrolPath[0].y);
    }
    
    // Set depth so robots render above floor but below players
    this.setDepth(10);
  }

  /**
   * Updates the robot's state and movement
   * @param delta Time delta in milliseconds
   */
  update(delta: number) {
    if (this.state === RobotState.PATROL) {
      this.updatePatrol(delta);
    }
    // Other states (ALERT, ATTACKING, etc.) will be implemented in later phases
  }

  /**
   * Updates patrol behavior: follows waypoints in patrol path
   * @param delta Time delta in milliseconds
   */
  private updatePatrol(delta: number) {
    if (this.patrolPath.length === 0) {
      // No patrol path, robot stays still
      this.body.setVelocity(0, 0);
      return;
    }

    const targetWaypoint = this.patrolPath[this.currentPatrolIndex];
    const dx = targetWaypoint.x - this.x;
    const dy = targetWaypoint.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if we've reached the current waypoint
    if (distance < this.waypointReachDistance) {
      // Move to next waypoint (loop back to start)
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPath.length;
    } else {
      // Move toward current waypoint
      const directionX = dx / distance;
      const directionY = dy / distance;
      
      // Set velocity based on speed (Phaser handles delta internally)
      this.body.setVelocity(directionX * this.speed, directionY * this.speed);
      
      // Update facing direction based on movement
      this.facingDirection = { x: directionX, y: directionY };
    }
  }
}

