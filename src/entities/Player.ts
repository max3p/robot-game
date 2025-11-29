import Phaser from 'phaser';
import { BASE_PLAYER_SPEED, BABY_HOLDER_SPEED, PLAYER_RADIUS, PLAYER_COLORS, PLAYER_MASS, PLAYER_BOUNCE, PLAYER_PUSH_SPEED_MULTIPLIER, PLAYER_PUSH_SPEED_MULTIPLIER_MULTIPLE } from '../config/constants';
import { PLAYER_CONTROLS } from '../config/controls';
import { Baby } from './Baby';
import { Weapon } from './Weapon';

export class Player extends Phaser.GameObjects.Arc {
  public body!: Phaser.Physics.Arcade.Body;
  public playerId: number;
  public heldBaby: Baby | null = null;
  public heldWeapon: Weapon | null = null;
  public facingDirection: { x: number; y: number } = { x: 0, y: -1 }; // Default facing up
  public pushingPlayers: Set<Player> = new Set(); // Track players we're currently pushing
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
    this.body.setCollideWorldBounds(false); // We'll handle bounds manually with custom bounds
    this.body.setMass(PLAYER_MASS);
    this.body.setBounce(PLAYER_BOUNCE, PLAYER_BOUNCE);
    this.body.setImmovable(false); // Players can be pushed
    
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
      
      // Base speed depends on holding baby
      let baseSpeed = this.heldBaby ? BABY_HOLDER_SPEED : BASE_PLAYER_SPEED;
      
      // Reduce speed when pushing other players
      const numPushing = this.pushingPlayers.size;
      if (numPushing > 1) {
        baseSpeed *= PLAYER_PUSH_SPEED_MULTIPLIER_MULTIPLE;
      } else if (numPushing === 1) {
        baseSpeed *= PLAYER_PUSH_SPEED_MULTIPLIER;
      }
      
      velocityX = (moveX / length) * baseSpeed;
      velocityY = (moveY / length) * baseSpeed;
      
      // Update facing direction based on movement
      this.facingDirection = { x: moveX / length, y: moveY / length };
    }
    
    // Set velocity
    this.body.setVelocity(velocityX, velocityY);
    
    // Clear pushing players at end of frame (will be updated by collision callbacks)
    this.pushingPlayers.clear();
  }

  setHeldBaby(baby: Baby | null) {
    // Clear weapon if holding one
    if (baby && this.heldWeapon) {
      this.setHeldWeapon(null);
    }
    this.heldBaby = baby;
    if (baby) {
      baby.setHolder(this);
    }
  }

  setHeldWeapon(weapon: Weapon | null) {
    // Clear baby if holding one
    if (weapon && this.heldBaby) {
      this.setHeldBaby(null);
    }
    this.heldWeapon = weapon;
    if (weapon) {
      weapon.setHolder(this);
    }
  }

  // Get the currently held item (baby or weapon)
  getHeldItem(): Baby | Weapon | null {
    return this.heldBaby || this.heldWeapon || null;
  }
}

