import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { LevelData } from '../types';
import { Level1 } from '../levels/Level1';
import { createOverlay, createInteractiveButton } from '../utils/uiHelpers';
import { TEXT_STYLE_TITLE, TEXT_STYLE_SUBTITLE, TEXT_STYLE_BUTTON, OVERLAY_ALPHA } from '../config/uiConstants';

export interface LevelCompleteData {
  levelData: LevelData;
  nextLevelData?: LevelData; // Optional next level (for future use)
}

export class LevelCompleteScene extends Phaser.Scene {
  private levelCompleteData!: LevelCompleteData;
  private nextLevelButton?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'LevelCompleteScene' });
  }

  init(data?: LevelCompleteData) {
    // Store level complete data (current level and next level)
    // Default to Level1 if data is not provided (shouldn't happen in normal gameplay)
    this.levelCompleteData = data || {
      levelData: Level1,
      nextLevelData: Level1 // For now, next level is the same level
    };
  }

  create(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // Background overlay
    createOverlay(this, OVERLAY_ALPHA);

    // Level Complete title
    this.add.text(centerX, centerY - 100, 'LEVEL COMPLETE!', {
      ...TEXT_STYLE_TITLE,
      color: '#00FF00'
    }).setOrigin(0.5, 0.5);

    // Level name
    this.add.text(centerX, centerY, this.levelCompleteData.levelData.name, {
      ...TEXT_STYLE_SUBTITLE,
      color: '#FFFFFF'
    }).setOrigin(0.5, 0.5);

    // Next Level button (for now, restarts the same level)
    const nextLevelData = this.levelCompleteData.nextLevelData || this.levelCompleteData.levelData;
    
    this.nextLevelButton = createInteractiveButton(
      this,
      centerX,
      centerY + 100,
      'NEXT LEVEL',
      {
        ...TEXT_STYLE_BUTTON,
        color: '#00FF00'
      },
      '#00CC00',
      () => {
        // Load next level (for now, restarts the same level)
        this.scene.start('GameScene', { levelData: nextLevelData });
      }
    );

    console.log(`🎉 Level Complete: ${this.levelCompleteData.levelData.name}`);
  }
}
