import { Robot } from './Robot';
import { Player } from './Player';
import { RobotType, RobotState, Vector2 } from '../types';
import { SPIDER_SPEED, SPIDER_SIZE, SPIDER_COLOR, SPIDER_ATTACK_RANGE, SPIDER_ATTACK_COOLDOWN, SPIDER_ATTACK_DAMAGE, SPIDER_LEAP_SPEED, SPIDER_LEAP_DISTANCE, SPIDER_RECUPERATION_DURATION, ALERT_SPEED_MULTIPLIER, BASE_PLAYER_SPEED, ROBOT_CHASE_ABANDON_DISTANCE, DEBUG_MODE, SPIDER_GOO_HITS_TO_KILL, SPIDER_GOO_SPEED_REDUCTION } from '../config/constants';
import { distance, normalize } from '../utils/geometry';
import Phaser from 'phaser';

/**
 * SpiderBot - Fast melee robot with pink light
 * Extends Robot base class with spider-bot specific behaviors
 */
export class SpiderBot extends Robot {
  private attackTargetPlayer: Player | null = null;
  
  // Leaping attack state
  private attackPhase: 'READY' | 'LEAPING' | 'RECUPERATING' = 'READY';
  private recuperationTimer: number = 0;
  private leapTargetPosition: Vector2 | null = null; // Target position to leap to (player's position when leap started)
  private leapDirection: Vector2 | null = null; // Direction of the leap
  private leapDistanceTraveled: number = 0; // Distance traveled during leap
  private hasHitPlayer: boolean = false; // Track if we've hit the player during this leap
  
  // Goo gun effect tracking (Phase 4.2)
  private gooHits: number = 0; // Number of goo hits received
  private baseSpeed: number = SPIDER_SPEED; // Original speed before goo hits

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
    
    // Initialize attack phase state
    this.attackPhase = 'READY';
    this.recuperationTimer = 0;
    
    // Initialize goo hit tracking (Phase 4.2)
    this.gooHits = 0;
    this.baseSpeed = SPIDER_SPEED;
  }
  
  /**
   * Applies a goo gun hit to this spider-bot
   * Phase 4.2: Goo Gun Effect
   * - Reduces speed by 33% per hit
   * - After 3 hits: spider dies and becomes lantern
   */
  applyGooHit(): void {
    this.gooHits++;
    
    if (this.gooHits >= SPIDER_GOO_HITS_TO_KILL) {
      // After 3 hits: spider dies and becomes lantern
      this.dieAndBecomeLantern();
    } else {
      // Reduce speed by 33% per hit
      const speedMultiplier = 1 - (this.gooHits * SPIDER_GOO_SPEED_REDUCTION);
      this.speed = this.baseSpeed * speedMultiplier;
      
      if (DEBUG_MODE) {
        console.log(`🕷️ Spider-bot hit by goo (${this.gooHits}/${SPIDER_GOO_HITS_TO_KILL}). Speed reduced to ${this.speed.toFixed(0)} (${(speedMultiplier * 100).toFixed(0)}%)`);
      }
    }
  }
  
  /**
   * Kills the spider-bot and creates a lantern at its position
   * Phase 4.2: Lantern creation
   */
  private dieAndBecomeLantern(): void {
    if (this.state === RobotState.DEAD) {
      return; // Already dead
    }
    
    if (DEBUG_MODE) {
      console.log(`🕷️ Spider-bot killed by goo gun! Creating lantern at (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`);
    }
    
    // Set state to dead
    this.state = RobotState.DEAD;
    
    // Stop movement
    this.body.setVelocity(0, 0);
    
    // Hide the robot
    this.setVisible(false);
    
    // Destroy debug visuals (vision cone, etc.)
    this.destroyDebugVisuals();
    
    // Create lantern at death position
    // The lantern will be created by GameScene
    this.scene.events.emit('spider-bot-died', {
      x: this.x,
      y: this.y
    });
  }
  
  /**
   * Gets the number of goo hits this spider has received
   */
  getGooHits(): number {
    return this.gooHits;
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
      this.clearChasePath(); // Clear path when returning to patrol
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
      this.clearChasePath(); // Clear path when attacking
    } else {
      // Use pathfinding to chase the target
      const chaseSpeed = BASE_PLAYER_SPEED * ALERT_SPEED_MULTIPLIER;
      
      // Calculate path to target
      const pathFound = this.calculatePathToTarget(this.alertTarget);
      
      if (pathFound) {
        // Follow the path
        this.followPath(delta, chaseSpeed);
      } else {
        // No path found - fallback to direct movement (might be blocked, but try anyway)
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
   * Updates attacking behavior: leaping attack with recuperation pause
   * @param delta Time delta in milliseconds
   * @param players Array of players in the scene
   */
  updateAttacking(delta: number, players: Player[]): void {
    if (!this.attackTargetPlayer || !this.alertTarget) {
      // Target lost, return to alert state
      this.state = RobotState.ALERT;
      this.attackTargetPlayer = null;
      this.resetAttackPhase();
      return;
    }

    // Check if still in range (only check during READY phase, not during leap)
    const distanceToTarget = distance({ x: this.x, y: this.y }, { x: this.attackTargetPlayer.x, y: this.attackTargetPlayer.y });
    
    if (this.attackPhase === 'READY' && distanceToTarget > this.attackRange * 1.5) {
      // Out of range, resume chase
      this.state = RobotState.ALERT;
      this.attackTargetPlayer = null;
      this.resetAttackPhase();
      return;
    }

    // Handle different attack phases
    switch (this.attackPhase) {
      case 'READY':
        this.handleReadyPhase(delta);
        break;
      case 'LEAPING':
        this.handleLeapingPhase(delta, players);
        break;
      case 'RECUPERATING':
        this.handleRecuperatingPhase(delta);
        break;
    }
  }
  
  /**
   * Handles the ready phase - prepares for leap attack
   */
  private handleReadyPhase(delta: number): void {
    if (!this.attackTargetPlayer) return;
    
    // Face the target
    const direction: Vector2 = {
      x: this.attackTargetPlayer.x - this.x,
      y: this.attackTargetPlayer.y - this.y
    };
    this.facingDirection = normalize(direction);
    
    // Check if cooldown is ready and we're in range
    if (this.attackTimer <= 0) {
      const distanceToTarget = distance({ x: this.x, y: this.y }, { x: this.attackTargetPlayer.x, y: this.attackTargetPlayer.y });
      
      if (distanceToTarget <= this.attackRange * 1.5) {
        // Start leap attack
        this.startLeap();
      }
    }
  }
  
  /**
   * Starts the leap attack - leaps a fixed distance toward the player
   */
  private startLeap(): void {
    if (!this.attackTargetPlayer) return;
    
    this.attackPhase = 'LEAPING';
    this.hasHitPlayer = false;
    this.leapDistanceTraveled = 0;
    
    // Store target position (player's position when leap starts)
    this.leapTargetPosition = { x: this.attackTargetPlayer.x, y: this.attackTargetPlayer.y };
    
    // Calculate direction toward player
    const direction: Vector2 = {
      x: this.leapTargetPosition.x - this.x,
      y: this.leapTargetPosition.y - this.y
    };
    this.leapDirection = normalize(direction);
    this.facingDirection = this.leapDirection;
    
    // Reset attack timer (will be set after recuperation)
    this.attackTimer = 0;
  }
  
  /**
   * Handles the leaping phase - robot leaps a fixed distance toward player
   */
  private handleLeapingPhase(delta: number, players: Player[]): void {
    if (!this.leapDirection || !this.attackTargetPlayer) {
      this.resetAttackPhase();
      return;
    }
    
    // Calculate distance moved this frame
    const distanceThisFrame = (SPIDER_LEAP_SPEED * delta) / 1000; // Convert to pixels
    const newDistanceTraveled = this.leapDistanceTraveled + distanceThisFrame;
    
    // Check if we've reached the leap distance
    if (newDistanceTraveled >= SPIDER_LEAP_DISTANCE) {
      // Leap complete - move to exact leap distance
      const remainingDistance = SPIDER_LEAP_DISTANCE - this.leapDistanceTraveled;
      const finalX = this.x + (this.leapDirection.x * remainingDistance);
      const finalY = this.y + (this.leapDirection.y * remainingDistance);
      this.x = finalX;
      this.y = finalY;
      
      // Start recuperation phase (pause after leap)
      this.attackPhase = 'RECUPERATING';
      this.recuperationTimer = SPIDER_RECUPERATION_DURATION;
      this.body.setVelocity(0, 0); // Stop moving
    } else {
      // Continue leaping toward player
      this.leapDistanceTraveled = newDistanceTraveled;
      this.body.setVelocity(
        this.leapDirection.x * SPIDER_LEAP_SPEED,
        this.leapDirection.y * SPIDER_LEAP_SPEED
      );
      
      // Check for collision with player during leap
      if (!this.hasHitPlayer) {
        const distanceToPlayer = distance({ x: this.x, y: this.y }, { x: this.attackTargetPlayer.x, y: this.attackTargetPlayer.y });
        
        // Check if we're close enough to hit (within robot size + player size)
        if (distanceToPlayer <= (this.size / 2 + 20)) {
          this.performAttack(this.attackTargetPlayer);
          this.hasHitPlayer = true;
        }
      }
    }
  }
  
  /**
   * Handles the recuperating phase - robot pauses before chasing again
   */
  private handleRecuperatingPhase(delta: number): void {
    this.recuperationTimer -= delta;
    
    if (this.recuperationTimer <= 0) {
      // Recuperation complete, return to alert state to chase again
      this.attackTimer = this.attackCooldown; // Set cooldown for next attack
      this.state = RobotState.ALERT;
      this.resetAttackPhase();
    } else {
      // Still recuperating - stay still and face the target
      this.body.setVelocity(0, 0);
      if (this.attackTargetPlayer) {
        const direction: Vector2 = {
          x: this.attackTargetPlayer.x - this.x,
          y: this.attackTargetPlayer.y - this.y
        };
        this.facingDirection = normalize(direction);
      }
    }
  }
  
  /**
   * Resets attack phase state
   */
  private resetAttackPhase(): void {
    this.attackPhase = 'READY';
    this.recuperationTimer = 0;
    this.leapTargetPosition = null;
    this.leapDirection = null;
    this.leapDistanceTraveled = 0;
    this.hasHitPlayer = false;
    this.body.setVelocity(0, 0);
  }

  /**
   * Performs an attack on the target player
   * @param player The player to attack
   */
  private performAttack(player: Player): void {
    console.log(`🕷️ Spider-bot attacks player ${player.playerId}!`);
    
    // Deal damage to player
    player.takeDamage(SPIDER_ATTACK_DAMAGE);
  }
}

