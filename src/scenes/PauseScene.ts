import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { LevelData } from '../types';
import { Level1 } from '../levels/Level1';
import { createOverlay, createInteractiveButton } from '../utils/uiHelpers';
import { TEXT_STYLE_TITLE, TEXT_STYLE_BUTTON, OVERLAY_ALPHA } from '../config/uiConstants';

export interface PauseData {
  levelData: LevelData;
  playerCount?: number;
}

/**
 * Pause Scene - Pause menu overlay
 */
export class PauseScene extends Phaser.Scene {
  private pauseData!: PauseData;
  private escapeKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'PauseScene' });
  }

  init(data?: PauseData) {
    // Store pause data (level data and player count for restart)
    this.pauseData = data || {
      levelData: Level1,
      playerCount: 4
    };
  }

  create(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // Background overlay
    createOverlay(this, OVERLAY_ALPHA);

    // Pause title
    this.add.text(centerX, centerY - 100, 'PAUSED', {
      ...TEXT_STYLE_TITLE,
      color: '#FFFFFF'
    }).setOrigin(0.5, 0.5);

    // Resume button
    createInteractiveButton(
      this,
      centerX,
      centerY,
      'RESUME',
      {
        ...TEXT_STYLE_BUTTON,
        color: '#00FF00'
      },
      '#00CC00',
      () => {
        this.resumeGame();
      }
    );

    // Restart Level button
    createInteractiveButton(
      this,
      centerX,
      centerY + 80,
      'RESTART LEVEL',
      {
        ...TEXT_STYLE_BUTTON,
        color: '#FFFFFF'
      },
      '#CCCCCC',
      () => {
        this.restartLevel();
      }
    );

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
        this.goToMainMenu();
      }
    );

    // Set up Escape key to unpause
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escapeKey.on('down', () => {
      this.resumeGame();
    });

    console.log('⏸️ Game paused');
  }

  /**
   * Resumes the game by stopping the pause scene
   */
  private resumeGame(): void {
    // Get GameScene and update its pause state
    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      // Emit event to GameScene to update pause state
      gameScene.events.emit('unpause');
    }
    this.scene.stop('PauseScene');
    console.log('▶️ Game resumed');
  }

  /**
   * Restarts the current level
   */
  private restartLevel(): void {
    // Stop pause scene and UIScene, then restart GameScene
    this.scene.stop('PauseScene');
    if (this.scene.isActive('UIScene')) {
      this.scene.stop('UIScene');
    }
    this.scene.start('GameScene', {
      levelData: this.pauseData.levelData,
      playerCount: this.pauseData.playerCount || 4
    });
    console.log('🔄 Level restarted');
  }

  /**
   * Returns to main menu
   */
  private goToMainMenu(): void {
    // Stop pause scene and go to menu
    this.scene.stop('PauseScene');
    this.scene.stop('GameScene'); // Stop GameScene
    this.scene.start('MenuScene');
    console.log('📋 Returned to main menu');
  }
}

