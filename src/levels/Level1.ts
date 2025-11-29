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
      type: RobotType.SPIDER_BOT,
      position: { x: 5, y: 2 },
      patrolPath: [
        { x: 5, y: 2 },
        { x: 5, y: 4 },
        { x: 3, y: 4 },
        { x: 3, y: 2 }
      ]
    },
    {
      type: RobotType.SPIDER_BOT,
      position: { x: 7, y: 5 },
      patrolPath: [
        { x: 7, y: 5 },
        { x: 7, y: 8 },
        { x: 5, y: 8 },
        { x: 5, y: 5 }
      ]
    },
    {
      type: RobotType.SPIDER_BOT,
      position: { x: 2, y: 7 },
      patrolPath: [
        { x: 2, y: 7 },
        { x: 2, y: 5 },
        { x: 4, y: 5 }
      ]
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

