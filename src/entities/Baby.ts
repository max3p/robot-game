import Phaser from 'phaser';
import { BABY_RADIUS, CALM_METER_MAX, CALM_METER_DRAIN_RATE, CALM_METER_FILL_RATE, BABY_COLOR, PLAYER_RADIUS } from '../config/constants';
import { Player } from './Player';

export class Baby extends Phaser.GameObjects.Arc {
  public holder: Player | null = null;
  public calmMeter: number = CALM_METER_MAX;
  private calmMeterBarBg?: Phaser.GameObjects.Rectangle;
  private calmMeterBarFill?: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, BABY_RADIUS, 0, 360, false, BABY_COLOR);
    scene.add.existing(this);
    this.setVisible(false); // Hidden by default, shown when held
    this.setDepth(100); // Render above players
  }

  setHolder(holder: Player | null) {
    this.holder = holder;
    // Baby is visible when held OR when on ground
    this.setVisible(true);
    
    if (holder) {
      // Create calm meter bar when baby is held
      this.createCalmMeterBar();
    } else {
      // Remove calm meter bar when baby is dropped
      this.destroyCalmMeterBar();
    }
  }

  placeOnGround(x: number, y: number) {
    this.setHolder(null);
    this.setPosition(x, y);
    this.setVisible(true);
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
    this.calmMeter = Phaser.Math.Clamp(this.calmMeter, 0, CALM_METER_MAX);

    // Update position to be offset on holder
    if (this.holder) {
      const offsetY = -PLAYER_RADIUS - 5; // Slightly above player
      this.setPosition(this.holder.x, this.holder.y + offsetY);
    }

    // Update calm meter bar
    this.updateCalmMeterBar();
  }

  private createCalmMeterBar() {
    if (!this.holder) return;

    const barWidth = 40;
    const barHeight = 6;
    const barY = this.holder.y - PLAYER_RADIUS - 20; // Above the player

    // Background bar (gray)
    this.calmMeterBarBg = this.scene.add.rectangle(
      this.holder.x,
      barY,
      barWidth,
      barHeight,
      0x333333
    ).setDepth(1000);

    // Foreground bar (will be updated each frame)
    this.calmMeterBarFill = this.scene.add.rectangle(
      this.holder.x,
      barY,
      barWidth,
      barHeight,
      0x00FF00
    ).setDepth(1001);
  }

  private updateCalmMeterBar() {
    if (!this.calmMeterBarFill || !this.holder || !this.calmMeterBarBg) return;

    const barWidth = 40;
    const barHeight = 6;
    const barY = this.holder.y - PLAYER_RADIUS - 20;

    // Update background bar position
    this.calmMeterBarBg.setPosition(this.holder.x, barY);

    const meterPercent = this.calmMeter / CALM_METER_MAX;
    const fillWidth = barWidth * meterPercent;

    // Color: green when high, yellow in middle, red when low
    let barColor = 0x00FF00; // Green
    if (meterPercent < 0.5) {
      barColor = 0xFF0000; // Red
    } else if (meterPercent < 0.75) {
      barColor = 0xFFFF00; // Yellow
    }

    // Update fill bar position, width, and color
    this.calmMeterBarFill.setPosition(this.holder.x - barWidth / 2 + fillWidth / 2, barY);
    this.calmMeterBarFill.setSize(fillWidth, barHeight);
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
  }

  destroy() {
    this.destroyCalmMeterBar();
    super.destroy();
  }
}

