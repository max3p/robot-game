import { LevelData } from '../types';
import { REQUIRED_LEVEL_WIDTH, REQUIRED_LEVEL_HEIGHT } from '../config/constants';

/**
 * Validates that a level has the correct dimensions
 * @param levelData The level data to validate
 * @throws Error if level dimensions are incorrect
 */
export function validateLevelDimensions(levelData: LevelData): void {
  const grid = levelData.grid;
  
  // Check if grid exists and has rows
  if (!grid || grid.length === 0) {
    throw new Error(`Level ${levelData.id} (${levelData.name}): Grid is empty or undefined`);
  }
  
  // Check height (number of rows)
  if (grid.length !== REQUIRED_LEVEL_HEIGHT) {
    throw new Error(
      `Level ${levelData.id} (${levelData.name}): Invalid height. ` +
      `Expected ${REQUIRED_LEVEL_HEIGHT} rows, got ${grid.length}`
    );
  }
  
  // Check width (number of columns) - all rows must have the same width
  const expectedWidth = REQUIRED_LEVEL_WIDTH;
  for (let row = 0; row < grid.length; row++) {
    if (!grid[row] || grid[row].length !== expectedWidth) {
      throw new Error(
        `Level ${levelData.id} (${levelData.name}): Invalid width at row ${row}. ` +
        `Expected ${expectedWidth} columns, got ${grid[row]?.length || 0}`
      );
    }
  }
}

