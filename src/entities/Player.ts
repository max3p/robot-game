import Phaser from 'phaser';
import { BASE_PLAYER_SPEED, PLAYER_RADIUS, PLAYER_COLORS } from '../config/constants';
import { PLAYER_CONTROLS } from '../config/controls';

export class Player extends Phaser.GameObjects.Arc {
  public body!: Phaser.Physics.Arcade.Body;
  public playerId: number;
  private movementKeys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene, x: number, y: number, playerId: number) {
    const playerColor = PLAYER_COLORS[playerId - 1];
    super(scene, x, y, PLAYER_RADIUS, 0, 360, false, playerColor);
    
    this.playerId = playerId;
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Set up physics body
    this.body.setCircle(PLAYER_RADIUS);
    this.body.setCollideWorldBounds(false); // We'll handle bounds manually
    
    // Set up input based on player controls
    const controlConfig = PLAYER_CONTROLS[playerId as keyof typeof PLAYER_CONTROLS];
    const keyboard = scene.input.keyboard!;
    
    // Handle arrow keys separately from letter keys
    if (playerId === 4) {
      // Player 4 uses arrow keys
      this.movementKeys = {
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)
      };
    } else {
      // Players 1-3 use letter keys
      const keys = keyboard.addKeys(`${controlConfig.up},${controlConfig.down},${controlConfig.left},${controlConfig.right}`) as any;
      this.movementKeys = {
        up: keys[controlConfig.up],
        down: keys[controlConfig.down],
        left: keys[controlConfig.left],
        right: keys[controlConfig.right]
      };
    }
  }

  update() {
    // Get movement input
    const moveX = (this.movementKeys.right.isDown ? 1 : 0) - (this.movementKeys.left.isDown ? 1 : 0);
    const moveY = (this.movementKeys.down.isDown ? 1 : 0) - (this.movementKeys.up.isDown ? 1 : 0);
    
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

