import { LevelData, RobotType, WeaponType } from '../types';

export const Level1: LevelData = {
  id: 1,
  name: 'Awakening',
  tileSize: 96,
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  startPosition: { x: 1, y: 1 },
  exitPosition: { x: 8, y: 8 },
  robots: [
    {
      type: RobotType.SHOCK_BOT,
      position: { x: 5, y: 2 }
    }
  ],
  groundItems: [
    {
      type: WeaponType.EMP_GUN,
      position: { x: 2, y: 1 },
      forPlayerCount: [1, 2]
    },
    {
      type: WeaponType.WATER_GUN,
      position: { x: 3, y: 1 },
      forPlayerCount: [1, 2, 3]
    }
  ]
};

