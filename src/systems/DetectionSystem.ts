import { Robot } from '../entities/Robot';
import { Player } from '../entities/Player';
import { Vector2, RobotState } from '../types';
import { distance, vectorToAngle, normalizeAngle, hasLineOfSight, normalize } from '../utils/geometry';
import { ROBOT_CLOSE_RANGE_DETECTION_RADIUS, SHOOTING_SOUND_RADIUS, SOUND_INVESTIGATION_DURATION, DEBUG_MODE } from '../config/constants';

/**
 * DetectionSystem handles robot detection of players
 * Implements cone-based detection with line-of-sight checking
 */
export class DetectionSystem {
  private players: Player[] = [];
  private robots: Robot[] = [];
  private levelGrid: number[][] = [];
  private tileSize: number = 0;
  private levelOffsetX: number = 0;
  private levelOffsetY: number = 0;
  private lastLogTime: Map<string, number> = new Map(); // For throttling logs
  private logThrottleMs: number = 500; // Log same message at most once per 500ms

  /**
   * Sets the players to check for detection
   */
  setPlayers(players: Player[]) {
    this.players = players;
  }

  /**
   * Sets the robots that will detect players
   */
  setRobots(robots: Robot[]) {
    this.robots = robots;
  }

  /**
   * Sets level information needed for line-of-sight checking
   */
  setLevelInfo(grid: number[][], tileSize: number, levelOffsetX: number, levelOffsetY: number) {
    this.levelGrid = grid;
    this.tileSize = tileSize;
    this.levelOffsetX = levelOffsetX;
    this.levelOffsetY = levelOffsetY;
  }

  /**
   * Updates detection for all robots
   * Should be called every frame
   */
  update() {
    for (const robot of this.robots) {
      // Skip if robot is dead, disabled, attacking, or confused
      if (robot.state === RobotState.DEAD || robot.state === RobotState.DISABLED || 
          robot.state === RobotState.ATTACKING || (robot as any).isConfused) {
        continue;
      }

      // Check detection if robot is in PATROL, INVESTIGATING, or ALERT state
      // (ALERT state from baby cry should check for players to continue chasing)
      if (robot.state !== RobotState.PATROL && robot.state !== RobotState.INVESTIGATING && 
          robot.state !== RobotState.ALERT) {
        continue;
      }

      // Check each player (skip downed players)
      for (const player of this.players) {
        // Ignore downed players - they cannot be detected
        if (player.isDowned) {
          continue;
        }
        
        if (this.isPlayerDetected(robot, player)) {
          // Player detected! Enter or maintain ALERT state
          robot.state = RobotState.ALERT;
          robot.alertTarget = { x: player.x, y: player.y };
          robot.investigateTimer = 0; // Clear investigation timer
          
          // Clear baby cry target if set (player detection takes priority)
          if ((robot as any).babyCryTarget) {
            (robot as any).babyCryTarget = null;
          }
          
          console.log(`🚨 Robot detected player ${player.playerId}! Entering ALERT state.`);
          break; // Only alert on first detection
        }
      }
    }
  }

  /**
   * Checks if a player is detected by a robot
   * Based on Section 4.6.1 of implementation docs
   * Detection happens if player is:
   * 1. Within vision cone AND line of sight, OR
   * 2. Within close-range detection radius (regardless of facing direction)
   * @param robot The robot doing the detection
   * @param player The player to check
   * @returns true if player is detected, false otherwise
   */
  private isPlayerDetected(robot: Robot, player: Player): boolean {
    // Get vector from robot to player
    const directionToPlayer: Vector2 = {
      x: player.x - robot.x,
      y: player.y - robot.y
    };
    const distanceToPlayer = distance({ x: robot.x, y: robot.y }, { x: player.x, y: player.y });

    // METHOD 1: Close-range detection (within small radius, regardless of facing direction)
    if (distanceToPlayer <= ROBOT_CLOSE_RANGE_DETECTION_RADIUS) {
      // Check line of sight for close-range detection too
      const hasLOS = hasLineOfSight(
        { x: robot.x, y: robot.y },
        { x: player.x, y: player.y },
        this.levelGrid,
        this.tileSize,
        this.levelOffsetX,
        this.levelOffsetY
      );

      if (hasLOS) {
        // Player is close enough - detected!
        console.log(`[Detection] ✅ Player ${player.playerId} DETECTED at close range! (distance: ${distanceToPlayer.toFixed(0)}px)`);
        return true;
      }
    }

    // METHOD 2: Vision cone detection (existing logic)
    // Skip if robot doesn't have light properties set up yet
    if (robot.lightRadius === 0 || robot.lightAngle === 0) {
      return false;
    }

    // Check distance (must be within vision radius)
    if (distanceToPlayer > robot.lightRadius) {
      return false;
    }

    // Check angle (cone-based detection)
    const angleToPlayer = vectorToAngle(directionToPlayer);
    const robotFacingAngle = vectorToAngle(robot.facingDirection);
    const angleDifference = Math.abs(normalizeAngle(angleToPlayer - robotFacingAngle));
    
    // Convert light angle from degrees to radians for comparison
    const halfConeAngle = (robot.lightAngle * Math.PI / 180) / 2;
    
    if (angleDifference > halfConeAngle) {
      return false;
    }

    // Check line of sight (no walls blocking)
    const hasLOS = hasLineOfSight(
      { x: robot.x, y: robot.y },
      { x: player.x, y: player.y },
      this.levelGrid,
      this.tileSize,
      this.levelOffsetX,
      this.levelOffsetY
    );

    if (!hasLOS) {
      // Log when line of sight is blocked (throttled)
      const logKey = `blocked-${robot.robotType}-${player.playerId}`;
      if (this.shouldLog(logKey)) {
        console.log(`[Detection] Player ${player.playerId} blocked by wall (distance: ${distanceToPlayer.toFixed(0)}px)`);
      }
      return false;
    }

    // All checks passed - player is detected via vision cone!
    // Log detection details (always log detections, no throttling)
    console.log(`[Detection] ✅ Player ${player.playerId} DETECTED via vision cone! (distance: ${distanceToPlayer.toFixed(0)}px, angle: ${(angleDifference * 180 / Math.PI).toFixed(1)}°)`);
    return true;
  }

  /**
   * Handles sound detection when a player shoots
   * Robots within sound radius turn toward the sound and investigate
   * @param shooterPosition Position where the shot was fired from
   */
  handleSoundDetection(shooterPosition: Vector2): void {
    for (const robot of this.robots) {
      // Skip dead robots
      if (robot.state === RobotState.DEAD) {
        continue;
      }

      // Calculate distance to sound source
      const distanceToSound = distance(
        { x: robot.x, y: robot.y },
        shooterPosition
      );

      // Check if robot is within sound radius
      if (distanceToSound <= SHOOTING_SOUND_RADIUS) {
        // Robot hears the sound!
        // Turn toward the sound source
        const directionToSound = {
          x: shooterPosition.x - robot.x,
          y: shooterPosition.y - robot.y
        };
        robot.facingDirection = normalize(directionToSound);

        // If robot is in PATROL state, enter INVESTIGATING state
        if (robot.state === RobotState.PATROL) {
          robot.state = RobotState.INVESTIGATING;
          robot.alertTarget = { x: shooterPosition.x, y: shooterPosition.y };
          robot.investigateTimer = SOUND_INVESTIGATION_DURATION;

          if (DEBUG_MODE) {
            console.log(`🔊 Robot ${robot.robotType} heard shooting sound! Investigating at (${shooterPosition.x.toFixed(0)}, ${shooterPosition.y.toFixed(0)})`);
          }
        } else if (robot.state === RobotState.INVESTIGATING) {
          // If already investigating, update target to new sound location
          robot.alertTarget = { x: shooterPosition.x, y: shooterPosition.y };
          robot.investigateTimer = SOUND_INVESTIGATION_DURATION; // Reset timer
        }
        // Note: If robot is already in ALERT or ATTACKING state, don't interrupt
      }
    }
  }

  /**
   * Helper to throttle logging of repeated messages
   */
  private shouldLog(logKey: string): boolean {
    const now = Date.now();
    const lastLog = this.lastLogTime.get(logKey) || 0;
    if (now - lastLog > this.logThrottleMs) {
      this.lastLogTime.set(logKey, now);
      return true;
    }
    return false;
  }
}

