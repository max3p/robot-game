import { Robot } from './Robot';
import { Player } from './Player';
import { RobotType, RobotState, Vector2 } from '../types';
import { FLAME_SPEED, FLAME_SIZE, FLAME_COLOR, FLAME_ATTACK_RANGE, FLAME_ATTACK_COOLDOWN, FLAME_ATTACK_DAMAGE, FLAME_ATTACK_CONE_ANGLE, FLAME_ATTACK_CONE_LENGTH, FLAME_EXPAND_DURATION, FLAME_DAMAGE_INTERVAL, FLAME_CHASE_SPEED_MULTIPLIER, BASE_PLAYER_SPEED, ROBOT_CHASE_ABANDON_DISTANCE, DEBUG_MODE } from '../config/constants';
import { distance, normalize, isPointInCone } from '../utils/geometry';
import Phaser from 'phaser';

/**
 * FlameBot - Slow ranged robot with red light and continuous flame attack
 * Extends Robot base class with flame-bot specific behaviors
 */
export class FlameBot extends Robot {
  private attackTargetPlayer: Player | null = null;
  
  // Visual components for flame attack
  private flameVisual?: Phaser.GameObjects.Graphics;
  
  // Expanding flame state
  private flameExpandTimer: number = 0;
  private isFlameExpanding: boolean = false;
  
  // Track last damage time for each player (for continuous damage)
  private playerLastDamageTime: Map<Player, number> = new Map();

  /**
   * Creates a new FlameBot instance
   * @param scene The Phaser scene this robot belongs to
   * @param x Initial X position in world coordinates
   * @param y Initial Y position in world coordinates
   * @param levelOffsetX X offset of level in world coordinates
   * @param levelOffsetY Y offset of level in world coordinates
   * @param tileSize Size of each tile in pixels
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    levelOffsetX: number,
    levelOffsetY: number,
    tileSize: number
  ) {
    super(
      scene,
      RobotType.FLAME_BOT,
      x,
      y,
      levelOffsetX,
      levelOffsetY,
      tileSize,
      FLAME_SPEED,
      FLAME_SIZE,
      FLAME_COLOR
    );

    // Set flame-bot specific properties
    this.attackRange = FLAME_ATTACK_RANGE;
    this.attackCooldown = FLAME_ATTACK_COOLDOWN;
    this.attackTimer = 0;
  }

  /**
   * Updates the flame-bot's state and behavior
   * Overrides base Robot.update() to add player targeting
   * @param delta Time delta in milliseconds
   * @param players Optional array of players in the scene (required for ALERT/ATTACKING states)
   */
  update(delta: number, players?: Player[]): void {
    // Update flame expansion timer
    if (this.flameExpandTimer > 0) {
      this.flameExpandTimer -= delta;
    }

    // Call parent update for basic behavior (patrol, visuals, attack timer)
    super.update(delta);

    // Handle state-specific behavior (requires players array)
    if (players) {
      if (this.state === RobotState.ALERT) {
        this.updateAlert(delta, players);
      } else if (this.state === RobotState.ATTACKING) {
        this.updateAttacking(delta, players);
      }
    }

    // Update visuals
    this.updateFlameVisual();
  }

  /**
   * Updates alert behavior: chase the detected player
   * @param delta Time delta in milliseconds
   * @param players Array of players in the scene
   */
  updateAlert(delta: number, players: Player[]): void {
    if (!this.alertTarget) {
      // No target, return to patrol
      this.state = RobotState.PATROL;
      this.body.setVelocity(0, 0);
      this.startRepositioning();
      return;
    }

    // Find the target player
    let targetPlayer: Player | null = null;
    let minDistance = Infinity;

    for (const player of players) {
      const dist = distance({ x: this.x, y: this.y }, { x: player.x, y: player.y });
      if (dist < minDistance) {
        minDistance = dist;
        targetPlayer = player;
      }
    }

    if (!targetPlayer) {
      // Target lost, return to patrol
      this.state = RobotState.PATROL;
      this.alertTarget = null;
      this.body.setVelocity(0, 0);
      this.startRepositioning();
      return;
    }

    // Update alert target to current player position
    this.alertTarget = { x: targetPlayer.x, y: targetPlayer.y };

    // Check distance to target
    const distanceToTarget = distance({ x: this.x, y: this.y }, this.alertTarget);
    
    // Check if player is too far away - give up chase and return to patrol
    if (distanceToTarget >= ROBOT_CHASE_ABANDON_DISTANCE) {
      if (DEBUG_MODE) {
        console.log(`[Robot ${this.robotType}] Player too far (${(distanceToTarget / 96).toFixed(1)} tiles), returning to patrol`);
      }
      this.state = RobotState.PATROL;
      this.alertTarget = null;
      this.body.setVelocity(0, 0);
      this.startRepositioning();
      return;
    }
    
    // Check if in attack range
    if (distanceToTarget <= this.attackRange) {
      // In attack range - enter attacking state
      this.state = RobotState.ATTACKING;
      this.attackTargetPlayer = targetPlayer;
      this.body.setVelocity(0, 0); // Stop moving to attack
    } else {
      // Chase the target
      const direction: Vector2 = {
        x: this.alertTarget.x - this.x,
        y: this.alertTarget.y - this.y
      };
      
      const normalized = normalize(direction);
      // Chase speed: slower than player (60% of player base speed = 120 pixels/sec for easier evasion)
      const chaseSpeed = BASE_PLAYER_SPEED * FLAME_CHASE_SPEED_MULTIPLIER;
      
      // Move toward target directly (alert state bypasses smooth movement for responsive chasing)
      this.body.setVelocity(normalized.x * chaseSpeed, normalized.y * chaseSpeed);
      
      // Update facing direction
      this.facingDirection = normalized;
    }
  }

  /**
   * Updates attacking behavior: continuous flame stream attack
   * @param delta Time delta in milliseconds
   * @param players Array of players in the scene
   */
  updateAttacking(delta: number, players: Player[]): void {
    if (!this.attackTargetPlayer || !this.alertTarget) {
      // Target lost, return to alert state
      this.state = RobotState.ALERT;
      this.attackTargetPlayer = null;
      this.playerLastDamageTime.clear();
      this.isFlameExpanding = false;
      this.flameExpandTimer = 0;
      this.clearFlameVisual();
      return;
    }

    // Check if still in range
    const distanceToTarget = distance({ x: this.x, y: this.y }, { x: this.attackTargetPlayer.x, y: this.attackTargetPlayer.y });
    
    if (distanceToTarget > this.attackRange) {
      // Out of range, resume chase
      this.state = RobotState.ALERT;
      this.attackTargetPlayer = null;
      this.playerLastDamageTime.clear();
      this.isFlameExpanding = false;
      this.flameExpandTimer = 0;
      this.clearFlameVisual();
      return;
    }

    // Face the target
    const direction: Vector2 = {
      x: this.attackTargetPlayer.x - this.x,
      y: this.attackTargetPlayer.y - this.y
    };
    this.facingDirection = normalize(direction);

    // Stop moving while attacking
    this.body.setVelocity(0, 0);

    // Start flame expansion when attack begins
    if (this.attackTimer <= 0 && !this.isFlameExpanding) {
      // Start new attack - begin expanding flame
      this.isFlameExpanding = true;
      this.flameExpandTimer = FLAME_EXPAND_DURATION;
      this.attackTimer = this.attackCooldown;
      this.playerLastDamageTime.clear(); // Reset damage tracking for new attack
    }

    // Continuous flame attack - check for players in expanding/flaming cone
    // Flame continues to damage while expanding and after expansion completes (until cooldown expires)
    if (this.attackTimer > 0) {
      this.checkFlameHits(players);
    }
    
    // If cooldown expired, stop flaming (can start new attack next cycle)
    if (this.attackTimer <= 0) {
      this.isFlameExpanding = false;
      this.flameExpandTimer = 0;
    }
  }

  /**
   * Checks for player collisions with the expanding flame cone and deals continuous damage
   * @param players Array of players to check
   */
  private checkFlameHits(players: Player[]): void {
    const coneAngleRad = (FLAME_ATTACK_CONE_ANGLE * Math.PI) / 180; // Convert to radians
    
    // Calculate current flame expansion progress (0 to 1)
    // If timer expired, flame is at full size (progress = 1)
    const expandProgress = this.flameExpandTimer > 0 
      ? 1 - (this.flameExpandTimer / FLAME_EXPAND_DURATION)
      : 1.0;
    const currentFlameLength = expandProgress * FLAME_ATTACK_CONE_LENGTH;
    
    // Get current time for damage interval checking
    const currentTime = Date.now();
    
    for (const player of players) {
      // Check if player is in the current expanding flame cone
      if (isPointInCone(
        { x: this.x, y: this.y },
        this.facingDirection,
        coneAngleRad,
        currentFlameLength,
        { x: player.x, y: player.y }
      )) {
        // Player is in flame cone - check if it's time to deal damage
        const lastDamageTime = this.playerLastDamageTime.get(player) || 0;
        const timeSinceLastDamage = currentTime - lastDamageTime;
        
        if (timeSinceLastDamage >= FLAME_DAMAGE_INTERVAL) {
          // Time to deal damage (every second)
          if (DEBUG_MODE) {
            console.log(`🔥 Flame-bot continuously hits player ${player.playerId}!`);
          }
          
          // Update last damage time
          this.playerLastDamageTime.set(player, currentTime);
          
          // TODO (Phase 4): Deal damage to player
          // - Deal FLAME_ATTACK_DAMAGE to player
          // - Apply invincibility period
          // - Trigger baby cry if player is baby holder
        }
      } else {
        // Player left the flame cone - remove from damage tracking
        this.playerLastDamageTime.delete(player);
      }
    }
  }

  /**
   * Creates flame visual (orange/red triangle cone)
   */
  private createFlameVisual(): void {
    if (!this.flameVisual) {
      this.flameVisual = this.scene.add.graphics();
      this.flameVisual.setDepth(14); // Below players
    }
  }

  /**
   * Updates flame attack visual (expanding orange/red triangle cone)
   */
  private updateFlameVisual(): void {
    // Show flame visual while expanding OR while flame is active (even after expansion completes)
    const isFlameActive = this.isFlameExpanding || (this.flameExpandTimer <= 0 && this.attackTimer > 0);
    
    if (this.state === RobotState.ATTACKING && this.attackTargetPlayer && isFlameActive) {
      if (!this.flameVisual) {
        this.createFlameVisual();
      }
      
      this.drawFlameCone();
    } else {
      this.clearFlameVisual();
    }
  }

  /**
   * Draws the expanding flame cone visual (triangle pointing in facing direction)
   */
  private drawFlameCone(): void {
    if (!this.flameVisual) return;

    this.flameVisual.clear();

    // Calculate current flame expansion progress (0 to 1)
    // If timer expired, flame is at full size (progress = 1)
    const expandProgress = this.flameExpandTimer > 0 
      ? 1 - (this.flameExpandTimer / FLAME_EXPAND_DURATION)
      : 1.0;
    const currentConeLength = expandProgress * FLAME_ATTACK_CONE_LENGTH;
    
    const coneAngleRad = (FLAME_ATTACK_CONE_ANGLE * Math.PI) / 180;
    
    // Calculate cone triangle points
    const facingAngle = Math.atan2(this.facingDirection.y, this.facingDirection.x);
    const halfAngle = coneAngleRad / 2;
    
    // Center point (robot position, slightly forward from center)
    const forwardOffset = this.size / 2;
    const centerX = this.x + Math.cos(facingAngle) * forwardOffset;
    const centerY = this.y + Math.sin(facingAngle) * forwardOffset;
    
    // Two edge points at the current expanding cone length
    const leftAngle = facingAngle - halfAngle;
    const rightAngle = facingAngle + halfAngle;
    
    const leftX = centerX + Math.cos(leftAngle) * currentConeLength;
    const leftY = centerY + Math.sin(leftAngle) * currentConeLength;
    
    const rightX = centerX + Math.cos(rightAngle) * currentConeLength;
    const rightY = centerY + Math.sin(rightAngle) * currentConeLength;
    
    // Draw filled flame triangle (orange/red gradient effect)
    // Outer glow (lighter orange)
    this.flameVisual.fillStyle(0xFFA500, 0.4); // Orange, 40% opacity
    this.flameVisual.fillTriangle(centerX, centerY, leftX, leftY, rightX, rightY);
    
    // Inner core (bright red) - smaller inner cone
    const innerLength = currentConeLength * 0.7;
    const innerLeftX = centerX + Math.cos(leftAngle) * innerLength;
    const innerLeftY = centerY + Math.sin(leftAngle) * innerLength;
    const innerRightX = centerX + Math.cos(rightAngle) * innerLength;
    const innerRightY = centerY + Math.sin(rightAngle) * innerLength;
    
    this.flameVisual.fillStyle(0xFF4500, 0.7); // Red-orange, 70% opacity
    this.flameVisual.fillTriangle(centerX, centerY, innerLeftX, innerLeftY, innerRightX, innerRightY);
    
    // Outline for definition
    this.flameVisual.lineStyle(2, 0xFF6347, 0.8); // Tomato red outline
    this.flameVisual.beginPath();
    this.flameVisual.moveTo(centerX, centerY);
    this.flameVisual.lineTo(leftX, leftY);
    this.flameVisual.moveTo(centerX, centerY);
    this.flameVisual.lineTo(rightX, rightY);
    this.flameVisual.strokePath();
  }

  /**
   * Clears flame visual
   */
  private clearFlameVisual(): void {
    if (this.flameVisual) {
      this.flameVisual.clear();
    }
  }

  /**
   * Cleanup method to destroy visual components
   */
  destroy(): void {
    this.clearFlameVisual();
    
    if (this.flameVisual) {
      this.flameVisual.destroy();
    }
    
    super.destroy();
  }
}

