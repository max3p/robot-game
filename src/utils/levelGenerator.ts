import { LevelData, Vector2, RobotType, RobotSpawn } from '../types';
import { REQUIRED_LEVEL_WIDTH, REQUIRED_LEVEL_HEIGHT, TILE_SIZE } from '../config/constants';

/**
 * Generates a random roguelike level with 3 guaranteed curvy paths from start to end
 * Paths can intersect, creating alternate routes and more interesting navigation
 * 
 * @param levelNumber The level number (starts at 1)
 * @returns A randomly generated LevelData object with multiple paths
 */
export function generateRandomLevel(levelNumber: number): LevelData {
  // Start with all walls
  const grid: number[][] = [];
  for (let y = 0; y < REQUIRED_LEVEL_HEIGHT; y++) {
    grid[y] = [];
    for (let x = 0; x < REQUIRED_LEVEL_WIDTH; x++) {
      grid[y][x] = 1; // All walls initially
    }
  }

  // Random start position: x=0, y=random(0-8)
  const startY = Math.floor(Math.random() * REQUIRED_LEVEL_HEIGHT);
  const startPosition: Vector2 = { x: 0, y: startY };

  // Random exit position: x=9, y=random(0-8)
  const exitY = Math.floor(Math.random() * REQUIRED_LEVEL_HEIGHT);
  const exitPosition: Vector2 = { x: REQUIRED_LEVEL_WIDTH - 1, y: exitY };

  // Generate 3 different paths from start to end
  // Each path will have slightly different characteristics to create variety
  const NUM_PATHS = 3;
  const allPaths: Vector2[][] = [];
  
  for (let pathIndex = 0; pathIndex < NUM_PATHS; pathIndex++) {
    // Each path gets slightly different random seed behavior for variety
    const path = generateCurvyPath(startPosition, exitPosition, pathIndex);
    allPaths.push(path);
    
    // Mark all path tiles as floors - paths can intersect
    for (const tile of path) {
      grid[tile.y][tile.x] = 0;
    }
  }

  // Add minimal visual variety: only very small, rare branches
  // Use combined paths to determine where branches can go
  const combinedPath = allPaths.flat();
  addMinimalVariety(grid, combinedPath);

  // Generate robot spawns based on level number
  const robots = generateRobotSpawns(grid, startPosition, levelNumber);

  return {
    id: levelNumber,
    name: `Level ${levelNumber}`,
    tileSize: TILE_SIZE,
    grid: grid,
    startPosition: startPosition,
    exitPosition: exitPosition,
    robots: robots,
    groundItems: []
  };
}

/**
 * Generates a curvy, winding path from start to end
 * Uses a randomized algorithm that prefers to turn rather than go straight
 * 
 * @param start Starting position
 * @param end Ending position
 * @param pathVariation Optional variation index (0-2) to create different path characteristics
 */
function generateCurvyPath(start: Vector2, end: Vector2, pathVariation: number = 0): Vector2[] {
  const path: Vector2[] = [start];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);
  
  let current = { ...start };
  let lastDirection: Vector2 | null = null;
  let stepsWithoutProgress = 0;
  const maxSteps = REQUIRED_LEVEL_WIDTH * REQUIRED_LEVEL_HEIGHT * 2;
  let stepCount = 0;
  
  // Generate path step by step
  while ((current.x !== end.x || current.y !== end.y) && stepCount < maxSteps) {
    stepCount++;
    
    // Calculate direction to goal
    const dx = end.x - current.x;
    const dy = end.y - current.y;
    const currentDist = Math.abs(dx) + Math.abs(dy);
    
    // Get all possible moves (4-directional)
    const allMoves: Vector2[] = [
      { x: 1, y: 0 },   // Right
      { x: -1, y: 0 },  // Left
      { x: 0, y: 1 },   // Down
      { x: 0, y: -1 }   // Up
    ];
    
    // Filter out moves that are out of bounds
    const validMoves = allMoves.filter(move => {
      const newX = current.x + move.x;
      const newY = current.y + move.y;
      return newX >= 0 && newX < REQUIRED_LEVEL_WIDTH &&
             newY >= 0 && newY < REQUIRED_LEVEL_HEIGHT;
    });
    
    if (validMoves.length === 0) {
      break; // Stuck
    }
    
    // Calculate weights for each move
    const moveWeights: Array<{ move: Vector2; weight: number }> = [];
    
    for (const move of validMoves) {
      const newPos = { x: current.x + move.x, y: current.y + move.y };
      const key = `${newPos.x},${newPos.y}`;
      const newDist = Math.abs(end.x - newPos.x) + Math.abs(end.y - newPos.y);
      const progress = currentDist - newDist;
      
      let weight = 0;
      
      // Strong bias toward making progress to goal
      if (progress > 0) {
        weight += 10; // Making progress is very good
      } else if (progress === 0) {
        weight += 2; // Staying same distance is okay
      } else {
        weight -= 5; // Going away is bad (but sometimes necessary)
      }
      
      // Strongly prefer turning (perpendicular moves) to create tight, winding curves
      if (lastDirection) {
        const isPerpendicular = (move.x !== 0 && lastDirection.y !== 0) || 
                                (move.y !== 0 && lastDirection.x !== 0);
        const isSameDirection = (move.x === lastDirection.x && move.y === lastDirection.y);
        
        if (isPerpendicular) {
          weight += 5; // Strong preference for turning - creates windier paths
        } else if (isSameDirection) {
          // Penalize going straight - but allow it if making good progress
          if (progress > 0 && stepsWithoutProgress < 2) {
            weight += 0.5; // Very slight preference for continuing if making progress
          } else {
            weight -= 2; // Penalty for going straight without progress
          }
        }
      }
      
      // Penalty for revisiting (unless very close to end)
      if (visited.has(key)) {
        if (newDist > 3) {
          weight -= 8; // Heavy penalty for revisiting far from end
        } else if (newDist > 1) {
          weight -= 2; // Light penalty if close to end
        }
        // No penalty if at distance 1 from end (might need to backtrack)
      }
      
      // Add randomness to create variety
      // Each path variation has slightly different randomness characteristics
      const randomMultiplier = 0.8 + (pathVariation * 0.4); // Varies from 0.8 to 2.0
      weight += (Math.random() - 0.5) * 2 * randomMultiplier;
      
      moveWeights.push({ move, weight });
    }
    
    // Sort by weight and choose from top candidates
    moveWeights.sort((a, b) => b.weight - a.weight);
    
    // Prefer the top move, but occasionally choose second-best for variety
    // This creates tighter, more winding paths
    // Different path variations have different selection probabilities
    const candidateCount = Math.min(2, moveWeights.length);
    const topCandidates = moveWeights.slice(0, candidateCount);
    
    // Path variation affects how likely we are to take the best vs second-best move
    // Path 0: 70% best, 30% second-best (balanced)
    // Path 1: 50% best, 50% second-best (more varied)
    // Path 2: 80% best, 20% second-best (more direct)
    const bestMoveProbability = 0.7 - (pathVariation * 0.1) + (pathVariation === 2 ? 0.2 : 0);
    
    let chosenMove: Vector2;
    if (topCandidates.length > 1 && Math.random() < (1 - bestMoveProbability)) {
      chosenMove = topCandidates[1].move;
    } else {
      chosenMove = topCandidates[0].move;
    }
    
    // Apply move
    const newPos = { x: current.x + chosenMove.x, y: current.y + chosenMove.y };
    const newDist = Math.abs(end.x - newPos.x) + Math.abs(end.y - newPos.y);
    
    // Track progress
    if (newDist < currentDist) {
      stepsWithoutProgress = 0;
    } else {
      stepsWithoutProgress++;
    }
    
    current = newPos;
    path.push({ ...current });
    visited.add(`${current.x},${current.y}`);
    lastDirection = chosenMove;
    
    // If we're making no progress for too long, force direct move toward goal
    // Reduced threshold to allow more winding
    if (stepsWithoutProgress > 3) {
      // Force a move that makes progress
      const forceMoves = validMoves.filter(move => {
        const testPos = { x: current.x + move.x, y: current.y + move.y };
        const testDist = Math.abs(end.x - testPos.x) + Math.abs(end.y - testPos.y);
        return testDist < currentDist;
      });
      
      if (forceMoves.length > 0) {
        const directMove = forceMoves[Math.floor(Math.random() * forceMoves.length)];
        current.x += directMove.x;
        current.y += directMove.y;
        path.push({ ...current });
        visited.add(`${current.x},${current.y}`);
        lastDirection = directMove;
        stepsWithoutProgress = 0;
      }
    }
  }
  
  // Ensure we reached the end (if not, add final direct steps)
  if (path[path.length - 1].x !== end.x || path[path.length - 1].y !== end.y) {
    const last = path[path.length - 1];
    let finalX = last.x;
    let finalY = last.y;
    
    while (finalX !== end.x || finalY !== end.y) {
      if (finalX < end.x) finalX++;
      else if (finalX > end.x) finalX--;
      if (finalY < end.y) finalY++;
      else if (finalY > end.y) finalY--;
      
      const key = `${finalX},${finalY}`;
      if (!visited.has(key)) {
        path.push({ x: finalX, y: finalY });
        visited.add(key);
      }
    }
  }
  
  return path;
}

/**
 * Adds minimal visual variety - keeps paths thin and winding
 * Only adds very rare, short dead-end branches
 */
function addMinimalVariety(grid: number[][], path: Vector2[]): void {
  // Very rarely add tiny dead-end branches (like small alcoves)
  // This is much less aggressive than before - keeps paths thin
  for (let i = 5; i < path.length - 5; i += 7) {
    const tile = path[i];
    
    // Only 10% chance to add a branch, and only 1 tile long
    if (Math.random() < 0.1) {
      const directions = [
        { x: 1, y: 0 }, { x: -1, y: 0 },
        { x: 0, y: 1 }, { x: 0, y: -1 }
      ];
      const direction = directions[Math.floor(Math.random() * directions.length)];
      
      const branchX = tile.x + direction.x;
      const branchY = tile.y + direction.y;
      
      // Only add branch if it's in bounds and would be a wall (not already floor)
      if (branchX >= 0 && branchX < REQUIRED_LEVEL_WIDTH &&
          branchY >= 0 && branchY < REQUIRED_LEVEL_HEIGHT &&
          grid[branchY][branchX] === 1) {
        grid[branchY][branchX] = 0;
      }
    }
  }
}

/**
 * Generates robot spawns for the level based on level number
 * Robots spawn on hallway tiles, never within 3 tiles of start
 * 
 * @param grid The level grid (0 = floor, 1 = wall)
 * @param startPosition The start position
 * @param levelNumber The level number (1+)
 * @returns Array of robot spawns
 */
function generateRobotSpawns(
  grid: number[][],
  startPosition: Vector2,
  levelNumber: number
): RobotSpawn[] {
  const spawns: RobotSpawn[] = [];
  
  // Find all valid spawn positions (floor tiles, not within 3 tiles of start)
  const validSpawnPositions: Vector2[] = [];
  const minDistanceFromStart = 3;
  
  for (let y = 0; y < REQUIRED_LEVEL_HEIGHT; y++) {
    for (let x = 0; x < REQUIRED_LEVEL_WIDTH; x++) {
      // Must be a floor tile
      if (grid[y][x] === 0) {
        // Calculate Manhattan distance from start
        const distance = Math.abs(x - startPosition.x) + Math.abs(y - startPosition.y);
        if (distance >= minDistanceFromStart) {
          // Special rule for level 1: bots cannot spawn on x < 6 (gives players time to get ready)
          if (levelNumber === 1 && x < 6) {
            continue;
          }
          validSpawnPositions.push({ x, y });
        }
      }
    }
  }
  
  // If no valid positions, return empty (shouldn't happen with proper path generation)
  if (validSpawnPositions.length === 0) {
    return spawns;
  }
  
  // Determine robot types and counts based on level
  const robotPlans = determineRobotSpawnPlan(levelNumber);
  
  // Shuffle valid positions to randomize spawn locations
  const shuffledPositions = [...validSpawnPositions].sort(() => Math.random() - 0.5);
  
  let positionIndex = 0;
  
  // Spawn robots according to plan
  for (const plan of robotPlans) {
    // Robots can spawn right next to each other - no spacing requirement
    if (positionIndex < shuffledPositions.length) {
      const position = shuffledPositions[positionIndex];
      spawns.push({
        type: plan.type,
        position: position
      });
      positionIndex++;
    }
  }
  
  // Ensure at least one robot spawns (guarantee requirement)
  if (spawns.length === 0 && shuffledPositions.length > 0) {
    spawns.push({
      type: RobotType.SPIDER_BOT,
      position: shuffledPositions[0]
    });
  }
  
  return spawns;
}

/**
 * Determines the robot spawn plan based on level number
 * Returns an array of robot types to spawn
 */
function determineRobotSpawnPlan(levelNumber: number): Array<{ type: RobotType }> {
  const plan: Array<{ type: RobotType }> = [];
  
  // Base scaling: higher levels get more robots
  // Formula: base count increases with level, with some randomness
  
  if (levelNumber === 1) {
    // Level 1: 1 spider bot guaranteed
    plan.push({ type: RobotType.SPIDER_BOT });
  } else if (levelNumber === 2) {
    // Level 2: 1 spider bot guaranteed, 50% chance shock bot
    plan.push({ type: RobotType.SPIDER_BOT });
    if (Math.random() < 0.5) {
      plan.push({ type: RobotType.SHOCK_BOT });
    }
  } else if (levelNumber === 3) {
    // Level 3: 1 spider, 1 shock, chance of flame bot
    plan.push({ type: RobotType.SPIDER_BOT });
    plan.push({ type: RobotType.SHOCK_BOT });
    
    // 60% chance for flame bot on level 3
    if (Math.random() < 0.6) {
      plan.push({ type: RobotType.FLAME_BOT });
    }
  } else {
    // Level 4+: All three types can spawn
    // Scaling formula: base robots = 1 + floor(level / 3)
    // Minimum 2 robots, scales up with level
    
    const baseRobotCount = 1 + Math.floor(levelNumber / 3);
    const minRobots = Math.max(2, baseRobotCount);
    const maxRobots = Math.min(8, minRobots + 2); // Cap at 8 robots
    
    // Random robot count within range
    const robotCount = minRobots + Math.floor(Math.random() * (maxRobots - minRobots + 1));
    
    // Distribution weights based on difficulty:
    // Spider (easy): 40% of spawns
    // Shock (medium): 35% of spawns  
    // Flame (hard): 25% of spawns
    // Higher levels shift more toward harder enemies
    
    const spiderWeight = Math.max(0.25, 0.4 - (levelNumber - 4) * 0.02);
    const shockWeight = 0.35;
    const flameWeight = Math.min(0.4, 0.25 + (levelNumber - 4) * 0.02);
    
    for (let i = 0; i < robotCount; i++) {
      const rand = Math.random();
      if (rand < spiderWeight) {
        plan.push({ type: RobotType.SPIDER_BOT });
      } else if (rand < spiderWeight + shockWeight) {
        plan.push({ type: RobotType.SHOCK_BOT });
      } else {
        plan.push({ type: RobotType.FLAME_BOT });
      }
    }
    
    // Ensure at least one of each type can appear (if level high enough)
    if (levelNumber >= 5 && plan.length >= 3) {
      const hasSpider = plan.some(r => r.type === RobotType.SPIDER_BOT);
      const hasShock = plan.some(r => r.type === RobotType.SHOCK_BOT);
      const hasFlame = plan.some(r => r.type === RobotType.FLAME_BOT);
      
      // If we have room and missing a type, add it
      if (!hasSpider && plan.length < maxRobots) {
        plan.push({ type: RobotType.SPIDER_BOT });
      }
      if (!hasShock && plan.length < maxRobots) {
        plan.push({ type: RobotType.SHOCK_BOT });
      }
      if (!hasFlame && plan.length < maxRobots) {
        plan.push({ type: RobotType.FLAME_BOT });
      }
    }
    
    // Shuffle the plan for variety
    plan.sort(() => Math.random() - 0.5);
  }
  
  return plan;
}

