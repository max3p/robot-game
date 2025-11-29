import { Vector2 } from '../types';

/**
 * Node for A* pathfinding algorithm
 */
interface PathNode {
  x: number; // Tile x coordinate
  y: number; // Tile y coordinate
  g: number; // Cost from start
  h: number; // Heuristic cost to goal
  f: number; // Total cost (g + h)
  parent: PathNode | null;
}

/**
 * Finds a path from start tile to goal tile using A* algorithm
 * @param grid The level grid (0 = floor, 1 = wall)
 * @param startTile Start position in tile coordinates
 * @param goalTile Goal position in tile coordinates
 * @returns Array of tile coordinates representing the path, or empty array if no path found
 */
export function findPath(
  grid: number[][],
  startTile: Vector2,
  goalTile: Vector2
): Vector2[] {
  // Validate inputs
  if (!grid || grid.length === 0 || grid[0].length === 0) {
    return [];
  }

  const gridHeight = grid.length;
  const gridWidth = grid[0].length;

  // Check if start or goal is out of bounds
  if (
    startTile.x < 0 || startTile.x >= gridWidth ||
    startTile.y < 0 || startTile.y >= gridHeight ||
    goalTile.x < 0 || goalTile.x >= gridWidth ||
    goalTile.y < 0 || goalTile.y >= gridHeight
  ) {
    return [];
  }

  // Check if start or goal is a wall
  if (grid[startTile.y][startTile.x] === 1 || grid[goalTile.y][goalTile.x] === 1) {
    return [];
  }

  // If start equals goal, return empty path (already there)
  if (startTile.x === goalTile.x && startTile.y === goalTile.y) {
    return [];
  }

  // Initialize open and closed sets
  const openSet: PathNode[] = [];
  const closedSet: Set<string> = new Set();

  // Helper to create a node key for set lookup
  const nodeKey = (x: number, y: number): string => `${x},${y}`;

  // Helper to check if a tile is valid (within bounds and not a wall)
  const isValidTile = (x: number, y: number): boolean => {
    return (
      x >= 0 && x < gridWidth &&
      y >= 0 && y < gridHeight &&
      grid[y][x] === 0 // 0 = floor (walkable)
    );
  };

  // Helper to calculate Manhattan distance (heuristic)
  const manhattanDistance = (a: Vector2, b: Vector2): number => {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  };

  // Helper to get neighbors (4-directional: up, down, left, right)
  const getNeighbors = (node: PathNode): Vector2[] => {
    const neighbors: Vector2[] = [];
    const directions = [
      { x: 0, y: -1 }, // Up
      { x: 0, y: 1 },  // Down
      { x: -1, y: 0 }, // Left
      { x: 1, y: 0 }   // Right
    ];

    for (const dir of directions) {
      const nx = node.x + dir.x;
      const ny = node.y + dir.y;
      if (isValidTile(nx, ny)) {
        neighbors.push({ x: nx, y: ny });
      }
    }

    return neighbors;
  };

  // Helper to find node in open set
  const findInOpenSet = (x: number, y: number): PathNode | null => {
    return openSet.find(n => n.x === x && n.y === y) || null;
  };

  // Create start node
  const startNode: PathNode = {
    x: startTile.x,
    y: startTile.y,
    g: 0,
    h: manhattanDistance(startTile, goalTile),
    f: 0,
    parent: null
  };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);

  // A* main loop
  while (openSet.length > 0) {
    // Find node with lowest f score
    let currentIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[currentIndex].f) {
        currentIndex = i;
      }
    }

    const current = openSet[currentIndex];

    // Check if we reached the goal
    if (current.x === goalTile.x && current.y === goalTile.y) {
      // Reconstruct path
      const path: Vector2[] = [];
      let node: PathNode | null = current;
      
      while (node !== null) {
        path.unshift({ x: node.x, y: node.y }); // Add to front
        node = node.parent;
      }
      
      // Remove start node from path (we're already there)
      path.shift();
      
      return path;
    }

    // Move current from open to closed
    openSet.splice(currentIndex, 1);
    closedSet.add(nodeKey(current.x, current.y));

    // Check all neighbors
    const neighbors = getNeighbors(current);
    for (const neighborPos of neighbors) {
      const neighborKey = nodeKey(neighborPos.x, neighborPos.y);

      // Skip if already in closed set
      if (closedSet.has(neighborKey)) {
        continue;
      }

      // Calculate tentative g score
      const tentativeG = current.g + 1; // Each step costs 1

      // Check if this neighbor is already in open set
      const existingNode = findInOpenSet(neighborPos.x, neighborPos.y);
      
      if (existingNode) {
        // If this path is better, update the existing node
        if (tentativeG < existingNode.g) {
          existingNode.g = tentativeG;
          existingNode.f = existingNode.g + existingNode.h;
          existingNode.parent = current;
        }
      } else {
        // New node, add to open set
        const h = manhattanDistance(neighborPos, goalTile);
        const newNode: PathNode = {
          x: neighborPos.x,
          y: neighborPos.y,
          g: tentativeG,
          h: h,
          f: tentativeG + h,
          parent: current
        };
        openSet.push(newNode);
      }
    }
  }

  // No path found
  return [];
}

/**
 * Converts a tile coordinate path to world coordinates
 * @param path Path in tile coordinates
 * @param tileSize Size of each tile in pixels
 * @param levelOffsetX X offset of level in world coordinates
 * @param levelOffsetY Y offset of level in world coordinates
 * @returns Path in world coordinates (centers of tiles)
 */
export function pathToWorldCoordinates(
  path: Vector2[],
  tileSize: number,
  levelOffsetX: number,
  levelOffsetY: number
): Vector2[] {
  return path.map(tile => ({
    x: levelOffsetX + (tile.x * tileSize) + (tileSize / 2),
    y: levelOffsetY + (tile.y * tileSize) + (tileSize / 2)
  }));
}
