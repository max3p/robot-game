import Phaser from 'phaser';
import { BASE_PLAYER_SPEED, BABY_HOLDER_SPEED, PLAYER_RADIUS, PLAYER_COLORS, PLAYER_MASS, PLAYER_BOUNCE, PLAYER_PUSH_SPEED_MULTIPLIER, PLAYER_PUSH_SPEED_MULTIPLIER_MULTIPLE, WEAPON_RANGE, DEBUG_MODE, MAX_PLAYER_HEARTS, INVINCIBILITY_DURATION, PLAYER_FLASH_DURATION, GOD_MODE } from '../config/constants';
import { PLAYER_CONTROLS } from '../config/controls';
import { Baby } from './Baby';
import { Weapon } from './Weapon';

export class Player extends Phaser.GameObjects.Arc {
  declare public body: Phaser.Physics.Arcade.Body;
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
  
  // Health system
  public hearts: number = MAX_PLAYER_HEARTS;
  public isInvincible: boolean = false;
  private invincibilityTimer: number = 0;
  private flashTimer: number = 0;
  private isFlashing: boolean = false;
  
  // Downed state (Phase 4.8)
  public isDowned: boolean = false;
  
  // Debug visual for weapon range (only created if DEBUG_MODE is enabled)
  private weaponRangeCircle?: Phaser.GameObjects.Graphics;

  /**
   * Creates a new Player instance
   * @param scene The Phaser scene this player belongs to
   * @param x Initial X position in world coordinates
   * @param y Initial Y position in world coordinates
   * @param playerId Player ID (1-4)
   */
  constructor(scene: Phaser.Scene, x: number, y: number, playerId: number) {
    // Validate player ID
    if (playerId < 1 || playerId > 4) {
      console.warn(`Invalid player ID: ${playerId}. Must be between 1 and 4. Defaulting to 1.`);
      playerId = 1;
    }
    
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
    
    // Create debug visual for weapon range if debug mode is enabled
    if (DEBUG_MODE) {
      this.createWeaponRangeVisual();
    }
  }

  /**
   * Creates debug visual showing weapon attack range
   */
  private createWeaponRangeVisual(): void {
    this.weaponRangeCircle = this.scene.add.graphics();
    this.weaponRangeCircle.setDepth(3); // Below player but above floor
    this.updateWeaponRangeVisual();
  }

  /**
   * Updates the weapon range debug visual
   */
  private updateWeaponRangeVisual(): void {
    if (!this.weaponRangeCircle || !DEBUG_MODE) {
      return;
    }

    this.weaponRangeCircle.clear();

    // Only show range if player is holding a weapon
    if (this.heldWeapon) {
      // Draw weapon range circle
      this.weaponRangeCircle.lineStyle(2, 0xFFFFFF, 0.4); // White, 40% opacity outline
      this.weaponRangeCircle.strokeCircle(this.x, this.y, this.heldWeapon.range);
      
      // Fill with very low opacity
      this.weaponRangeCircle.fillStyle(0xFFFFFF, 0.1); // White, 10% opacity fill
      this.weaponRangeCircle.fillCircle(this.x, this.y, this.heldWeapon.range);
    }
  }

  /**
   * Destroys the weapon range debug visual
   */
  private destroyWeaponRangeVisual(): void {
    if (this.weaponRangeCircle) {
      this.weaponRangeCircle.destroy();
      this.weaponRangeCircle = undefined;
    }
  }

  update(delta?: number) {
    // If downed, stop all movement and return early
    if (this.isDowned) {
      this.body.setVelocity(0, 0);
      return;
    }
    
    // Update invincibility timer
    if (this.isInvincible && delta !== undefined) {
      this.invincibilityTimer -= delta;
      if (this.invincibilityTimer <= 0) {
        this.isInvincible = false;
        this.invincibilityTimer = 0;
        // Only restore full opacity if not downed
        if (!this.isDowned) {
          this.setAlpha(1);
        }
        this.isFlashing = false;
      } else {
        // Update flashing effect
        this.flashTimer -= delta;
        if (this.flashTimer <= 0) {
          this.isFlashing = !this.isFlashing;
          this.flashTimer = PLAYER_FLASH_DURATION;
          // Toggle visibility during flash (but respect downed state opacity)
          if (!this.isDowned) {
            this.setAlpha(this.isFlashing ? 0.3 : 1);
          }
        }
      }
    }
    
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
    
    // Update weapon range debug visual if it exists
    if (DEBUG_MODE && this.weaponRangeCircle) {
      this.updateWeaponRangeVisual();
    }
    
    // Clear pushing players at end of frame (will be updated by collision callbacks)
    this.pushingPlayers.clear();
  }

  /**
   * Sets the baby held by this player. Automatically clears weapon if holding one.
   * @param baby The baby to hold, or null to drop current baby
   */
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

  /**
   * Sets the weapon held by this player. Automatically clears baby if holding one.
   * @param weapon The weapon to hold, or null to drop current weapon
   */
  setHeldWeapon(weapon: Weapon | null) {
    // Clear baby if holding one
    if (weapon && this.heldBaby) {
      this.setHeldBaby(null);
    }
    this.heldWeapon = weapon;
    if (weapon) {
      weapon.setHolder(this);
    }
    
    // Update weapon range visual when weapon changes
    if (DEBUG_MODE) {
      this.updateWeaponRangeVisual();
    }
  }
  
  /**
   * Cleanup method to destroy debug visuals
   */
  destroy() {
    this.destroyWeaponRangeVisual();
    super.destroy();
  }

  /**
   * Gets the currently held item (baby or weapon)
   * @returns The held item, or null if no item is held
   */
  getHeldItem(): Baby | Weapon | null {
    return this.heldBaby || this.heldWeapon || null;
  }

  /**
   * Takes damage from a robot attack
   * @param damage Amount of damage to take (default 1)
   * @returns true if damage was applied, false if invincible
   */
  takeDamage(damage: number = 1): boolean {
    // Don't take damage if invincible or already downed
    if (this.isInvincible || this.isDowned) {
      return false;
    }

    // Reduce hearts (unless GOD_MODE is enabled)
    if (!GOD_MODE) {
      this.hearts = Math.max(0, this.hearts - damage);
      
      if (DEBUG_MODE) {
        console.log(`💔 Player ${this.playerId} took ${damage} damage. Hearts remaining: ${this.hearts}/${MAX_PLAYER_HEARTS}`);
      }

      // Check if player should enter downed state (Phase 4.8)
      if (this.hearts <= 0) {
        this.enterDownedState();
        return true;
      }
    } else {
      if (DEBUG_MODE) {
        console.log(`🛡️ Player ${this.playerId} took ${damage} damage but GOD_MODE is enabled - no hearts lost.`);
      }
    }

    // Apply invincibility
    this.isInvincible = true;
    this.invincibilityTimer = INVINCIBILITY_DURATION;
    this.flashTimer = PLAYER_FLASH_DURATION;
    this.isFlashing = true;
    this.setAlpha(0.3); // Start with reduced opacity

    // Trigger baby cry if player is baby holder (Phase 4.7 / Phase 5.1)
    if (this.heldBaby) {
      // Start baby crying (will emit event and handle timer)
      this.heldBaby.startCrying();
      
      if (DEBUG_MODE) {
        console.log(`😭 Baby cried! Player ${this.playerId} took damage while holding baby.`);
      }
    }

    return true;
  }

  /**
   * Enters the downed state (Phase 4.8)
   * Player cannot move, is rendered at 50% opacity
   * Player keeps their held item (no dropping)
   */
  private enterDownedState(): void {
    if (this.isDowned) {
      return; // Already downed
    }

    this.isDowned = true;
    this.isInvincible = false; // Clear invincibility
    this.invincibilityTimer = 0;
    this.isFlashing = false;
    
    // Set opacity to 50%
    this.setAlpha(0.5);
    
    // Stop movement
    this.body.setVelocity(0, 0);
    
    // Player keeps their held item - no dropping
    if (DEBUG_MODE) {
      const itemType = this.heldBaby ? 'Baby' : (this.heldWeapon ? this.heldWeapon.weaponType : 'nothing');
      console.log(`💀 Player ${this.playerId} entered DOWNED state (keeping ${itemType})`);
    }
  }

  /**
   * Checks if the player is dead (no hearts remaining)
   * @returns true if player has no hearts
   */
  isDead(): boolean {
    return this.hearts <= 0;
  }
}

