import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { createOverlay, createInteractiveButton } from '../utils/uiHelpers';
import { TEXT_STYLE_TITLE, TEXT_STYLE_SUBTITLE, TEXT_STYLE_BUTTON, OVERLAY_ALPHA } from '../config/uiConstants';

/**
 * Victory Scene - Shown when all levels are completed
 */
export class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VictoryScene' });
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

    // Victory title
    this.add.text(centerX, centerY - 100, 'VICTORY!', {
      ...TEXT_STYLE_TITLE,
      color: '#FFD700',
      fontSize: '72px'
    }).setOrigin(0.5, 0.5);

    // Congratulations message
    this.add.text(centerX, centerY - 20, 'Congratulations!', {
      ...TEXT_STYLE_SUBTITLE,
      color: '#FFFFFF',
      fontSize: '36px'
    }).setOrigin(0.5, 0.5);

    this.add.text(centerX, centerY + 20, 'You have completed all levels!', {
      ...TEXT_STYLE_SUBTITLE,
      color: '#FFFFFF',
      fontSize: '24px'
    }).setOrigin(0.5, 0.5);

    // Main Menu button
    createInteractiveButton(
      this,
      centerX,
      centerY + 120,
      'MAIN MENU',
      {
        ...TEXT_STYLE_BUTTON,
        color: '#00FF00',
        fontSize: '36px'
      },
      '#00CC00',
      () => {
        this.scene.start('MenuScene');
      }
    );

    console.log('🏆 Victory! All levels completed!');
  }
}

