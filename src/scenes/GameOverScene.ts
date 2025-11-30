import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { LevelData } from '../types';
import { Level1 } from '../levels/Level1';
import { createOverlay, createInteractiveButton } from '../utils/uiHelpers';
import { TEXT_STYLE_TITLE, TEXT_STYLE_SUBTITLE, TEXT_STYLE_BUTTON, OVERLAY_ALPHA, BUTTON_HOVER_COLOR_DARKEN } from '../config/uiConstants';

export interface GameOverData {
  reason: string;
  levelData: LevelData;
}

export class GameOverScene extends Phaser.Scene {
  private gameOverData!: GameOverData;
  private retryButton?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data?: GameOverData) {
    // Store game over data (reason and level data for retry)
    // Default to Level1 if data is not provided (shouldn't happen in normal gameplay)
    this.gameOverData = data || {
      reason: 'Game Over',
      levelData: Level1
    };
  }

  create(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // Background overlay
    createOverlay(this, OVERLAY_ALPHA);

    // Game Over title
    this.add.text(centerX, centerY - 100, 'GAME OVER', {
      ...TEXT_STYLE_TITLE,
      color: '#FF0000'
    }).setOrigin(0.5, 0.5);

    // Reason message (e.g., "Baby holder down!")
    this.add.text(centerX, centerY, this.gameOverData.reason, {
      ...TEXT_STYLE_SUBTITLE,
      color: '#FFFFFF'
    }).setOrigin(0.5, 0.5);

    // Retry button
    this.retryButton = createInteractiveButton(
      this,
      centerX,
      centerY + 100,
      'RETRY LEVEL',
      {
        ...TEXT_STYLE_BUTTON,
        color: '#00FF00'
      },
      '#00CC00',
      () => {
        // Restart the level by starting GameScene with the level data
        this.scene.start('GameScene', { levelData: this.gameOverData.levelData });
      }
    );

    console.log(`💀 Game Over: ${this.gameOverData.reason}`);
  }
}
