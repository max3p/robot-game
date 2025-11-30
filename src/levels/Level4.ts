import { LevelData, RobotType, WeaponType } from '../types';

export const Level4: LevelData = {
  id: 4,
  name: 'Tutorial 4',
  message: 'Player 4: Use the water gun to extinguish the flame bot!',
  message2: 'Hint: Don\'t let the baby get hurt!',
  tileSize: 96,
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 1, 1, 0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 1, 0, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 1, 0, 0, 0, 0, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  startPosition: { x: 1, y: 4 },
  exitPosition: { x: 9, y: 5 },
  robots: [
    {
      type: RobotType.FLAME_BOT,
      position: { x: 5, y: 3 }
    },
  ],
  groundItems: [
  ]
};

