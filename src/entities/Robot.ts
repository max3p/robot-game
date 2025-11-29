import Phaser from 'phaser';
import { RobotType, RobotState, Vector2 } from '../types';
import { TILE_SIZE, SPIDER_LIGHT_RADIUS, SPIDER_LIGHT_ANGLE, SPIDER_LIGHT_COLOR, SHOCK_LIGHT_RADIUS, SHOCK_LIGHT_ANGLE, SHOCK_LIGHT_COLOR, FLAME_LIGHT_RADIUS, FLAME_LIGHT_ANGLE, FLAME_LIGHT_COLOR, DEBUG_MODE, ROBOT_ACCELERATION, ROBOT_DECELERATION, ROBOT_CLOSE_RANGE_DETECTION_RADIUS } from '../config/constants';
import { findPath, pathToWorldCoordinates } from '../utils/pathfinding';
import { distance, normalize } from '../utils/geometry';

export class Robot extends Phaser.GameObjects.Rectangle {
  public body!: Phaser.Physics.Arcade.Body;
  public robotType: RobotType;
  public state: RobotState = RobotState.PATROL;
  public facingDirection: Vector2 = { x: 0, y: -1 }; // Default facing up
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

  // Level grid access for random walk AI
  protected levelGrid: number[][] = []; // 0 = floor, 1 = wall
  protected tileSize: number = 0;
  protected levelOffsetX: number = 0;
  protected levelOffsetY: number = 0;
  
  // Random walk AI state
  private currentTargetTile: Vector2 | null = null; // Current target tile in world coordinates
  private tileReachDistance: number = 20; // Distance to consider a tile "reached" in pixels (increased for smoother stopping)
  private tileMemory: Vector2[] = []; // Memory of last 4 tiles visited (tile coordinates, not world coordinates)
  private readonly MAX_TILE_MEMORY = 4; // Maximum number of tiles to remember
  private isRepositioning: boolean = false; // True when robot needs to reposition to tile center after chase
  private repositionTarget: Vector2 | null = null; // Target position for repositioning (center of current tile)
  
  // Pathfinding state for chase AI
  private chasePath: Vector2[] = []; // Current path in world coordinates
  private currentPathIndex: number = 0; // Current waypoint index in chase path
  private pathRecalculationCooldown: number = 0; // Cooldown before recalculating path (ms)
  private readonly PATH_RECALCULATION_COOLDOWN_MS = 500; // Recalculate path at most once per 500ms
  private lastPathTargetTile: Vector2 | null = null; // Last tile we calculated a path to
  
  // Behavior states for patrol AI
  private patrolBehavior: 'MOVING' | 'LOOKING' | 'RESTING' = 'MOVING';
  private behaviorTimer: number = 0;
  private behaviorDuration: number = 0;
  private lookDirection: Vector2 = { x: 0, y: -1 }; // Direction robot is looking when in LOOKING state
  
  // Smooth movement state
  private currentVelocity: Vector2 = { x: 0, y: 0 }; // Current velocity for smooth acceleration
  private targetVelocity: Vector2 = { x: 0, y: 0 }; // Target velocity to accelerate toward
  
  // Behavior states for patrol AI
  private patrolBehavior: 'MOVING' | 'LOOKING' | 'RESTING' = 'MOVING';
  private behaviorTimer: number = 0;
  private behaviorDuration: number = 0;
  private lookDirection: Vector2 = { x: 0, y: -1 }; // Direction robot is looking when in LOOKING state
  
  // Smooth movement state
  private currentVelocity: Vector2 = { x: 0, y: 0 }; // Current velocity for smooth acceleration
  private targetVelocity: Vector2 = { x: 0, y: 0 }; // Target velocity to accelerate toward
  
  // Debug logging state (throttled to avoid spam)
  private lastDebugLogTime: number = 0;
  private debugLogThrottleMs: number = 1000; // Log movement updates at most once per second
  
  // Visual debug components for detection visualization (only created if DEBUG_MODE is enabled)
  private detectionRadiusCircle?: Phaser.GameObjects.Graphics;
  private detectionCone?: Phaser.GameObjects.Graphics;
  private closeRangeDetectionCircle?: Phaser.GameObjects.Graphics;

  /**
   * Creates a new Robot instance
   * @param scene The Phaser scene this robot belongs to
   * @param robotType Type of robot (SPIDER_BOT, SHOCK_BOT, FLAME_BOT)
   * @param x Initial X position in world coordinates
   * @param y Initial Y position in world coordinates
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
    
    // Store level information for random walk AI
    this.tileSize = tileSize;
    this.levelOffsetX = levelOffsetX;
    this.levelOffsetY = levelOffsetY;
    
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
    // Update detection visuals to match robot position and facing direction (only if DEBUG_MODE is enabled)
    if (DEBUG_MODE) {
      this.updateDetectionVisuals();
    }
    
    // Update attack timer
    if (this.attackTimer > 0) {
      this.attackTimer -= delta;
    }
    
    // Update behavior timer
    if (this.behaviorTimer > 0) {
      this.behaviorTimer -= delta;
    }
    
    // Update path recalculation cooldown
    if (this.pathRecalculationCooldown > 0) {
      this.pathRecalculationCooldown -= delta;
    }
    
    // State-based behavior is handled by subclasses
    // Base class only handles patrol for generic robots
    if (this.state === RobotState.PATROL) {
      // If repositioning, handle that first
      if (this.isRepositioning) {
        this.updateRepositioning(delta);
      } else {
        // Normal patrol behavior
        this.updateRandomWalk(delta);
      }
      // Apply smooth movement with acceleration/deceleration only during patrol
      this.applySmoothMovement(delta);
    }
    // Note: For ALERT and ATTACKING states, subclasses (like SpiderBot) directly set velocity
  }
  
  /**
   * Sets the level grid for random walk AI
   * Must be called after robot creation to enable random walk behavior
   */
  setLevelGrid(grid: number[][]) {
    this.levelGrid = grid;
    // Initialize tile memory with starting position
    const currentTile = this.worldToTileCoordinates(this.x, this.y);
    this.tileMemory = [{ x: currentTile.x, y: currentTile.y }];
    if (DEBUG_MODE) {
      console.log(`[Robot ${this.robotType}] Level grid set. Starting at tile (${currentTile.x},${currentTile.y})`);
    }
  }
  
  /**
   * Method to be overridden by subclasses for alert behavior
   * @param delta Time delta in milliseconds
   * @param players Array of players in the scene
   */
  updateAlert(delta: number, players: any[]): void {
    // Base implementation - to be overridden by subclasses
  }
  
  /**
   * Method to be overridden by subclasses for attack behavior
   * @param delta Time delta in milliseconds
   * @param players Array of players in the scene
   */
  updateAttacking(delta: number, players: any[]): void {
    // Base implementation - to be overridden by subclasses
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
    this.closeRangeDetectionCircle = this.scene.add.graphics();
    
    // Set depth so visuals render below robot but above floor
    this.detectionRadiusCircle.setDepth(5);
    this.detectionCone.setDepth(6);
    this.closeRangeDetectionCircle.setDepth(4); // Below vision radius circle
    
    // Set alpha for low opacity - visuals will be semi-transparent
    // Individual fill/stroke alpha values are set in update methods
    
    // Initial render
    this.updateDetectionVisuals();
  }
  
  /**
   * Updates the detection visuals to match robot's current position and facing direction
   */
  private updateDetectionVisuals() {
    if (!this.detectionRadiusCircle || !this.detectionCone || !this.closeRangeDetectionCircle || this.lightRadius === 0) {
      return;
    }
    
    // Update close-range detection circle (always visible, smaller radius)
    this.closeRangeDetectionCircle.clear();
    // Low opacity circle showing close-range detection radius
    this.closeRangeDetectionCircle.lineStyle(2, this.lightColor, 0.4); // 40% opacity outline
    this.closeRangeDetectionCircle.strokeCircle(this.x, this.y, ROBOT_CLOSE_RANGE_DETECTION_RADIUS);
    // Fill with very low opacity
    this.closeRangeDetectionCircle.fillStyle(this.lightColor, 0.1); // 10% opacity fill
    this.closeRangeDetectionCircle.fillCircle(this.x, this.y, ROBOT_CLOSE_RANGE_DETECTION_RADIUS);
    
    // Update detection radius circle (vision cone radius)
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
   * Starts repositioning phase - moves robot to center of current tile
   * Called after returning to patrol from chase to ensure proper tile alignment
   */
  protected startRepositioning(): void {
    const currentTile = this.worldToTileCoordinates(this.x, this.y);
    this.repositionTarget = this.tileToWorldCoordinates(currentTile.x, currentTile.y);
    this.isRepositioning = true;
    this.currentTargetTile = null; // Clear any existing target
    this.patrolBehavior = 'MOVING'; // Force moving behavior during reposition
    
    if (DEBUG_MODE) {
      console.log(`[Robot ${this.robotType}] Starting repositioning to tile center (${currentTile.x},${currentTile.y})`);
    }
  }
  
  /**
   * Updates repositioning behavior - moves robot to center of current tile
   * @param delta Time delta in milliseconds
   */
  private updateRepositioning(delta: number): void {
    if (!this.repositionTarget) {
      // No target, shouldn't happen but reset state
      this.isRepositioning = false;
      return;
    }
    
    // Calculate distance to reposition target (tile center)
    const dx = this.repositionTarget.x - this.x;
    const dy = this.repositionTarget.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= this.tileReachDistance) {
      // Reached tile center - snap to exact position and exit repositioning
      this.setPosition(this.repositionTarget.x, this.repositionTarget.y);
      this.isRepositioning = false;
      this.repositionTarget = null;
      this.targetVelocity = { x: 0, y: 0 };
      this.body.setVelocity(0, 0);
      
      // Update current tile in memory
      const currentTile = this.worldToTileCoordinates(this.x, this.y);
      this.addTileToMemory(currentTile);
      
      if (DEBUG_MODE) {
        console.log(`[Robot ${this.robotType}] Repositioning complete. Resuming normal patrol.`);
      }
    } else {
      // Move toward tile center
      const directionX = dx / distance;
      const directionY = dy / distance;
      
      this.targetVelocity = {
        x: directionX * this.speed,
        y: directionY * this.speed
      };
      
      this.facingDirection = { x: directionX, y: directionY };
    }
  }
  
  /**
   * Updates random walk behavior with advanced behaviors (moving, looking, resting)
   * @param delta Time delta in milliseconds
   */
  private updateRandomWalk(delta: number) {
    // If no level grid is set, robot stays still
    if (this.levelGrid.length === 0) {
      this.targetVelocity = { x: 0, y: 0 };
      return;
    }
    
    // Convert current world position to tile coordinates
    const currentTile = this.worldToTileCoordinates(this.x, this.y);
    
    // Check if behavior timer has expired, select new behavior
    if (this.behaviorTimer <= 0) {
      this.selectNewBehavior(currentTile);
    }
    
    // Update current behavior
    switch (this.patrolBehavior) {
      case 'MOVING':
        this.updateMovingBehavior(delta, currentTile);
        break;
      case 'LOOKING':
        this.updateLookingBehavior(delta);
        break;
      case 'RESTING':
        this.updateRestingBehavior(delta);
        break;
    }
  }
  
  /**
   * Randomly selects a new behavior (MOVING, LOOKING, or RESTING)
   */
  private selectNewBehavior(currentTile: Vector2): void {
    const behaviors: Array<'MOVING' | 'LOOKING' | 'RESTING'> = ['MOVING', 'LOOKING', 'RESTING'];
    const weights = [0.6, 0.2, 0.2]; // 60% moving, 20% looking, 20% resting
    
    // Weighted random selection
    const random = Math.random();
    let cumulativeWeight = 0;
    let selectedBehavior: 'MOVING' | 'LOOKING' | 'RESTING' = 'MOVING';
    
    for (let i = 0; i < behaviors.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        selectedBehavior = behaviors[i];
        break;
      }
    }
    
    this.patrolBehavior = selectedBehavior;
    
    // Set behavior duration (random)
    switch (selectedBehavior) {
      case 'MOVING':
        // Moving: 2-5 seconds
        this.behaviorDuration = 2000 + Math.random() * 3000;
        // Select a target tile to move to
        if (!this.currentTargetTile) {
          this.selectRandomNeighborTile(currentTile);
        }
        break;
      case 'LOOKING':
        // Looking: 1-3 seconds
        this.behaviorDuration = 1000 + Math.random() * 2000;
        // Pick a random direction to look
        const lookAngle = Math.random() * Math.PI * 2;
        this.lookDirection = { x: Math.cos(lookAngle), y: Math.sin(lookAngle) };
        this.currentTargetTile = null;
        this.targetVelocity = { x: 0, y: 0 };
        break;
      case 'RESTING':
        // Resting: 1-2.5 seconds
        this.behaviorDuration = 1000 + Math.random() * 1500;
        this.currentTargetTile = null;
        this.targetVelocity = { x: 0, y: 0 };
        break;
    }
    
    this.behaviorTimer = this.behaviorDuration;
    
    if (DEBUG_MODE && this.shouldLogDebug()) {
      console.log(`[Robot ${this.robotType}] New behavior: ${selectedBehavior} (${(this.behaviorDuration / 1000).toFixed(1)}s)`);
    }
  }
  
  /**
   * Updates MOVING behavior: moves toward target tile
   */
  private updateMovingBehavior(delta: number, currentTile: Vector2): void {
    if (!this.currentTargetTile) {
      // No target, select one
      this.selectRandomNeighborTile(currentTile);
      if (!this.currentTargetTile) {
        // No valid neighbors, switch to resting
        this.patrolBehavior = 'RESTING';
        this.behaviorTimer = 1000;
        this.targetVelocity = { x: 0, y: 0 };
        return;
      }
      
      if (DEBUG_MODE && this.shouldLogDebug()) {
        const newTile = this.worldToTileCoordinates(this.currentTargetTile.x, this.currentTargetTile.y);
        console.log(`[Robot ${this.robotType}] Moving: Tile (${currentTile.x},${currentTile.y}) → (${newTile.x},${newTile.y})`);
      }
    }
    
    // Check if we've reached the target tile
    if (this.currentTargetTile) {
      const dx = this.currentTargetTile.x - this.x;
      const dy = this.currentTargetTile.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= this.tileReachDistance) {
        // Reached target - add to memory and clear it (will select new one next frame if still in MOVING behavior)
        const reachedTile = this.worldToTileCoordinates(this.x, this.y);
        this.addTileToMemory(reachedTile);
        this.currentTargetTile = null;
        
        if (DEBUG_MODE && this.shouldLogDebug()) {
          console.log(`[Robot ${this.robotType}] Reached tile (${reachedTile.x},${reachedTile.y})`);
        }
      } else {
        // Calculate direction and set target velocity for smooth movement
        const directionX = dx / distance;
        const directionY = dy / distance;
        
        this.targetVelocity = {
          x: directionX * this.speed,
          y: directionY * this.speed
        };
        
        // Update facing direction
        this.facingDirection = { x: directionX, y: directionY };
      }
    }
  }
  
  /**
   * Updates LOOKING behavior: robot turns to look in a direction
   */
  private updateLookingBehavior(delta: number): void {
    // Gradually turn toward look direction
    const currentAngle = Math.atan2(this.facingDirection.y, this.facingDirection.x);
    const targetAngle = Math.atan2(this.lookDirection.y, this.lookDirection.x);
    
    // Smooth rotation toward target angle
    let angleDiff = targetAngle - currentAngle;
    // Normalize angle difference to -PI to PI
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Rotate at a reasonable speed (radians per second)
    const rotationSpeed = 2.0; // radians per second
    const maxRotation = rotationSpeed * (delta / 1000);
    
    if (Math.abs(angleDiff) < maxRotation) {
      this.facingDirection = this.lookDirection;
    } else {
      const rotation = Math.sign(angleDiff) * maxRotation;
      const newAngle = currentAngle + rotation;
      this.facingDirection = {
        x: Math.cos(newAngle),
        y: Math.sin(newAngle)
      };
    }
    
    this.targetVelocity = { x: 0, y: 0 };
  }
  
  /**
   * Updates RESTING behavior: robot stands still
   */
  private updateRestingBehavior(delta: number): void {
    this.targetVelocity = { x: 0, y: 0 };
  }
  
  /**
   * Applies smooth movement with acceleration and deceleration
   */
  private applySmoothMovement(delta: number): void {
    const deltaSeconds = delta / 1000;
    
    // Calculate velocity difference
    const velDiffX = this.targetVelocity.x - this.currentVelocity.x;
    const velDiffY = this.targetVelocity.y - this.currentVelocity.y;
    const velDiffMagnitude = Math.sqrt(velDiffX * velDiffX + velDiffY * velDiffY);
    
    if (velDiffMagnitude < 1) {
      // Very close to target velocity, snap to it
      this.currentVelocity = { ...this.targetVelocity };
    } else {
      // Determine if we're accelerating or decelerating
      const isAccelerating = 
        (this.targetVelocity.x !== 0 || this.targetVelocity.y !== 0) &&
        Math.abs(velDiffMagnitude) > 0;
      
      const acceleration = isAccelerating ? ROBOT_ACCELERATION : ROBOT_DECELERATION;
      const maxChange = acceleration * deltaSeconds;
      
      // Normalize velocity difference
      const normalizedX = velDiffX / velDiffMagnitude;
      const normalizedY = velDiffY / velDiffMagnitude;
      
      // Apply acceleration/deceleration
      const changeX = Math.min(Math.abs(velDiffX), maxChange) * Math.sign(velDiffX);
      const changeY = Math.min(Math.abs(velDiffY), maxChange) * Math.sign(velDiffY);
      
      this.currentVelocity.x += changeX;
      this.currentVelocity.y += changeY;
    }
    
    // Apply velocity to physics body
    this.body.setVelocity(this.currentVelocity.x, this.currentVelocity.y);
  }
  
  /**
   * Converts world coordinates to tile coordinates
   */
  private worldToTileCoordinates(worldX: number, worldY: number): Vector2 {
    const tileX = Math.floor((worldX - this.levelOffsetX) / this.tileSize);
    const tileY = Math.floor((worldY - this.levelOffsetY) / this.tileSize);
    return { x: tileX, y: tileY };
  }
  
  /**
   * Converts tile coordinates to world coordinates (center of tile)
   */
  private tileToWorldCoordinates(tileX: number, tileY: number): Vector2 {
    const worldX = tileX * this.tileSize + this.levelOffsetX + this.tileSize / 2;
    const worldY = tileY * this.tileSize + this.levelOffsetY + this.tileSize / 2;
    return { x: worldX, y: worldY };
  }
  
  /**
   * Checks if a tile coordinate is a valid floor tile (not a wall and within bounds)
   */
  private isValidFloorTile(tileX: number, tileY: number): boolean {
    // Check bounds
    if (tileY < 0 || tileY >= this.levelGrid.length || 
        tileX < 0 || tileX >= this.levelGrid[0].length) {
      return false;
    }
    
    // Check if it's a floor tile (0 = floor, 1 = wall)
    return this.levelGrid[tileY][tileX] === 0;
  }
  
  /**
   * Adds a tile to memory (tracking last visited tiles)
   * @param tile Tile coordinates to add to memory
   */
  private addTileToMemory(tile: Vector2): void {
    // Remove the tile if it's already in memory (to avoid duplicates)
    this.tileMemory = this.tileMemory.filter(
      t => !(t.x === tile.x && t.y === tile.y)
    );
    
    // Add to beginning of array
    this.tileMemory.unshift({ x: tile.x, y: tile.y });
    
    // Keep only the last MAX_TILE_MEMORY tiles
    if (this.tileMemory.length > this.MAX_TILE_MEMORY) {
      this.tileMemory = this.tileMemory.slice(0, this.MAX_TILE_MEMORY);
    }
  }
  
  /**
   * Checks if a tile is in memory (recently visited)
   * @param tile Tile coordinates to check
   * @returns True if tile is in memory, false otherwise
   */
  private isTileInMemory(tile: Vector2): boolean {
    return this.tileMemory.some(t => t.x === tile.x && t.y === tile.y);
  }
  
  /**
   * Gets the visit weight for a tile (higher for unvisited, lower for recently visited)
   * @param tile Tile coordinates to get weight for
   * @returns Weight value (higher = more likely to be selected)
   */
  private getTileWeight(tile: Vector2): number {
    if (!this.isTileInMemory(tile)) {
      // Unvisited tile - highest weight
      return 5.0;
    } else {
      // Visited tile - lower weight based on recency (most recent = lowest)
      const memoryIndex = this.tileMemory.findIndex(t => t.x === tile.x && t.y === tile.y);
      if (memoryIndex === -1) {
        return 5.0; // Shouldn't happen, but default to high weight
      }
      // Most recent (index 0) = weight 0.5, older tiles get progressively higher
      return 0.5 + (memoryIndex * 0.5);
    }
  }
  
  /**
   * Selects a random neighboring floor tile to move to using weighted selection
   * to avoid revisiting recently visited tiles
   * @param currentTile Current tile position
   */
  private selectRandomNeighborTile(currentTile: Vector2): void {
    // Define neighbors: up, down, left, right (4 directions)
    const neighbors: Vector2[] = [
      { x: currentTile.x, y: currentTile.y - 1 }, // Up
      { x: currentTile.x, y: currentTile.y + 1 }, // Down
      { x: currentTile.x - 1, y: currentTile.y }, // Left
      { x: currentTile.x + 1, y: currentTile.y }  // Right
    ];
    
    // Filter to only valid floor tiles
    const validNeighbors = neighbors.filter(neighbor => 
      this.isValidFloorTile(neighbor.x, neighbor.y)
    );
    
    // If we have valid neighbors, use weighted random selection
    if (validNeighbors.length > 0) {
      // Calculate weights for each neighbor
      const weights: number[] = validNeighbors.map(tile => this.getTileWeight(tile));
      
      // Calculate total weight
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      
      // Select random value from 0 to totalWeight
      let randomValue = Math.random() * totalWeight;
      
      // Find which tile corresponds to the random value
      let selectedTile: Vector2 = validNeighbors[0]; // Default to first
      for (let i = 0; i < validNeighbors.length; i++) {
        randomValue -= weights[i];
        if (randomValue <= 0) {
          selectedTile = validNeighbors[i];
          break;
        }
      }
      
      // Convert to world coordinates and set as target
      this.currentTargetTile = this.tileToWorldCoordinates(selectedTile.x, selectedTile.y);
    } else {
      // No valid neighbors, stay in place
      this.currentTargetTile = null;
    }
  }

  /**
   * Helper to throttle debug logging to avoid spam
   */
  private shouldLogDebug(): boolean {
    const now = Date.now();
    if (now - this.lastDebugLogTime > this.debugLogThrottleMs) {
      this.lastDebugLogTime = now;
      return true;
    }
    return false;
  }

  /**
   * Calculates a path from robot's current position to target position using A* pathfinding
   * @param targetWorldPos Target position in world coordinates
   * @returns true if path was found, false otherwise
   */
  protected calculatePathToTarget(targetWorldPos: Vector2): boolean {
    // Convert positions to tile coordinates
    const robotTile = this.worldToTileCoordinates(this.x, this.y);
    const targetTile = this.worldToTileCoordinates(targetWorldPos.x, targetWorldPos.y);

    // Check if we need to recalculate (target tile changed or cooldown expired)
    const targetTileChanged = !this.lastPathTargetTile || 
      this.lastPathTargetTile.x !== targetTile.x || 
      this.lastPathTargetTile.y !== targetTile.y;

    // Recalculate path if target changed, path is empty, or cooldown expired
    if (this.chasePath.length === 0 || (targetTileChanged && this.pathRecalculationCooldown <= 0)) {
      // Find path using A* algorithm
      const tilePath = findPath(this.levelGrid, robotTile, targetTile);

      if (tilePath.length === 0) {
        // No path found - might be unreachable or same tile
        this.chasePath = [];
        this.currentPathIndex = 0;
        this.lastPathTargetTile = targetTile;
        return false;
      }

      // Convert path to world coordinates
      this.chasePath = pathToWorldCoordinates(
        tilePath,
        this.tileSize,
        this.levelOffsetX,
        this.levelOffsetY
      );
      
      // Reset path index
      this.currentPathIndex = 0;
      this.lastPathTargetTile = targetTile;
      this.pathRecalculationCooldown = this.PATH_RECALCULATION_COOLDOWN_MS;

      if (DEBUG_MODE && this.shouldLogDebug()) {
        console.log(`[Robot ${this.robotType}] Calculated path with ${this.chasePath.length} waypoints to tile (${targetTile.x}, ${targetTile.y})`);
      }

      return true;
    }

    return this.chasePath.length > 0;
  }

  /**
   * Follows the current chase path, moving toward the next waypoint
   * @param delta Time delta in milliseconds
   * @param chaseSpeed Speed to move at (pixels per second)
   * @returns true if moving along path, false if path is complete or invalid
   */
  protected followPath(delta: number, chaseSpeed: number): boolean {
    // If no path, can't follow
    if (this.chasePath.length === 0) {
      return false;
    }

    // Get current waypoint
    const currentWaypoint = this.chasePath[this.currentPathIndex];
    const distanceToWaypoint = distance({ x: this.x, y: this.y }, currentWaypoint);

    // Check if we've reached the current waypoint
    if (distanceToWaypoint <= this.tileReachDistance) {
      // Move to next waypoint
      this.currentPathIndex++;

      // Check if path is complete
      if (this.currentPathIndex >= this.chasePath.length) {
        // Path complete
        this.chasePath = [];
        this.currentPathIndex = 0;
        return false;
      }
    }

    // Move toward current waypoint
    const direction: Vector2 = {
      x: this.chasePath[this.currentPathIndex].x - this.x,
      y: this.chasePath[this.currentPathIndex].y - this.y
    };

    const normalized = normalize(direction);
    this.body.setVelocity(normalized.x * chaseSpeed, normalized.y * chaseSpeed);
    this.facingDirection = normalized;

    return true;
  }

  /**
   * Clears the current chase path (used when returning to patrol or target changes)
   */
  protected clearChasePath(): void {
    this.chasePath = [];
    this.currentPathIndex = 0;
    this.lastPathTargetTile = null;
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
    if (this.closeRangeDetectionCircle) {
      this.closeRangeDetectionCircle.destroy();
    }
    
    // Call parent destroy
    super.destroy();
  }
}

