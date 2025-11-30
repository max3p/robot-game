import { Robot } from './Robot';
import { Player } from './Player';
import { RobotType, RobotState, Vector2 } from '../types';
import { SHOCK_SPEED, SHOCK_SIZE, SHOCK_COLOR, SHOCK_ATTACK_RANGE, SHOCK_ATTACK_COOLDOWN, SHOCK_ATTACK_DAMAGE, SHOCK_ATTACK_CHARGE_TIME, SHOCK_ATTACK_AOE_RADIUS, SHOCK_MIN_CHASE_DISTANCE, ALERT_SPEED_MULTIPLIER, BASE_PLAYER_SPEED, ROBOT_CHASE_ABANDON_DISTANCE, DEBUG_MODE, SHOCK_EMP_HITS_TO_KILL, SHOCK_EMP_DAZED_DURATION, CRY_ROBOT_SPEED_MULTIPLIER } from '../config/constants';
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
  
  // Track players hit in current shock attack (to prevent multiple hits per shock)
  private shockedPlayers: Set<Player> = new Set();
  
  // EMP hit tracking (Phase 4.3)
  private empHits: number = 0; // Number of EMP hits received
  private isDazed: boolean = false; // True when in dazed state after EMP hit
  private dazedTimer: number = 0; // Timer for dazed state duration
  
  // EMP kill effect (Phase 4.3)
  private isFadingOut: boolean = false;
  private fadeOutTimer: number = 0;
  private readonly FADE_OUT_DURATION = 1000; // milliseconds - 1 second fade out

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
    
    // Initialize EMP hit tracking
    this.empHits = 0;
    this.isDazed = false;
    this.dazedTimer = 0;
  }

  /**
   * Updates the shock-bot's state and behavior
   * Overrides base Robot.update() to add player targeting
   * @param delta Time delta in milliseconds
   * @param players Optional array of players in the scene (required for ALERT/ATTACKING states)
   */
  update(delta: number, players?: Player[]): void {
    // Update fade out effect if active (even when dead)
    if (this.isFadingOut) {
      this.updateFadeOut(delta);
    }
    
    // Don't update anything else if dead
    if (this.state === RobotState.DEAD) {
      return;
    }
    
    // Update dazed timer
    if (this.isDazed) {
      this.dazedTimer -= delta;
      if (this.dazedTimer <= 0) {
        // Dazed state complete, resume normal behavior
        this.isDazed = false;
        this.dazedTimer = 0;
        if (DEBUG_MODE) {
          console.log(`⚡ Shock-bot recovered from EMP daze. Resuming normal behavior.`);
        }
      } else {
        // Still dazed - stop all movement and attacks
        this.body.setVelocity(0, 0);
        this.isCharging = false;
        this.isShocking = false;
        this.chargeTimer = 0;
        this.shockTimer = 0;
        this.clearAttackVisuals();
        // Don't process any other updates while dazed
        return;
      }
    }
    
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
   * Updates fade out animation
   * Phase 4.3: EMP Gun Effect
   */
  private updateFadeOut(delta: number): void {
    this.fadeOutTimer += delta;
    const fadeProgress = this.fadeOutTimer / this.FADE_OUT_DURATION;
    
    if (fadeProgress >= 1) {
      // Fade complete - fully invisible
      this.setAlpha(0);
      this.isFadingOut = false;
    } else {
      // Gradually fade out (1.0 to 0.0)
      this.setAlpha(1 - fadeProgress);
    }
  }
  
  /**
   * Applies EMP gun hit to shock-bot
   * Phase 4.3: EMP Gun Effect
   * - Each hit causes 2 second dazed state
   * - After 4 hits: shock-bot dies and fades out
   * - Light removed when dead (debug visuals destroyed)
   */
  applyEMPHit(): void {
    if (this.state === RobotState.DEAD) {
      return; // Already dead
    }
    
    this.empHits++;
    
    if (this.empHits >= SHOCK_EMP_HITS_TO_KILL) {
      // After 4 hits: shock-bot dies
      this.killWithEMP();
    } else {
      // Enter dazed state for 2 seconds
      this.isDazed = true;
      this.dazedTimer = SHOCK_EMP_DAZED_DURATION;
      
      // Stop all movement and attacks immediately
      this.body.setVelocity(0, 0);
      this.isCharging = false;
      this.isShocking = false;
      this.chargeTimer = 0;
      this.shockTimer = 0;
      this.clearAttackVisuals();
      
      // Cancel current state (return to patrol after daze)
      const previousState = this.state;
      this.state = RobotState.PATROL;
      this.alertTarget = null;
      
      if (DEBUG_MODE) {
        console.log(`⚡ Shock-bot hit by EMP (${this.empHits}/${SHOCK_EMP_HITS_TO_KILL}). Entering dazed state for 2 seconds.`);
      }
    }
  }
  
  /**
   * Kills the shock-bot (called after 4 EMP hits)
   * Phase 4.3: EMP Gun Effect
   * - Fades out over 1 second
   * - Light removed (debug visuals destroyed)
   */
  private killWithEMP(): void {
    if (this.state === RobotState.DEAD) {
      return; // Already dead
    }
    
    if (DEBUG_MODE) {
      console.log(`⚡ Shock-bot killed by EMP gun after ${this.empHits} hits! Fading out at (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`);
    }
    
    // Set state to dead immediately
    this.state = RobotState.DEAD;
    
    // Stop all movement and attacks
    this.body.setVelocity(0, 0);
    this.isCharging = false;
    this.isShocking = false;
    this.isDazed = false; // Clear dazed state
    this.chargeTimer = 0;
    this.shockTimer = 0;
    this.dazedTimer = 0;
    
    // Clear attack visuals
    this.clearAttackVisuals();
    
    // Destroy debug visuals (light cone, etc.)
    this.destroyDebugVisuals();
    
    // Start fade out animation
    this.isFadingOut = true;
    this.fadeOutTimer = 0;
    
    // Clear alert target
    this.alertTarget = null;
  }
  
  /**
   * Gets the number of EMP hits this shock-bot has received
   */
  getEMPHits(): number {
    return this.empHits;
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

    // Find the target player (ignore downed players)
    let targetPlayer: Player | null = null;
    let minDistance = Infinity;

    for (const player of players) {
      // Ignore downed players
      if (player.isDowned) {
        continue;
      }
      
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
      // Phase 5.1: Apply 1.5x speed multiplier if alerted by baby cry
      let speedMultiplier = ALERT_SPEED_MULTIPLIER;
      if (this.isBabyCryAlerted()) {
        speedMultiplier *= CRY_ROBOT_SPEED_MULTIPLIER;
      }
      const chaseSpeed = BASE_PLAYER_SPEED * speedMultiplier;
      
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
    // Check if attack target is downed or lost
    if (!this.attackTargetPlayer || !this.alertTarget || this.attackTargetPlayer.isDowned) {
      // Target lost or downed, return to alert state
      const wasDowned = this.attackTargetPlayer?.isDowned;
      this.state = RobotState.ALERT;
      this.attackTargetPlayer = null;
      if (wasDowned) {
        this.alertTarget = null; // Clear alert target if player is downed
      }
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
        this.shockedPlayers.clear(); // Clear hit tracking for new shock
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
      // Ignore downed players
      if (player.isDowned) {
        continue;
      }
      
      const playerDistance = distance({ x: this.x, y: this.y }, { x: player.x, y: player.y });
      
      // Check if player is within the current expanding shock radius
      // Only deal damage once per shock attack
      if (playerDistance <= currentShockRadius && !this.shockedPlayers.has(player)) {
        // Player hit by shock!
        if (DEBUG_MODE) {
          console.log(`⚡ Shock-bot hits player ${player.playerId}! (${playerDistance.toFixed(1)}px from center)`);
        }
        
        // Deal damage to player
        player.takeDamage(SHOCK_ATTACK_DAMAGE);
        
        // Mark player as hit for this shock
        this.shockedPlayers.add(player);
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

