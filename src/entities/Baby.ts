import Phaser from 'phaser';
import { BABY_RADIUS, CALM_METER_MAX, CALM_METER_DRAIN_RATE, CALM_METER_FILL_RATE, BABY_COLOR, PLAYER_RADIUS, CALM_METER_BAR_WIDTH, CALM_METER_BAR_HEIGHT, CALM_METER_BAR_OFFSET_Y, BABY_OFFSET_Y } from '../config/constants';
import { Player } from './Player';

export class Baby extends Phaser.GameObjects.Arc {
  public holder: Player | null = null;
  public calmMeter: number = CALM_METER_MAX;
  public isCrying: boolean = false; // True when baby is crying (calm meter at 0)
  private calmMeterBarBg?: Phaser.GameObjects.Rectangle;
  private calmMeterBarFill?: Phaser.GameObjects.Rectangle;
  private hasLoggedDepletion: boolean = false;
  private cryIndicator?: Phaser.GameObjects.Text; // UI indicator for crying

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, BABY_RADIUS, 0, 360, false, BABY_COLOR);
    scene.add.existing(this);
    this.setVisible(false); // Hidden by default, shown when held
    this.setDepth(100); // Render above players
  }

  /**
   * Sets the player holding this baby. Creates/destroys calm meter bar accordingly.
   * @param holder The player holding the baby, or null if dropped
   */
  setHolder(holder: Player | null) {
    // Always destroy existing calm meter bar first to prevent duplicates
    this.destroyCalmMeterBar();
    
    this.holder = holder;
    // Baby is visible when held OR when on ground
    this.setVisible(true);
    
    if (holder) {
      // Create calm meter bar when baby is held by new holder
      this.createCalmMeterBar();
    }
  }

  /**
   * Places the baby on the ground at the specified position
   * @param x World X coordinate
   * @param y World Y coordinate
   */
  placeOnGround(x: number, y: number) {
    const previousHolder = this.holder?.playerId || null;
    this.setHolder(null);
    this.setPosition(x, y);
    this.setVisible(true);
    if (previousHolder) {
      console.log(`📦 Baby placed on ground at (${x.toFixed(0)}, ${y.toFixed(0)}) by Player ${previousHolder}`);
    }
  }

  update(delta: number) {
    if (!this.holder) {
      return; // Baby not held, no updates needed
    }

    // Update calm meter based on holder movement
    const isMoving = this.holder.body.velocity.x !== 0 || this.holder.body.velocity.y !== 0;
    const deltaSeconds = delta / 1000; // Convert ms to seconds

    if (isMoving) {
      // Drain calm meter when moving
      this.calmMeter -= CALM_METER_DRAIN_RATE * deltaSeconds;
    } else {
      // Fill calm meter when stationary
      this.calmMeter += CALM_METER_FILL_RATE * deltaSeconds;
    }

    // Clamp calm meter between 0 and MAX
    const previousMeter = this.calmMeter;
    this.calmMeter = Phaser.Math.Clamp(this.calmMeter, 0, CALM_METER_MAX);
    
    // Check if calm meter just hit 0 (baby starts crying)
    if (this.calmMeter === 0 && previousMeter > 0) {
      this.isCrying = true;
      
      // Emit baby-cried event (Phase 4.7)
      if (this.holder) {
        this.scene.events.emit('baby-cried', {
          x: this.x,
          y: this.y
        });
        
        if (!this.hasLoggedDepletion) {
          this.hasLoggedDepletion = true;
          console.log(`😭 Baby calm meter depleted! Baby is crying (Player ${this.holder.playerId})`);
        }
      }
    }
    
    // Check if calm meter recovered (baby stops crying)
    if (this.calmMeter > 0 && this.isCrying) {
      this.isCrying = false;
      this.hasLoggedDepletion = false;
    }
    
    // Update cry indicator visibility
    this.updateCryIndicator();

    // Update position to be offset on holder
    if (this.holder) {
      const offsetY = -PLAYER_RADIUS + BABY_OFFSET_Y; // Slightly above player
      this.setPosition(this.holder.x, this.holder.y + offsetY);
    }

    // Update calm meter bar
    this.updateCalmMeterBar();
  }

  private createCalmMeterBar() {
    if (!this.holder) return;

    const barY = this.holder.y - PLAYER_RADIUS + CALM_METER_BAR_OFFSET_Y; // Above the player

    // Background bar (gray)
    this.calmMeterBarBg = this.scene.add.rectangle(
      this.holder.x,
      barY,
      CALM_METER_BAR_WIDTH,
      CALM_METER_BAR_HEIGHT,
      0x333333
    ).setDepth(1000);

    // Foreground bar (will be updated each frame)
    this.calmMeterBarFill = this.scene.add.rectangle(
      this.holder.x,
      barY,
      CALM_METER_BAR_WIDTH,
      CALM_METER_BAR_HEIGHT,
      0x00FF00
    ).setDepth(1001);
    
    // Create cry indicator text
    this.createCryIndicator();
  }
  
  private createCryIndicator() {
    if (!this.holder) return;
    
    const indicatorY = this.holder.y - PLAYER_RADIUS + CALM_METER_BAR_OFFSET_Y - 20; // Above calm meter bar
    
    this.cryIndicator = this.scene.add.text(
      this.holder.x,
      indicatorY,
      '😭 CRYING!',
      {
        fontSize: '16px',
        color: '#FF0000',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }
    ).setOrigin(0.5, 0.5).setDepth(1002).setVisible(false);
  }
  
  private updateCryIndicator() {
    if (!this.cryIndicator || !this.holder) return;
    
    const indicatorY = this.holder.y - PLAYER_RADIUS + CALM_METER_BAR_OFFSET_Y - 20;
    this.cryIndicator.setPosition(this.holder.x, indicatorY);
    this.cryIndicator.setVisible(this.isCrying);
  }

  private updateCalmMeterBar() {
    if (!this.calmMeterBarFill || !this.holder || !this.calmMeterBarBg) return;

    const barY = this.holder.y - PLAYER_RADIUS + CALM_METER_BAR_OFFSET_Y;

    // Update background bar position
    this.calmMeterBarBg.setPosition(this.holder.x, barY);

    const meterPercent = this.calmMeter / CALM_METER_MAX;
    const fillWidth = CALM_METER_BAR_WIDTH * meterPercent;

    // Color: green when high, yellow in middle, red when low
    let barColor = 0x00FF00; // Green
    if (meterPercent < 0.5) {
      barColor = 0xFF0000; // Red
    } else if (meterPercent < 0.75) {
      barColor = 0xFFFF00; // Yellow
    }

    // Update fill bar position, width, and color
    this.calmMeterBarFill.setPosition(this.holder.x - CALM_METER_BAR_WIDTH / 2 + fillWidth / 2, barY);
    this.calmMeterBarFill.setSize(fillWidth, CALM_METER_BAR_HEIGHT);
    this.calmMeterBarFill.setFillStyle(barColor);
  }

  private destroyCalmMeterBar() {
    if (this.calmMeterBarFill) {
      this.calmMeterBarFill.destroy();
      this.calmMeterBarFill = undefined;
    }
    if (this.calmMeterBarBg) {
      this.calmMeterBarBg.destroy();
      this.calmMeterBarBg = undefined;
    }
    if (this.cryIndicator) {
      this.cryIndicator.destroy();
      this.cryIndicator = undefined;
    }
  }

  destroy() {
    this.destroyCalmMeterBar();
    super.destroy();
  }
}

