import Phaser from 'phaser';
import { WeaponType } from '../types';
import { GOO_GUN_COLOR, EMP_GUN_COLOR, WATER_GUN_COLOR, PLAYER_RADIUS } from '../config/constants';
import { Player } from './Player';

export class Weapon extends Phaser.GameObjects.Graphics {
  public weaponType: WeaponType;
  public holder: Player | null = null;
  private triangleShape: Phaser.Geom.Triangle;
  private baseWidth = 20;
  private height = 30;

  constructor(scene: Phaser.Scene, weaponType: WeaponType, x: number, y: number) {
    super(scene);
    this.weaponType = weaponType;
    this.triangleShape = new Phaser.Geom.Triangle();
    
    scene.add.existing(this);
    this.setPosition(x, y);
    
    // Set depth so weapon renders above player
    this.setDepth(50);
    
    // Initial render (pointing up when on ground)
    this.renderTriangle(0, -1); // Point up when on ground
  }

  setHolder(holder: Player | null) {
    this.holder = holder;
    // Weapon is always visible (when held or on ground)
    this.setVisible(true);
  }

  update() {
    if (this.holder) {
      // When held: position at holder and point in facing direction
      this.setPosition(this.holder.x, this.holder.y);
      this.renderTriangle(this.holder.facingDirection.x, this.holder.facingDirection.y);
    } else {
      // When on ground: point upward and stay at current position
      this.renderTriangle(0, -1);
    }
  }

  private renderTriangle(dirX: number, dirY: number) {
    this.clear();
    
    // Get weapon color based on type
    const color = this.getWeaponColor();
    this.fillStyle(color);
    
    // Calculate angle from direction vector
    const angle = Math.atan2(dirY, dirX);
    
    // Create triangle points
    // Triangle points forward in the direction, with base perpendicular
    const tipX = Math.cos(angle) * (this.height / 2);
    const tipY = Math.sin(angle) * (this.height / 2);
    
    // Base points are perpendicular to the direction
    const baseDirX = -Math.sin(angle);
    const baseDirY = Math.cos(angle);
    const halfBase = this.baseWidth / 2;
    
    const basePoint1X = Math.cos(angle) * (-this.height / 2) + baseDirX * halfBase;
    const basePoint1Y = Math.sin(angle) * (-this.height / 2) + baseDirY * halfBase;
    
    const basePoint2X = Math.cos(angle) * (-this.height / 2) - baseDirX * halfBase;
    const basePoint2Y = Math.sin(angle) * (-this.height / 2) - baseDirY * halfBase;
    
    // Draw triangle (centered at 0,0 since we position the graphic itself)
    this.triangleShape.setTo(tipX, tipY, basePoint1X, basePoint1Y, basePoint2X, basePoint2Y);
    this.fillTriangleShape(this.triangleShape);
  }

  private getWeaponColor(): number {
    switch (this.weaponType) {
      case WeaponType.GOO_GUN:
        return GOO_GUN_COLOR;
      case WeaponType.EMP_GUN:
        return EMP_GUN_COLOR;
      case WeaponType.WATER_GUN:
        return WATER_GUN_COLOR;
      default:
        return 0xFFFFFF;
    }
  }

  // Method to place weapon on ground at a position
  placeOnGround(x: number, y: number) {
    this.setHolder(null);
    this.setPosition(x, y);
  }
}

