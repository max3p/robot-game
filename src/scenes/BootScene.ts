import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { TEXT_STYLE_TITLE } from '../config/uiConstants';

/**
 * Boot Scene - Handles asset loading with progress bar
 */
export class BootScene extends Phaser.Scene {
  private loadingBar?: Phaser.GameObjects.Graphics;
  private loadingBarBg?: Phaser.GameObjects.Graphics;
  private loadingText?: Phaser.GameObjects.Text;
  private progressText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // Create loading bar background
    this.loadingBarBg = this.add.graphics();
    this.loadingBarBg.fillStyle(0x333333, 1);
    this.loadingBarBg.fillRect(centerX - 200, centerY + 50, 400, 30);

    // Create loading bar
    this.loadingBar = this.add.graphics();

    // Create loading text
    this.loadingText = this.add.text(centerX, centerY - 50, 'LOADING...', {
      ...TEXT_STYLE_TITLE,
      color: '#FFFFFF',
      fontSize: '48px'
    }).setOrigin(0.5, 0.5);

    // Create progress text
    this.progressText = this.add.text(centerX, centerY + 100, '0%', {
      fontSize: '24px',
      color: '#FFFFFF'
    }).setOrigin(0.5, 0.5);

    // Listen for file progress events
    this.load.on('progress', (value: number) => {
      this.updateLoadingBar(value);
    });

    // Listen for complete event
    this.load.on('complete', () => {
      this.onLoadComplete();
    });

    // Load all game assets
    this.loadAssets();
  }

  /**
   * Loads all game assets
   */
  private loadAssets(): void {
    // Load menu cover image
    this.load.image('tabula-cover', '/tabula-cover.png');

    // Placeholder for future sprites/assets
    // Add more assets here as they are created
    // Example:
    // this.load.image('player-sprite', 'assets/player.png');
    // this.load.image('robot-sprite', 'assets/robot.png');
    // etc.
  }

  /**
   * Updates the loading bar based on progress
   */
  private updateLoadingBar(progress: number): void {
    if (!this.loadingBar) return;

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const barWidth = 400;
    const barHeight = 30;
    const barX = centerX - barWidth / 2;
    const barY = centerY + 50;

    // Clear previous bar
    this.loadingBar.clear();

    // Draw progress bar
    this.loadingBar.fillStyle(0x00FF00, 1);
    this.loadingBar.fillRect(barX, barY, barWidth * progress, barHeight);

    // Update progress text
    if (this.progressText) {
      this.progressText.setText(`${Math.round(progress * 100)}%`);
    }
  }

  /**
   * Called when all assets are loaded
   */
  private onLoadComplete(): void {
    // Update progress to 100%
    if (this.progressText) {
      this.progressText.setText('100%');
    }

    // Small delay to show 100% before transitioning
    this.time.delayedCall(300, () => {
      this.scene.start('MenuScene');
    });
  }

  create() {
    // This should not be called if preload() is defined
    // But keeping as fallback
    this.scene.start('MenuScene');
  }
}

