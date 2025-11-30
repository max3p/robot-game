import Phaser from 'phaser';
import { SPIDER_LANTERN_RADIUS, SPIDER_LIGHT_COLOR } from '../config/constants';

/**
 * Lantern - Permanent pink point light created when spider-bot dies
 * Phase 4.2: Lantern creation
 */
export class Lantern extends Phaser.GameObjects.Arc {
  public lightRadius: number = SPIDER_LANTERN_RADIUS;
  public lightColor: number = SPIDER_LIGHT_COLOR;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Create a small pink circle to represent the lantern
    // Arc parameters: scene, x, y, radius, startAngle, endAngle, anticlockwise, fillColor
    super(scene, x, y, 12, 0, 360, false, SPIDER_LIGHT_COLOR);
    
    scene.add.existing(this);
    
    // Set depth so lantern renders above floor but below players
    this.setDepth(15);
    
    // Lantern is permanent - never destroyed
  }
}

