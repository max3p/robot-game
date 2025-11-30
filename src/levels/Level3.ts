import { LevelData, RobotType, WeaponType } from '../types';

export const Level3: LevelData = {
  id: 3,
  name: 'Tutorial 3',
  message: 'Player 3: Use the EMP gun to disable the shock bot!',
  message2: 'Hint: Stand next to a downed player to revive them.',
  tileSize: 96,
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 1, 1, 0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 1, 1, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  startPosition: { x: 1, y: 4 },
  exitPosition: { x: 8, y: 7 },
  robots: [
    {
      type: RobotType.SHOCK_BOT,
      position: { x: 5, y: 3 }
    },
  ],
  groundItems: [
  ]
};

