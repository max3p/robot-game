import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    // Boot scene is a placeholder that immediately transitions to GameScene
    // In later phases, this will handle asset loading
    this.scene.start('GameScene');
  }
}

