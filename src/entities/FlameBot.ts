import { Robot } from './Robot';
import { Player } from './Player';
import { RobotType, RobotState, Vector2 } from '../types';
import { FLAME_SPEED, FLAME_SIZE, FLAME_COLOR, FLAME_ATTACK_RANGE, FLAME_ATTACK_COOLDOWN, FLAME_ATTACK_DAMAGE, FLAME_ATTACK_CONE_ANGLE, FLAME_ATTACK_CONE_LENGTH, ALERT_SPEED_MULTIPLIER, BASE_PLAYER_SPEED, ROBOT_CHASE_ABANDON_DISTANCE, DEBUG_MODE } from '../config/constants';
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
  
  // Track which players were hit this attack cycle to avoid multiple hits
  private hitPlayersThisCycle: Set<Player> = new Set();

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
      // Chase speed: slower than player (85% of player base speed = 170 pixels/sec)
      const chaseSpeed = BASE_PLAYER_SPEED * ALERT_SPEED_MULTIPLIER;
      
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
      this.hitPlayersThisCycle.clear();
      this.clearFlameVisual();
      return;
    }

    // Check if still in range
    const distanceToTarget = distance({ x: this.x, y: this.y }, { x: this.attackTargetPlayer.x, y: this.attackTargetPlayer.y });
    
    if (distanceToTarget > this.attackRange) {
      // Out of range, resume chase
      this.state = RobotState.ALERT;
      this.attackTargetPlayer = null;
      this.hitPlayersThisCycle.clear();
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

    // Reset hit tracking when cooldown expires (new attack cycle)
    if (this.attackTimer <= 0) {
      this.hitPlayersThisCycle.clear();
      this.attackTimer = this.attackCooldown;
    }

    // Continuous flame attack - check for players in flame cone
    this.checkFlameHits(players);
  }

  /**
   * Checks for player collisions with the continuous flame cone
   * @param players Array of players to check
   */
  private checkFlameHits(players: Player[]): void {
    const coneAngleRad = (FLAME_ATTACK_CONE_ANGLE * Math.PI) / 180; // Convert to radians
    
    for (const player of players) {
      // Skip if already hit this attack cycle
      if (this.hitPlayersThisCycle.has(player)) {
        continue;
      }
      
      // Check if player is in flame cone
      if (isPointInCone(
        { x: this.x, y: this.y },
        this.facingDirection,
        coneAngleRad,
        FLAME_ATTACK_CONE_LENGTH,
        { x: player.x, y: player.y }
      )) {
        // Player hit by flame!
        if (DEBUG_MODE) {
          console.log(`🔥 Flame-bot hits player ${player.playerId}!`);
        }
        
        // Mark as hit this cycle
        this.hitPlayersThisCycle.add(player);
        
        // TODO (Phase 4): Deal damage to player
        // - Deal FLAME_ATTACK_DAMAGE to player
        // - Apply invincibility period
        // - Trigger baby cry if player is baby holder
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
   * Updates flame attack visual (continuous orange/red triangle cone)
   */
  private updateFlameVisual(): void {
    if (this.state === RobotState.ATTACKING && this.attackTargetPlayer) {
      if (!this.flameVisual) {
        this.createFlameVisual();
      }
      
      this.drawFlameCone();
    } else {
      this.clearFlameVisual();
    }
  }

  /**
   * Draws the flame cone visual (triangle pointing in facing direction)
   */
  private drawFlameCone(): void {
    if (!this.flameVisual) return;

    this.flameVisual.clear();

    const coneLength = FLAME_ATTACK_CONE_LENGTH;
    const coneAngleRad = (FLAME_ATTACK_CONE_ANGLE * Math.PI) / 180;
    
    // Calculate cone triangle points
    const facingAngle = Math.atan2(this.facingDirection.y, this.facingDirection.x);
    const halfAngle = coneAngleRad / 2;
    
    // Center point (robot position, slightly forward from center)
    const forwardOffset = this.size / 2;
    const centerX = this.x + Math.cos(facingAngle) * forwardOffset;
    const centerY = this.y + Math.sin(facingAngle) * forwardOffset;
    
    // Two edge points at the cone length
    const leftAngle = facingAngle - halfAngle;
    const rightAngle = facingAngle + halfAngle;
    
    const leftX = centerX + Math.cos(leftAngle) * coneLength;
    const leftY = centerY + Math.sin(leftAngle) * coneLength;
    
    const rightX = centerX + Math.cos(rightAngle) * coneLength;
    const rightY = centerY + Math.sin(rightAngle) * coneLength;
    
    // Draw filled flame triangle (orange/red gradient effect)
    // Outer glow (lighter orange)
    this.flameVisual.fillStyle(0xFFA500, 0.4); // Orange, 40% opacity
    this.flameVisual.fillTriangle(centerX, centerY, leftX, leftY, rightX, rightY);
    
    // Inner core (bright red)
    const innerLeftX = centerX + Math.cos(leftAngle) * (coneLength * 0.7);
    const innerLeftY = centerY + Math.sin(leftAngle) * (coneLength * 0.7);
    const innerRightX = centerX + Math.cos(rightAngle) * (coneLength * 0.7);
    const innerRightY = centerY + Math.sin(rightAngle) * (coneLength * 0.7);
    
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

