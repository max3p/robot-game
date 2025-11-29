import Phaser from 'phaser';
import { BASE_PLAYER_SPEED, PLAYER_RADIUS, PLAYER_COLOR_P1 } from '../config/constants';

export class Player extends Phaser.GameObjects.Arc {
  public body!: Phaser.Physics.Arcade.Body;
  private wasdKeys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, PLAYER_RADIUS, 0, 360, false, PLAYER_COLOR_P1);
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Set up physics body
    this.body.setCircle(PLAYER_RADIUS);
    this.body.setCollideWorldBounds(false); // We'll handle bounds manually
    
    // Set up input - WASD for Player 1
    const keys = scene.input.keyboard!.addKeys('W,S,A,D') as any;
    this.wasdKeys = {
      up: keys.W,
      down: keys.S,
      left: keys.A,
      right: keys.D
    };
  }

  update() {
    // Get movement input
    const moveX = (this.wasdKeys.right.isDown ? 1 : 0) - (this.wasdKeys.left.isDown ? 1 : 0);
    const moveY = (this.wasdKeys.down.isDown ? 1 : 0) - (this.wasdKeys.up.isDown ? 1 : 0);
    
    // Normalize diagonal movement to prevent faster diagonal speed
    let velocityX = 0;
    let velocityY = 0;
    
    if (moveX !== 0 || moveY !== 0) {
      const length = Math.sqrt(moveX * moveX + moveY * moveY);
      velocityX = (moveX / length) * BASE_PLAYER_SPEED;
      velocityY = (moveY / length) * BASE_PLAYER_SPEED;
    }
    
    // Set velocity
    this.body.setVelocity(velocityX, velocityY);
  }
}

