import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    // Boot scene transitions to MenuScene
    // In later phases, this will handle asset loading
    this.scene.start('MenuScene');
  }
}

