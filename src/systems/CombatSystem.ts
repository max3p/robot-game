import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Weapon } from '../entities/Weapon';
import { Robot } from '../entities/Robot';
import { SpiderBot } from '../entities/SpiderBot';
import { WeaponType, RobotType, RobotState, Vector2 } from '../types';
import { WEAPON_RANGE, WEAPON_AIM_ARC, GOO_GUN_COLOR, EMP_GUN_COLOR, WATER_GUN_COLOR } from '../config/constants';
import { distance, isPointInCone, hasLineOfSight } from '../utils/geometry';

/**
 * CombatSystem handles auto-shooting for players holding weapons
 * Phase 4.1: Auto-Shooting System
 */
export class CombatSystem {
  private scene: Phaser.Scene;
  private players: Player[] = [];
  private robots: Robot[] = [];
  private levelGrid: number[][] = [];
  private tileSize: number = 0;
  private levelOffsetX: number = 0;
  private levelOffsetY: number = 0;
  
  // Visual effects for shots
  private shotEffects: Array<{
    graphics: Phaser.GameObjects.Graphics;
    timer: number;
    player: Player;
    target: Robot;
    weaponType: WeaponType;
    animationProgress: number; // 0 to 1, how far along the animation is
  }> = [];
  private readonly SHOT_EFFECT_DURATION = 300; // milliseconds (increased for better visibility)
  private readonly SHOT_ANIMATION_DURATION = 50; // milliseconds (very fast animation from player to target)

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Sets the players array
   */
  setPlayers(players: Player[]): void {
    this.players = players;
  }

  /**
   * Sets the robots array
   */
  setRobots(robots: Robot[]): void {
    this.robots = robots;
  }

  /**
   * Sets level information for line-of-sight checks
   */
  setLevelInfo(
    grid: number[][],
    tileSize: number,
    levelOffsetX: number,
    levelOffsetY: number
  ): void {
    this.levelGrid = grid;
    this.tileSize = tileSize;
    this.levelOffsetX = levelOffsetX;
    this.levelOffsetY = levelOffsetY;
  }

  /**
   * Updates the combat system - handles auto-shooting
   * @param delta Time delta in milliseconds
   */
  update(delta: number): void {
    // Update and clean up shot effects
    this.updateShotEffects(delta);

    // Process each player with a weapon
    for (const player of this.players) {
      if (player.heldWeapon) {
        this.processPlayerWeapon(player, player.heldWeapon, delta);
      }
    }
  }

  /**
   * Processes auto-shooting for a player with a weapon
   */
  private processPlayerWeapon(player: Player, weapon: Weapon, delta: number): void {
    // Check if weapon is ready to fire
    if (!weapon.isReady()) {
      return;
    }

    // Find nearest valid target
    const target = this.findNearestTarget(player, weapon);

    if (target) {
      // Fire at target
      this.fireWeapon(player, weapon, target);
    }
  }

  /**
   * Finds the nearest valid target robot for a player's weapon
   * @returns The nearest robot in range and front arc, or null if none found
   */
  private findNearestTarget(player: Player, weapon: Weapon): Robot | null {
    const playerPos: Vector2 = { x: player.x, y: player.y };
    let nearestRobot: Robot | null = null;
    let nearestDistance = Infinity;

    // Convert aim arc from degrees to radians
    const aimArcRad = (WEAPON_AIM_ARC * Math.PI) / 180;

    for (const robot of this.robots) {
      // Skip dead robots
      if (robot.state === RobotState.DEAD) {
        continue;
      }

      const robotPos: Vector2 = { x: robot.x, y: robot.y };
      const dist = distance(playerPos, robotPos);

      // Check if in range
      if (dist > weapon.range) {
        continue;
      }

      // Check if in front arc (90 degrees)
      const playerFacing = player.facingDirection;
      if (!isPointInCone(playerPos, playerFacing, aimArcRad, weapon.range, robotPos)) {
        continue;
      }

      // Check line of sight
      if (!hasLineOfSight(playerPos, robotPos, this.levelGrid, this.tileSize, this.levelOffsetX, this.levelOffsetY)) {
        continue;
      }

      // This is a valid target - check if it's the nearest
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestRobot = robot;
      }
    }

    return nearestRobot;
  }

  /**
   * Fires a weapon at a target robot
   */
  private fireWeapon(player: Player, weapon: Weapon, target: Robot): void {
    // Update player facing direction to face the target
    const directionToTarget = {
      x: target.x - player.x,
      y: target.y - player.y
    };
    const length = Math.sqrt(directionToTarget.x * directionToTarget.x + directionToTarget.y * directionToTarget.y);
    if (length > 0) {
      player.facingDirection = {
        x: directionToTarget.x / length,
        y: directionToTarget.y / length
      };
      
      // Immediately update weapon direction to face target
      weapon.update(0); // Pass 0 delta since we just want to update the visual
    }

    // Fire the weapon (sets cooldown)
    weapon.fire();

    // Create visual effect (brief line/flash from player to target)
    this.createShotEffect(player, target, weapon.weaponType);

    // Apply weapon effect to target
    this.applyWeaponEffect(weapon.weaponType, target);
  }

  /**
   * Creates a visual effect for a shot (animated line from player to target)
   */
  private createShotEffect(player: Player, target: Robot, weaponType: WeaponType): void {
    const graphics = this.scene.add.graphics();
    
    // Set depth to render above most things
    graphics.setDepth(100);

    // Store effect with references to player and target for dynamic tracking
    this.shotEffects.push({
      graphics,
      timer: this.SHOT_EFFECT_DURATION,
      player,
      target,
      weaponType,
      animationProgress: 0 // Start at 0, will animate to 1
    });
  }

  /**
   * Updates and cleans up shot effects
   */
  private updateShotEffects(delta: number): void {
    for (let i = this.shotEffects.length - 1; i >= 0; i--) {
      const effect = this.shotEffects[i];
      effect.timer -= delta;

      // Update animation progress (0 to 1 over SHOT_ANIMATION_DURATION)
      if (effect.animationProgress < 1) {
        effect.animationProgress = Math.min(1, effect.animationProgress + (delta / this.SHOT_ANIMATION_DURATION));
      }

      // Render the effect (updates dynamically based on current positions)
      this.renderShotEffect(effect);

      if (effect.timer <= 0) {
        // Remove effect
        effect.graphics.destroy();
        this.shotEffects.splice(i, 1);
      }
    }
  }

  /**
   * Renders a shot effect with animation from player to target
   */
  private renderShotEffect(effect: {
    graphics: Phaser.GameObjects.Graphics;
    player: Player;
    target: Robot;
    weaponType: WeaponType;
    animationProgress: number;
  }): void {
    const { graphics, player, target, weaponType, animationProgress } = effect;

    // Get weapon color
    let color: number;
    switch (weaponType) {
      case WeaponType.GOO_GUN:
        color = GOO_GUN_COLOR;
        break;
      case WeaponType.EMP_GUN:
        color = EMP_GUN_COLOR;
        break;
      case WeaponType.WATER_GUN:
        color = WATER_GUN_COLOR;
        break;
      default:
        color = 0xFFFFFF;
    }

    // Clear previous frame
    graphics.clear();

    // Get current positions (player and target may have moved)
    const playerX = player.x;
    const playerY = player.y;
    const targetX = target.x;
    const targetY = target.y;

    // Calculate distance and direction
    const dx = targetX - playerX;
    const dy = targetY - playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      // Calculate animated endpoint (line grows from player to target)
      const animatedDistance = distance * animationProgress;
      const animatedX = playerX + (dx / distance) * animatedDistance;
      const animatedY = playerY + (dy / distance) * animatedDistance;

      // Draw line from player to animated endpoint
      graphics.lineStyle(5, color, 1.0);
      graphics.beginPath();
      graphics.moveTo(playerX, playerY);
      graphics.lineTo(animatedX, animatedY);
      graphics.strokePath();

      // Only show flash at target when animation is complete
      if (animationProgress >= 1) {
        // Add brighter, larger flash at target position
        graphics.fillStyle(color, 1.0);
        graphics.fillCircle(targetX, targetY, 12);
        
        // Add outer glow effect
        graphics.lineStyle(2, color, 0.6);
        graphics.strokeCircle(targetX, targetY, 16);
      } else {
        // Show a smaller flash at the animated endpoint while animating
        graphics.fillStyle(color, 0.6);
        graphics.fillCircle(animatedX, animatedY, 6);
      }
    }
  }

  /**
   * Applies weapon effect to a target robot
   * Phase 4.2: Goo Gun Effect
   */
  private applyWeaponEffect(weaponType: WeaponType, target: Robot): void {
    if (weaponType === WeaponType.GOO_GUN && target instanceof SpiderBot) {
      // Goo Gun hits Spider-Bot: reduce speed by 33% per hit
      this.applyGooEffect(target);
    } else if (weaponType === WeaponType.EMP_GUN && target.robotType === RobotType.SHOCK_BOT) {
      // EMP Gun hits Shock-Bot: instant kill (Phase 4.3 - not implemented yet)
      // TODO: Implement in Phase 4.3
    } else if (weaponType === WeaponType.WATER_GUN && target.robotType === RobotType.FLAME_BOT) {
      // Water Gun hits Flame-Bot: disable (Phase 4.4 - not implemented yet)
      // TODO: Implement in Phase 4.4
    } else {
      // Wrong weapon type - confusion effect (Phase 4.5 - not implemented yet)
      // TODO: Implement in Phase 4.5
    }
  }

  /**
   * Applies goo gun effect to a spider-bot
   * Phase 4.2: Goo Gun Effect
   */
  private applyGooEffect(spiderBot: SpiderBot): void {
    spiderBot.applyGooHit();
  }
}

