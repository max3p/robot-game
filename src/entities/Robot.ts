import Phaser from 'phaser';
import { RobotType, RobotState, Vector2 } from '../types';
import { TILE_SIZE, SPIDER_LIGHT_RADIUS, SPIDER_LIGHT_ANGLE, SPIDER_LIGHT_COLOR, SHOCK_LIGHT_RADIUS, SHOCK_LIGHT_ANGLE, SHOCK_LIGHT_COLOR, FLAME_LIGHT_RADIUS, FLAME_LIGHT_ANGLE, FLAME_LIGHT_COLOR, DEBUG_MODE } from '../config/constants';

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
  
  // Visual debug components for detection visualization (only created if DEBUG_MODE is enabled)
  private detectionRadiusCircle?: Phaser.GameObjects.Graphics;
  private detectionCone?: Phaser.GameObjects.Graphics;

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
    
    // Initialize light properties based on robot type (Phase 3.3)
    this.initializeLightProperties();
    
    // Create visual debug components for detection visualization (only if DEBUG_MODE is enabled)
    if (DEBUG_MODE) {
      this.createDetectionVisuals();
    }
  }

  /**
   * Initializes light properties (radius, angle, color) based on robot type
   */
  private initializeLightProperties() {
    switch (this.robotType) {
      case RobotType.SPIDER_BOT:
        this.lightRadius = SPIDER_LIGHT_RADIUS;
        this.lightAngle = SPIDER_LIGHT_ANGLE;
        this.lightColor = SPIDER_LIGHT_COLOR;
        break;
      case RobotType.SHOCK_BOT:
        this.lightRadius = SHOCK_LIGHT_RADIUS;
        this.lightAngle = SHOCK_LIGHT_ANGLE;
        this.lightColor = SHOCK_LIGHT_COLOR;
        break;
      case RobotType.FLAME_BOT:
        this.lightRadius = FLAME_LIGHT_RADIUS;
        this.lightAngle = FLAME_LIGHT_ANGLE;
        this.lightColor = FLAME_LIGHT_COLOR;
        break;
      default:
        // Fallback to spider bot values
        this.lightRadius = SPIDER_LIGHT_RADIUS;
        this.lightAngle = SPIDER_LIGHT_ANGLE;
        this.lightColor = SPIDER_LIGHT_COLOR;
    }
  }

  /**
   * Updates the robot's state and movement
   * @param delta Time delta in milliseconds
   */
  update(delta: number) {
    // For Phase 3.3 testing: robot stands still
    // Movement will be re-enabled in later phases
    this.body.setVelocity(0, 0);
    
    // Update detection visuals to match robot position and facing direction (only if DEBUG_MODE is enabled)
    if (DEBUG_MODE) {
      this.updateDetectionVisuals();
    }
    
    // Original update code (commented out for testing):
    // if (this.state === RobotState.PATROL) {
    //   this.updatePatrol(delta);
    // }
    // Other states (ALERT, ATTACKING, etc.) will be implemented in later phases
  }
  
  /**
   * Creates visual debug components showing detection radius and cone
   */
  private createDetectionVisuals() {
    if (this.lightRadius === 0 || this.lightAngle === 0) {
      return; // Don't create visuals if light properties aren't set
    }
    
    // Create graphics objects for visualization
    this.detectionRadiusCircle = this.scene.add.graphics();
    this.detectionCone = this.scene.add.graphics();
    
    // Set depth so visuals render below robot but above floor
    this.detectionRadiusCircle.setDepth(5);
    this.detectionCone.setDepth(6);
    
    // Set alpha for low opacity - visuals will be semi-transparent
    // Individual fill/stroke alpha values are set in update methods
    
    // Initial render
    this.updateDetectionVisuals();
  }
  
  /**
   * Updates the detection visuals to match robot's current position and facing direction
   */
  private updateDetectionVisuals() {
    if (!this.detectionRadiusCircle || !this.detectionCone || this.lightRadius === 0) {
      return;
    }
    
    // Update detection radius circle
    this.detectionRadiusCircle.clear();
    // Low opacity circle outline showing detection radius
    this.detectionRadiusCircle.lineStyle(2, this.lightColor, 0.3); // 30% opacity outline
    this.detectionRadiusCircle.strokeCircle(this.x, this.y, this.lightRadius);
    
    // Update detection cone
    this.updateDetectionCone();
  }
  
  /**
   * Updates the detection cone visual
   */
  private updateDetectionCone() {
    if (!this.detectionCone || this.lightRadius === 0 || this.lightAngle === 0) {
      return;
    }
    
    this.detectionCone.clear();
    
    // Calculate cone parameters
    const halfAngle = (this.lightAngle * Math.PI / 180) / 2; // Convert to radians and get half
    const facingAngle = Math.atan2(this.facingDirection.y, this.facingDirection.x);
    
    // Calculate cone vertices
    // Center point (robot position)
    const centerX = this.x;
    const centerY = this.y;
    
    // Two edge points at the detection radius
    const leftAngle = facingAngle - halfAngle;
    const rightAngle = facingAngle + halfAngle;
    
    const leftX = centerX + Math.cos(leftAngle) * this.lightRadius;
    const leftY = centerY + Math.sin(leftAngle) * this.lightRadius;
    
    const rightX = centerX + Math.cos(rightAngle) * this.lightRadius;
    const rightY = centerY + Math.sin(rightAngle) * this.lightRadius;
    
    // Draw filled cone triangle (low opacity fill)
    this.detectionCone.fillStyle(this.lightColor, 0.25); // 25% opacity fill
    this.detectionCone.fillTriangle(centerX, centerY, leftX, leftY, rightX, rightY);
    
    // Draw cone outline for better visibility
    this.detectionCone.lineStyle(2, this.lightColor, 0.4); // 40% opacity outline
    this.detectionCone.beginPath();
    this.detectionCone.moveTo(centerX, centerY);
    this.detectionCone.lineTo(leftX, leftY);
    this.detectionCone.moveTo(centerX, centerY);
    this.detectionCone.lineTo(rightX, rightY);
    // Draw arc at the edge
    this.detectionCone.arc(centerX, centerY, this.lightRadius, leftAngle, rightAngle, false);
    this.detectionCone.strokePath();
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

  /**
   * Cleanup method to destroy visual debug components
   */
  destroy() {
    // Clean up detection visuals
    if (this.detectionRadiusCircle) {
      this.detectionRadiusCircle.destroy();
    }
    if (this.detectionCone) {
      this.detectionCone.destroy();
    }
    
    // Call parent destroy
    super.destroy();
  }
}

