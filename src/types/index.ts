export interface Vector2 {
  x: number;
  y: number;
}

export interface LevelData {
  id: number;
  name: string;
  grid: number[][]; // 0 = floor, 1 = wall
  tileSize: number;
  startPosition: Vector2; // tile coordinates
  exitPosition: Vector2; // tile coordinates
  robots: RobotSpawn[];
  groundItems: ItemSpawn[];
}

export interface RobotSpawn {
  type: RobotType;
  position: Vector2; // tile coordinates
}

export interface ItemSpawn {
  type: WeaponType;
  position: Vector2; // tile coordinates
  forPlayerCount: number[];
}

export enum RobotType {
  SPIDER_BOT = 'SPIDER_BOT',
  SHOCK_BOT = 'SHOCK_BOT',
  FLAME_BOT = 'FLAME_BOT'
}

export enum WeaponType {
  GOO_GUN = 'GOO_GUN',
  EMP_GUN = 'EMP_GUN',
  WATER_GUN = 'WATER_GUN'
}

export enum RobotState {
  PATROL = 'PATROL',
  ALERT = 'ALERT',
  ATTACKING = 'ATTACKING',
  INVESTIGATING = 'INVESTIGATING',
  DISABLED = 'DISABLED',
  DEAD = 'DEAD'
}

