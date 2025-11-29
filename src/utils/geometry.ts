import { Vector2 } from '../types';

/**
 * Calculate distance between two points
 */
export function distance(a: Vector2, b: Vector2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalize a vector to unit length
 */
export function normalize(v: Vector2): Vector2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * Get angle of vector in radians (-PI to PI)
 */
export function vectorToAngle(v: Vector2): number {
  return Math.atan2(v.y, v.x);
}

/**
 * Convert angle to unit vector
 */
export function angleToVector(angle: number): Vector2 {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle)
  };
}

/**
 * Normalize angle to range -PI to PI
 */
export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Check if point is within a cone
 * @param origin - Origin point of the cone
 * @param direction - Direction the cone faces (unit vector)
 * @param angle - Total cone angle in radians
 * @param radius - Cone radius/length
 * @param point - Point to check
 */
export function isPointInCone(
  origin: Vector2,
  direction: Vector2,
  angle: number,
  radius: number,
  point: Vector2
): boolean {
  // Check distance first
  const dist = distance(origin, point);
  if (dist > radius) return false;
  
  // Get vector to point
  const toPoint: Vector2 = {
    x: point.x - origin.x,
    y: point.y - origin.y
  };
  
  // Get angles
  const dirAngle = vectorToAngle(direction);
  const pointAngle = vectorToAngle(toPoint);
  
  // Check if within cone angle
  const angleDiff = Math.abs(normalizeAngle(pointAngle - dirAngle));
  return angleDiff <= angle / 2;
}

/**
 * Check line of sight between two points against wall grid
 * Uses simple grid-based raycasting
 * @param from - Starting position (world coordinates)
 * @param to - Target position (world coordinates)
 * @param grid - Level grid (0 = floor, 1 = wall)
 * @param tileSize - Size of each tile in pixels
 * @param levelOffsetX - X offset of level in world coordinates
 * @param levelOffsetY - Y offset of level in world coordinates
 */
export function hasLineOfSight(
  from: Vector2,
  to: Vector2,
  grid: number[][],
  tileSize: number,
  levelOffsetX: number = 0,
  levelOffsetY: number = 0
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist / (tileSize / 2));
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    
    // Convert world coordinates to tile coordinates
    const tileX = Math.floor((x - levelOffsetX) / tileSize);
    const tileY = Math.floor((y - levelOffsetY) / tileSize);
    
    // Check bounds
    if (tileY < 0 || tileY >= grid.length || 
        tileX < 0 || tileX >= grid[0].length) {
      return false;
    }
    
    // Check wall
    if (grid[tileY][tileX] === 1) {
      return false;
    }
  }
  
  return true;
}

