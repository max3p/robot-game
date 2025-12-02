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

    // Load player run spritesheets (20x120px, 6 frames of 20x20px each)
    this.load.spritesheet('player-run-up', '/sprites/player-run-up.png', {
      frameWidth: 20,
      frameHeight: 20
    });
    this.load.spritesheet('player-run-down', '/sprites/player-run-down.png', {
      frameWidth: 20,
      frameHeight: 20
    });
    this.load.spritesheet('player-run-left', '/sprites/player-run-left.png', {
      frameWidth: 20,
      frameHeight: 20
    });
    this.load.spritesheet('player-run-right', '/sprites/player-run-right.png', {
      frameWidth: 20,
      frameHeight: 20
    });
  }

  /**
   * Creates animations from loaded spritesheets
   * Called after assets are loaded
   */
  createAnimations(): void {
    // Create animations for each direction (6 frames, 10fps)
    this.anims.create({
      key: 'player-run-up',
      frames: this.anims.generateFrameNumbers('player-run-up', { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'player-run-down',
      frames: this.anims.generateFrameNumbers('player-run-down', { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'player-run-left',
      frames: this.anims.generateFrameNumbers('player-run-left', { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'player-run-right',
      frames: this.anims.generateFrameNumbers('player-run-right', { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1
    });
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

    // Create animations from loaded spritesheets
    this.createAnimations();

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

