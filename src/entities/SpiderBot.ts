import { Robot } from './Robot';
import { Player } from './Player';
import { RobotType, RobotState, Vector2 } from '../types';
import { SPIDER_SPEED, SPIDER_SIZE, SPIDER_COLOR, SPIDER_ATTACK_RANGE, SPIDER_ATTACK_COOLDOWN, SPIDER_ATTACK_DAMAGE, ALERT_SPEED_MULTIPLIER, BASE_PLAYER_SPEED, ROBOT_CHASE_ABANDON_DISTANCE, DEBUG_MODE } from '../config/constants';
import { distance, normalize } from '../utils/geometry';
import Phaser from 'phaser';

/**
 * SpiderBot - Fast melee robot with pink light
 * Extends Robot base class with spider-bot specific behaviors
 */
export class SpiderBot extends Robot {
  private attackTargetPlayer: Player | null = null;

  /**
   * Creates a new SpiderBot instance
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
      RobotType.SPIDER_BOT,
      x,
      y,
      levelOffsetX,
      levelOffsetY,
      tileSize,
      SPIDER_SPEED,
      SPIDER_SIZE,
      SPIDER_COLOR
    );

    // Set spider-bot specific properties
    this.attackRange = SPIDER_ATTACK_RANGE;
    this.attackCooldown = SPIDER_ATTACK_COOLDOWN;
    this.attackTimer = 0;
  }

  /**
   * Updates the spider-bot's state and behavior
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
      // Start repositioning to center of current tile
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
      // Start repositioning to center of current tile
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
      // Start repositioning to center of current tile
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
   * Updates attacking behavior: deal damage on contact (melee)
   * @param delta Time delta in milliseconds
   * @param players Array of players in the scene
   */
  updateAttacking(delta: number, players: Player[]): void {
    if (!this.attackTargetPlayer || !this.alertTarget) {
      // Target lost, return to alert state
      this.state = RobotState.ALERT;
      this.attackTargetPlayer = null;
      return;
    }

    // Check if still in range
    const distanceToTarget = distance({ x: this.x, y: this.y }, { x: this.attackTargetPlayer.x, y: this.attackTargetPlayer.y });
    
    if (distanceToTarget > this.attackRange) {
      // Out of range, resume chase
      this.state = RobotState.ALERT;
      this.attackTargetPlayer = null;
      return;
    }

    // Face the target
    const direction: Vector2 = {
      x: this.attackTargetPlayer.x - this.x,
      y: this.attackTargetPlayer.y - this.y
    };
    this.facingDirection = normalize(direction);

    // Attack if cooldown is ready
    if (this.attackTimer <= 0) {
      this.performAttack(this.attackTargetPlayer);
      this.attackTimer = this.attackCooldown;
    }
  }

  /**
   * Performs an attack on the target player
   * @param player The player to attack
   */
  private performAttack(player: Player): void {
    // Phase 3.4: Basic attack implementation
    // Full damage system will be implemented in Phase 4
    console.log(`🕷️ Spider-bot attacks player ${player.playerId}!`);
    
    // TODO (Phase 4): Deal damage to player
    // - Reduce player health by SPIDER_ATTACK_DAMAGE
    // - Apply invincibility period
    // - Trigger baby cry if player is baby holder
  }
}

