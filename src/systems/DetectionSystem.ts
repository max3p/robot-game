import { Robot } from '../entities/Robot';
import { Player } from '../entities/Player';
import { Vector2, RobotState } from '../types';
import { distance, vectorToAngle, normalizeAngle, hasLineOfSight } from '../utils/geometry';

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
      // Only check detection if robot is in PATROL state
      // (ALERT state will be handled by alert behavior, not detection)
      if (robot.state !== RobotState.PATROL) {
        continue;
      }

      // Check each player
      for (const player of this.players) {
        if (this.isPlayerDetected(robot, player)) {
          // Player detected! Enter ALERT state
          robot.state = RobotState.ALERT;
          robot.alertTarget = { x: player.x, y: player.y };
          
          console.log(`🚨 Robot detected player ${player.playerId}! Entering ALERT state.`);
          break; // Only alert on first detection
        }
      }
    }
  }

  /**
   * Checks if a player is detected by a robot
   * Based on Section 4.6.1 of implementation docs
   * @param robot The robot doing the detection
   * @param player The player to check
   * @returns true if player is detected, false otherwise
   */
  private isPlayerDetected(robot: Robot, player: Player): boolean {
    // Skip if robot doesn't have light properties set up yet
    if (robot.lightRadius === 0 || robot.lightAngle === 0) {
      return false;
    }

    // Get vector from robot to player
    const directionToPlayer: Vector2 = {
      x: player.x - robot.x,
      y: player.y - robot.y
    };
    const distanceToPlayer = distance({ x: robot.x, y: robot.y }, { x: player.x, y: player.y });

    // Check distance
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

    // All checks passed - player is detected!
    // Log detection details (always log detections, no throttling)
    console.log(`[Detection] ✅ Player ${player.playerId} DETECTED! (distance: ${distanceToPlayer.toFixed(0)}px, angle: ${(angleDifference * 180 / Math.PI).toFixed(1)}°)`);
    return true;
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

