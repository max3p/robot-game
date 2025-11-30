import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { LevelData } from '../types';
import { Level1 } from '../levels/Level1';

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

  create() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // Background overlay (semi-transparent black)
    this.add.rectangle(centerX, centerY, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);

    // Game Over title
    const titleText = this.add.text(centerX, centerY - 100, 'GAME OVER', {
      fontSize: '64px',
      color: '#FF0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5, 0.5);

    // Reason message (e.g., "Baby holder down!")
    const reasonText = this.add.text(centerX, centerY, this.gameOverData.reason, {
      fontSize: '32px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5, 0.5);

    // Retry button
    this.retryButton = this.add.text(centerX, centerY + 100, 'RETRY LEVEL', {
      fontSize: '32px',
      color: '#00FF00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#1a1a1a',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    // Button hover effect
    this.retryButton.on('pointerover', () => {
      this.retryButton!.setStyle({ color: '#00CC00' });
    });

    this.retryButton.on('pointerout', () => {
      this.retryButton!.setStyle({ color: '#00FF00' });
    });

    // Retry button click handler
    this.retryButton.on('pointerdown', () => {
      // Restart the level by starting GameScene with the level data
      this.scene.start('GameScene', { levelData: this.gameOverData.levelData });
    });

    console.log(`💀 Game Over: ${this.gameOverData.reason}`);
  }
}
