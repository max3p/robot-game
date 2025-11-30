import { LevelData, RobotType, WeaponType } from '../types';

export const Level2: LevelData = {
  id: 2,
  name: 'Tutorial 2',
  message: 'Player 2: Use the goo gun to defeat the spider bot!',
  message2: 'Hint: Stand next to a player to swap weapons.',
  tileSize: 96,
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 1, 1],
    [0, 0, 0, 1, 1, 1, 1, 0, 0, 1],
    [0, 0, 0, 1, 1, 1, 1, 0, 0, 1],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 0, 0, 0, 0, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  startPosition: { x: 1, y: 4 },
  exitPosition: { x: 8, y: 2 },
  robots: [
    {
      type: RobotType.SPIDER_BOT,
      position: { x: 7, y: 6 }
    },
  ],
  groundItems: [
  ]
};

