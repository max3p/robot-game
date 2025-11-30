/**
 * UI Helper Functions
 * Utility functions for UI rendering and management
 * Designed to be reusable and prepare for future UIScene implementation
 */

import Phaser from 'phaser';
import { 
  HEART_SIZE, 
  HEART_SPACING, 
  PLAYER_SPACING, 
  MARGIN_TOP, 
  MARGIN_LEFT,
  HEART_OUTLINE_COLOR,
  UI_DEPTH_HEARTS
} from '../config/uiConstants';
import { MAX_PLAYER_HEARTS, PLAYER_COLORS } from '../config/constants';
import { Player } from '../entities/Player';

/**
 * Draws a heart shape on a graphics object
 * @param graphics Graphics object to draw on
 * @param x X position (center)
 * @param y Y position (center)
 * @param size Size of the heart
 * @param color Color of the heart
 * @param filled Whether to fill the heart or just draw outline
 */
export function drawHeart(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
  filled: boolean
): void {
  const halfSize = size / 2;
  const radius = halfSize * 0.5;

  // Heart shape: two circles on top, triangle on bottom
  // Left circle center
  const leftCircleX = x - halfSize * 0.5;
  const leftCircleY = y - halfSize * 0.3;
  
  // Right circle center
  const rightCircleX = x + halfSize * 0.5;
  const rightCircleY = y - halfSize * 0.3;
  
  // Triangle point (bottom of heart)
  const pointX = x;
  const pointY = y + halfSize * 0.5;

  if (filled) {
    // Draw filled heart
    graphics.fillStyle(color, 1);
    graphics.fillCircle(leftCircleX, leftCircleY, radius);
    graphics.fillCircle(rightCircleX, rightCircleY, radius);
    graphics.fillTriangle(
      leftCircleX - radius, leftCircleY,
      rightCircleX + radius, rightCircleY,
      pointX, pointY
    );
  } else {
    // Draw outline heart (gray)
    graphics.lineStyle(2, color, 1);
    graphics.strokeCircle(leftCircleX, leftCircleY, radius);
    graphics.strokeCircle(rightCircleX, rightCircleY, radius);
    graphics.beginPath();
    graphics.moveTo(leftCircleX - radius, leftCircleY);
    graphics.lineTo(rightCircleX + radius, rightCircleY);
    graphics.lineTo(pointX, pointY);
    graphics.closePath();
    graphics.strokePath();
  }
}

/**
 * Renders hearts UI for all players
 * @param graphics Graphics object to render on
 * @param players Array of players to render hearts for
 */
export function renderHeartsUI(graphics: Phaser.GameObjects.Graphics, players: Player[]): void {
  graphics.clear();
  graphics.setDepth(UI_DEPTH_HEARTS);

  // Draw hearts for each player
  players.forEach((player, playerIndex) => {
    const playerColor = PLAYER_COLORS[player.playerId - 1];
    const startX = MARGIN_LEFT + playerIndex * (MAX_PLAYER_HEARTS * (HEART_SIZE + HEART_SPACING) + PLAYER_SPACING);
    const startY = MARGIN_TOP;

    // Draw hearts (filled for remaining, outline for lost)
    for (let i = 0; i < MAX_PLAYER_HEARTS; i++) {
      const heartX = startX + i * (HEART_SIZE + HEART_SPACING);
      const heartY = startY;
      const hasHeart = i < player.hearts;

      if (hasHeart) {
        // Draw filled heart
        drawHeart(graphics, heartX, heartY, HEART_SIZE, playerColor, true);
      } else {
        // Draw outline heart (gray)
        drawHeart(graphics, heartX, heartY, HEART_SIZE, HEART_OUTLINE_COLOR, false);
      }
    }
  });
}

/**
 * Creates an interactive button with hover effects
 * @param scene Phaser scene
 * @param x X position
 * @param y Y position
 * @param text Button text
 * @param style Text style
 * @param hoverColor Color when hovering
 * @param onClick Callback when clicked
 * @returns Created text button
 */
export function createInteractiveButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
  hoverColor: string,
  onClick: () => void
): Phaser.GameObjects.Text {
  const button = scene.add.text(x, y, text, style)
    .setOrigin(0.5, 0.5)
    .setInteractive({ useHandCursor: true });

  const defaultColor = style.color || '#FFFFFF';

  // Button hover effect
  button.on('pointerover', () => {
    button.setStyle({ color: hoverColor });
  });

  button.on('pointerout', () => {
    button.setStyle({ color: defaultColor });
  });

  button.on('pointerdown', onClick);

  return button;
}

/**
 * Creates a semi-transparent overlay background
 * @param scene Phaser scene
 * @param alpha Alpha value (0-1)
 * @param color Color of the overlay (default: black)
 * @returns Created rectangle overlay
 */
export function createOverlay(
  scene: Phaser.Scene,
  alpha: number = 0.7,
  color: number = 0x000000
): Phaser.GameObjects.Rectangle {
  const { width, height } = scene.scale;
  return scene.add.rectangle(width / 2, height / 2, width, height, color, alpha);
}
