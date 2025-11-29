import { Robot } from './Robot';
import { Player } from './Player';
import { RobotType, RobotState, Vector2 } from '../types';
import { SHOCK_SPEED, SHOCK_SIZE, SHOCK_COLOR, SHOCK_ATTACK_RANGE, SHOCK_ATTACK_COOLDOWN, SHOCK_ATTACK_DAMAGE, SHOCK_ATTACK_CHARGE_TIME, SHOCK_ATTACK_AOE_RADIUS, SHOCK_MIN_CHASE_DISTANCE, ALERT_SPEED_MULTIPLIER, BASE_PLAYER_SPEED, ROBOT_CHASE_ABANDON_DISTANCE, DEBUG_MODE } from '../config/constants';
import { distance, normalize } from '../utils/geometry';
import Phaser from 'phaser';

/**
 * ShockBot - Medium speed ranged robot with blue light
 * Extends Robot base class with shock-bot specific behaviors
 */
export class ShockBot extends Robot {
  private attackTargetPlayer: Player | null = null;
  private chargeTimer: number = 0;
  private isCharging: boolean = false;
  private shockTimer: number = 0;
  private isShocking: boolean = false;
  private attackTargetPosition: Vector2 | null = null;
  
  // Visual components for charge-up and lightning
  private chargeVisual?: Phaser.GameObjects.Graphics;
  private lightningVisual?: Phaser.GameObjects.Graphics;
  private shockRadiusVisual?: Phaser.GameObjects.Graphics;
  private chargeProgressBar?: Phaser.GameObjects.Graphics;
  
  private readonly SHOCK_DURATION = 250; // milliseconds

  /**
   * Creates a new ShockBot instance
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
      RobotType.SHOCK_BOT,
      x,
      y,
      levelOffsetX,
      levelOffsetY,
      tileSize,
      SHOCK_SPEED,
      SHOCK_SIZE,
      SHOCK_COLOR
    );

    // Set shock-bot specific properties
    this.attackRange = SHOCK_ATTACK_RANGE;
    this.attackCooldown = SHOCK_ATTACK_COOLDOWN;
    this.attackTimer = 0;
    this.chargeTimer = 0;
    this.shockTimer = 0;
    this.isShocking = false;
  }

  /**
   * Updates the shock-bot's state and behavior
   * Overrides base Robot.update() to add player targeting
   * @param delta Time delta in milliseconds
   * @param players Optional array of players in the scene (required for ALERT/ATTACKING states)
   */
  update(delta: number, players?: Player[]): void {
    // Update charge timer
    if (this.chargeTimer > 0) {
      this.chargeTimer -= delta;
    }
    
    // Update shock timer
    if (this.shockTimer > 0) {
      this.shockTimer -= delta;
    }
    
    // Call parent update for basic behavior (patrol, visuals, attack timer)
    // BUT skip smooth movement if we're in ALERT or ATTACKING state (we handle movement directly)
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
    this.updateAttackVisuals();
    
    // CRITICAL: During shocking phase, ensure velocity is ALWAYS zero at the end of update
    // This overrides any movement that might have been set by parent class or other systems
    if (this.isShocking || this.state === RobotState.ATTACKING) {
      // During shocking, absolutely no movement allowed
      if (this.isShocking) {
        this.body.setVelocity(0, 0);
      }
    }
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
      this.clearChasePath(); // Clear path when returning to patrol
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
      this.clearChasePath(); // Clear path when returning to patrol
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
      this.clearChasePath(); // Clear path when returning to patrol
      this.startRepositioning();
      return;
    }
    
    // Check if close enough for AOE attack (must be within AOE radius)
    const aoeAttackRange = SHOCK_ATTACK_AOE_RADIUS;
    
    if (distanceToTarget <= aoeAttackRange && this.attackTimer <= 0) {
      // Close enough for AOE attack and cooldown ready - enter attacking state
      this.state = RobotState.ATTACKING;
      this.attackTargetPlayer = targetPlayer;
      this.body.setVelocity(0, 0); // Stop moving to attack
      this.clearChasePath(); // Clear path when attacking
    } else if (distanceToTarget <= SHOCK_MIN_CHASE_DISTANCE) {
      // Too close - stop chasing and just stand still (face the player)
      const direction: Vector2 = {
        x: this.alertTarget.x - this.x,
        y: this.alertTarget.y - this.y
      };
      const normalized = normalize(direction);
      this.body.setVelocity(0, 0); // Stop moving
      this.facingDirection = normalized;
      this.clearChasePath(); // Clear path when stopped
    } else {
      // Need to get closer - use pathfinding to chase the target
      const chaseSpeed = BASE_PLAYER_SPEED * ALERT_SPEED_MULTIPLIER;
      
      // Calculate path to target
      const pathFound = this.calculatePathToTarget(this.alertTarget);
      
      if (pathFound) {
        // Follow the path
        this.followPath(delta, chaseSpeed);
      } else {
        // No path found - fallback to direct movement
        const direction: Vector2 = {
          x: this.alertTarget.x - this.x,
          y: this.alertTarget.y - this.y
        };
        
        const normalized = normalize(direction);
        this.body.setVelocity(normalized.x * chaseSpeed, normalized.y * chaseSpeed);
        this.facingDirection = normalized;
      }
    }
  }

  /**
   * Updates attacking behavior: ranged attack with charge-up and lightning arc
   * @param delta Time delta in milliseconds
   * @param players Array of players in the scene
   */
  updateAttacking(delta: number, players: Player[]): void {
    if (!this.attackTargetPlayer || !this.alertTarget) {
      // Target lost, return to alert state
      this.state = RobotState.ALERT;
      this.attackTargetPlayer = null;
      this.isCharging = false;
      this.chargeTimer = 0;
      this.isShocking = false;
      this.shockTimer = 0;
      this.clearAttackVisuals();
      return;
    }

    // PRIORITY 1: If shocking, MUST complete shock before any state changes
    if (this.isShocking) {
      // Keep facing target
      const direction: Vector2 = {
        x: this.attackTargetPlayer.x - this.x,
        y: this.attackTargetPlayer.y - this.y
      };
      this.facingDirection = normalize(direction);
      
      // CRITICAL: Force robot to stay completely still during shock
      this.body.setVelocity(0, 0);
      
      // Check for player collisions with expanding shock
      this.checkShockHits(players);
      
      if (this.shockTimer <= 0) {
        // Shock complete - clear visuals first
        this.clearAttackVisuals();
        
        // Clear shocking state
        this.isShocking = false;
        this.shockTimer = 0;
        
        // Ensure velocity is zero before state change
        this.body.setVelocity(0, 0);
        
        // Then return to alert to chase again
        this.state = RobotState.ALERT;
        this.attackTargetPlayer = null;
      } else {
        // Still shocking - absolutely ensure robot stays still
        this.body.setVelocity(0, 0);
      }
      return; // Must stay in ATTACKING state until shock completes
    }
    
    // If charging, continue charging (must stay still)
    if (this.isCharging) {
      // Keep facing target
      const direction: Vector2 = {
        x: this.attackTargetPlayer.x - this.x,
        y: this.attackTargetPlayer.y - this.y
      };
      this.facingDirection = normalize(direction);
      
      // Update target position in case player moved
      this.attackTargetPosition = { x: this.attackTargetPlayer.x, y: this.attackTargetPlayer.y };
      
      if (this.chargeTimer <= 0) {
        // Charge complete, start shocking phase
        this.isCharging = false;
        this.chargeTimer = 0;
        this.isShocking = true;
        this.shockTimer = this.SHOCK_DURATION;
        this.attackTimer = this.attackCooldown;
        this.body.setVelocity(0, 0); // Stay still during shock
        this.createShockVisual();
      }
      return;
    }

    // Attack if cooldown is ready and in AOE range
    if (this.attackTimer <= 0) {
      // Start charging - stop moving
      this.isCharging = true;
      this.chargeTimer = SHOCK_ATTACK_CHARGE_TIME;
      this.attackTargetPosition = { x: this.attackTargetPlayer.x, y: this.attackTargetPlayer.y };
      this.body.setVelocity(0, 0); // Stop moving during charge
      this.createChargeVisual();
    }
    // If cooldown not ready, just wait (no visuals needed)
  }

  /**
   * Checks for player collisions with the expanding shock radius
   * @param players Array of players to check
   */
  private checkShockHits(players: Player[]): void {
    const shockProgress = 1 - (this.shockTimer / this.SHOCK_DURATION);
    const currentShockRadius = shockProgress * SHOCK_ATTACK_AOE_RADIUS;
    
    for (const player of players) {
      const playerDistance = distance({ x: this.x, y: this.y }, { x: player.x, y: player.y });
      
      // Check if player is within the current expanding shock radius
      if (playerDistance <= currentShockRadius) {
        // Player hit by shock!
        if (DEBUG_MODE) {
          console.log(`⚡ Shock-bot hits player ${player.playerId}! (${playerDistance.toFixed(1)}px from center)`);
        }
        
        // TODO (Phase 4): Deal damage to player
        // - Deal SHOCK_ATTACK_DAMAGE to player
        // - Apply invincibility period
        // - Trigger baby cry if player is baby holder
      }
    }
  }

  /**
   * Creates charge-up visual effect
   */
  private createChargeVisual(): void {
    this.clearAttackVisuals();
    
    if (!this.chargeVisual) {
      this.chargeVisual = this.scene.add.graphics();
      this.chargeVisual.setDepth(15); // Above robot but below players
    }
    
    if (!this.chargeProgressBar) {
      this.chargeProgressBar = this.scene.add.graphics();
      this.chargeProgressBar.setDepth(16); // Above everything
    }
  }
  
  /**
   * Creates shock radius visual (expanding circle)
   */
  private createShockVisual(): void {
    this.clearAttackVisuals();
    
    if (!this.shockRadiusVisual) {
      this.shockRadiusVisual = this.scene.add.graphics();
      this.shockRadiusVisual.setDepth(14); // Below players
    }
  }

  /**
   * Creates lightning arc visual from robot to target
   */
  private createLightningVisual(target: Vector2): void {
    this.clearAttackVisuals();
    
    if (!this.lightningVisual) {
      this.lightningVisual = this.scene.add.graphics();
      this.lightningVisual.setDepth(15);
    }

    // Draw jagged lightning arc from robot to target
    this.drawLightningArc(this.x, this.y, target.x, target.y);
    
    // Remove lightning visual after a brief time (100ms)
    this.scene.time.delayedCall(100, () => {
      if (this.lightningVisual) {
        this.lightningVisual.clear();
      }
    });
  }

  /**
   * Draws a jagged lightning arc between two points
   */
  private drawLightningArc(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.lightningVisual) return;

    const segments = 8; // Number of segments in the lightning arc
    const points: Vector2[] = [
      { x: x1, y: y1 } // Start at robot
    ];

    // Generate jagged path
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const baseX = x1 + (x2 - x1) * t;
      const baseY = y1 + (y2 - y1) * t;
      
      // Add random offset perpendicular to the line for jagged effect
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / length;
      const perpY = dx / length;
      
      const offsetAmount = (Math.random() - 0.5) * 20; // Random offset up to 10px
      points.push({
        x: baseX + perpX * offsetAmount,
        y: baseY + perpY * offsetAmount
      });
    }

    points.push({ x: x2, y: y2 }); // End at target

    // Draw the lightning path
    this.lightningVisual.lineStyle(3, SHOCK_COLOR, 1.0);
    this.lightningVisual.beginPath();
    this.lightningVisual.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      this.lightningVisual.lineTo(points[i].x, points[i].y);
    }
    
    this.lightningVisual.strokePath();

    // Add glow effect (outer brighter line)
    this.lightningVisual.lineStyle(5, 0x87CEEB, 0.5); // Light blue glow
    this.lightningVisual.beginPath();
    this.lightningVisual.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      this.lightningVisual.lineTo(points[i].x, points[i].y);
    }
    
    this.lightningVisual.strokePath();
  }

  /**
   * Updates attack visuals (charge-up effect, expanding shock radius, progress bar)
   */
  private updateAttackVisuals(): void {
    // Update expanding shock radius visual
    if (this.isShocking && this.shockRadiusVisual) {
      this.shockRadiusVisual.clear();
      
      const shockProgress = 1 - (this.shockTimer / this.SHOCK_DURATION);
      const currentRadius = shockProgress * SHOCK_ATTACK_AOE_RADIUS;
      
      // Draw expanding shock circle from robot center
      // Outer glow
      this.shockRadiusVisual.lineStyle(3, SHOCK_COLOR, 0.8);
      this.shockRadiusVisual.strokeCircle(this.x, this.y, currentRadius);
      
      // Inner bright core (slightly smaller)
      this.shockRadiusVisual.fillStyle(SHOCK_COLOR, 0.4);
      this.shockRadiusVisual.fillCircle(this.x, this.y, currentRadius * 0.8);
      
      // Pulsing outer edge
      const pulseAlpha = 0.3 + (Math.sin(shockProgress * Math.PI * 4) * 0.2);
      this.shockRadiusVisual.lineStyle(5, 0x87CEEB, pulseAlpha); // Light blue glow
      this.shockRadiusVisual.strokeCircle(this.x, this.y, currentRadius);
    }
    
    // Update charge visual
    if (this.isCharging && this.chargeVisual) {
      this.chargeVisual.clear();
      
      // Draw pulsing charge effect around robot
      const chargeProgress = 1 - (this.chargeTimer / SHOCK_ATTACK_CHARGE_TIME);
      const pulseRadius = 20 + (chargeProgress * 15); // Grows from 20 to 35
      const alpha = 0.3 + (chargeProgress * 0.5); // Gets brighter
      
      // Outer glow
      this.chargeVisual.lineStyle(4, SHOCK_COLOR, alpha);
      this.chargeVisual.strokeCircle(this.x, this.y, pulseRadius);
      
      // Inner bright core
      this.chargeVisual.fillStyle(SHOCK_COLOR, alpha * 0.5);
      this.chargeVisual.fillCircle(this.x, this.y, pulseRadius * 0.6);
    }
    
    // Update charge progress bar
    if (this.isCharging && this.chargeProgressBar) {
      this.chargeProgressBar.clear();
      
      const chargeProgress = 1 - (this.chargeTimer / SHOCK_ATTACK_CHARGE_TIME);
      const barWidth = 60;
      const barHeight = 8;
      const barX = this.x - barWidth / 2;
      const barY = this.y - this.size / 2 - 25; // Above robot
      
      // Background
      this.chargeProgressBar.fillStyle(0x000000, 0.5);
      this.chargeProgressBar.fillRect(barX, barY, barWidth, barHeight);
      
      // Progress fill
      const fillWidth = barWidth * chargeProgress;
      this.chargeProgressBar.fillStyle(SHOCK_COLOR, 1.0);
      this.chargeProgressBar.fillRect(barX, barY, fillWidth, barHeight);
      
      // Border
      this.chargeProgressBar.lineStyle(2, SHOCK_COLOR, 1.0);
      this.chargeProgressBar.strokeRect(barX, barY, barWidth, barHeight);
    }
  }

  /**
   * Clears all attack visuals
   */
  private clearAttackVisuals(): void {
    if (this.chargeVisual) {
      this.chargeVisual.clear();
    }
    if (this.lightningVisual) {
      this.lightningVisual.clear();
    }
    if (this.shockRadiusVisual) {
      this.shockRadiusVisual.clear();
    }
    if (this.chargeProgressBar) {
      this.chargeProgressBar.clear();
    }
  }

  /**
   * Cleanup method to destroy visual components
   */
  destroy(): void {
    this.clearAttackVisuals();
    
    if (this.chargeVisual) {
      this.chargeVisual.destroy();
    }
    if (this.lightningVisual) {
      this.lightningVisual.destroy();
    }
    if (this.shockRadiusVisual) {
      this.shockRadiusVisual.destroy();
    }
    if (this.chargeProgressBar) {
      this.chargeProgressBar.destroy();
    }
    
    super.destroy();
  }
}

