import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { LevelData } from '../types';
import { Level1 } from '../levels/Level1';
import { createOverlay, createInteractiveButton } from '../utils/uiHelpers';
import { TEXT_STYLE_TITLE, TEXT_STYLE_SUBTITLE, TEXT_STYLE_BUTTON, OVERLAY_ALPHA } from '../config/uiConstants';

export interface LevelCompleteData {
  levelData: LevelData;
  nextLevelData?: LevelData; // Optional next level (undefined if all levels complete)
  playerCount?: number; // Player count to pass to next level
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
      nextLevelData: undefined
    };
  }

  create(): void {
    // Stop UIScene if it's still running (from GameScene)
    if (this.scene.isActive('UIScene')) {
      this.scene.stop('UIScene');
    }

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

    // Check if there's a next level or if all levels are complete
    const nextLevelData = this.levelCompleteData.nextLevelData;
    const playerCount = this.levelCompleteData.playerCount || 4;

    if (nextLevelData) {
      // There's a next level - show Next Level button
      this.nextLevelButton = createInteractiveButton(
        this,
        centerX,
        centerY + 80,
        'NEXT LEVEL',
        {
          ...TEXT_STYLE_BUTTON,
          color: '#00FF00'
        },
        '#00CC00',
        () => {
          // Load next level with same player count
          this.scene.start('GameScene', { 
            levelData: nextLevelData,
            playerCount: playerCount
          });
        }
      );
    } else {
      // All levels complete - show Victory button
      this.nextLevelButton = createInteractiveButton(
        this,
        centerX,
        centerY + 80,
        'VICTORY!',
        {
          ...TEXT_STYLE_BUTTON,
          color: '#FFD700',
          fontSize: '36px'
        },
        '#FFA500',
        () => {
          // Show victory scene
          this.scene.start('VictoryScene');
        }
      );
    }

    // Main Menu button
    createInteractiveButton(
      this,
      centerX,
      centerY + 140,
      'MAIN MENU',
      {
        ...TEXT_STYLE_BUTTON,
        color: '#FFFFFF'
      },
      '#CCCCCC',
      () => {
        this.scene.start('MenuScene');
      }
    );

    console.log(`🎉 Level Complete: ${this.levelCompleteData.levelData.name}`);
  }
}
