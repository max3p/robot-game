import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_COLORS, MAX_PLAYER_HEARTS } from '../config/constants';
import { PLAYER_CONTROLS } from '../config/controls';
import { drawHeart } from '../utils/uiHelpers';
import { Player } from '../entities/Player';

/**
 * UI Scene - HUD overlay that displays on top of GameScene
 * Displays hearts, calm meter, and control keys for each player
 */
export class UIScene extends Phaser.Scene {
  private heartsGraphics!: Phaser.GameObjects.Graphics;
  private playerUIElements: Array<{
    border?: Phaser.GameObjects.Graphics;
    label?: Phaser.GameObjects.Text;
    keyBoxes?: Phaser.GameObjects.Rectangle[];
    keyTexts?: Phaser.GameObjects.Text[];
  }> = [];
  private levelMessageText?: Phaser.GameObjects.Text;
  private levelMessage2Text?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    // Set this scene to run in parallel with GameScene
    // UIScene should be launched by GameScene, so it's already active
    
    // Create graphics for hearts
    this.heartsGraphics = this.add.graphics();
    this.heartsGraphics.setDepth(1000);
    
    // Listen for player updates from GameScene
    this.events.on('update-players', this.updatePlayers.bind(this));
    
    // Listen for level message updates from GameScene
    this.events.on('update-level-message', this.updateLevelMessage.bind(this));
    this.events.on('update-level-message2', this.updateLevelMessage2.bind(this));
    
    // Initialize player UI elements array
    this.playerUIElements = [];
  }

  /**
   * Updates the UI based on current player states
   * Called from GameScene via event
   */
  private updatePlayers(players: Player[]) {
    if (!players || players.length === 0) {
      return;
    }

    // Clean up UI elements for players that no longer exist
    while (this.playerUIElements.length > players.length) {
      const elements = this.playerUIElements.pop();
      if (elements) {
        if (elements.border) elements.border.destroy();
        if (elements.label) elements.label.destroy();
        if (elements.keyBoxes) elements.keyBoxes.forEach(box => box.destroy());
        if (elements.keyTexts) elements.keyTexts.forEach(text => text.destroy());
      }
    }

    // Ensure we have enough UI element slots
    while (this.playerUIElements.length < players.length) {
      this.playerUIElements.push({});
    }

    // Clear previous hearts
    this.heartsGraphics.clear();
    
    // Calculate spacing to evenly distribute across full width
    const totalWidth = GAME_WIDTH;
    const margin = 40; // Margin on each side
    const availableWidth = totalWidth - (margin * 2);
    
    // Calculate width per player section
    const sectionWidth = availableWidth / players.length;
    const sectionPadding = 10; // Padding inside each section
    
    // Render UI for each player, evenly spaced
    players.forEach((player, playerIndex) => {
      const playerColor = PLAYER_COLORS[player.playerId - 1];
      
      // Center of this player's section
      const sectionCenterX = margin + (playerIndex + 0.5) * sectionWidth;
      const sectionTop = 10;
      const sectionPadding = 12; // Padding inside each section
      
      // Calculate column positions for 2-column layout
      const columnSpacing = 20; // Space between left and right columns
      const leftColumnWidth = 100; // Width for left column (label + hearts)
      const rightColumnWidth = 60; // Width for right column (keys)
      
      const leftColumnX = sectionCenterX - (leftColumnWidth + columnSpacing + rightColumnWidth) / 2 + leftColumnWidth / 2;
      const rightColumnX = sectionCenterX + (leftColumnWidth + columnSpacing + rightColumnWidth) / 2 - rightColumnWidth / 2;
      
      // Column 1: Draw "Player X" label at top
      const labelY = sectionTop + 8;
      this.drawPlayerLabel(playerIndex, leftColumnX, labelY, player.playerId);
      
      // Column 1: Draw hearts below label
      const heartsStartY = labelY + 40;
      const heartsBounds = this.drawHearts(player, playerIndex, leftColumnX, heartsStartY, playerColor);
      
      // Column 2: Draw control keys (aligned to top with label)
      const keysY = labelY + 14; // 4 pixels down from previous position
      const keysX = rightColumnX - 8; // 8 pixels to the left
      const keysBounds = this.drawControlKeys(player, playerIndex, keysX, keysY, playerColor);
      
      // Calculate actual content dimensions for border
      const labelHeight = 8;
      const leftColumnHeight = labelHeight + 8 + heartsBounds.height;
      const rightColumnHeight = keysBounds.height;
      const contentHeight = Math.max(leftColumnHeight, rightColumnHeight) + 24; // Add bottom padding
      const contentWidth = leftColumnWidth + columnSpacing + rightColumnWidth;
      
      // Draw border around player section
      this.drawPlayerBorder(playerIndex, sectionCenterX, sectionTop, contentWidth + sectionPadding * 2, contentHeight, playerColor);
    });
  }

  /**
   * Draws a border around a player's UI section
   */
  private drawPlayerBorder(
    playerIndex: number,
    centerX: number,
    top: number,
    width: number,
    height: number,
    color: number
  ) {
    const elements = this.playerUIElements[playerIndex];
    
    if (!elements.border) {
      elements.border = this.add.graphics();
      elements.border.setDepth(999);
    }
    
    elements.border.clear();
    elements.border.lineStyle(2, color, 1);
    elements.border.strokeRect(
      centerX - width / 2,
      top,
      width,
      height
    );
  }

  /**
   * Draws the "Player X" label
   */
  private drawPlayerLabel(playerIndex: number, centerX: number, y: number, playerId: number) {
    const elements = this.playerUIElements[playerIndex];
    const playerColor = PLAYER_COLORS[playerId - 1];
    
    if (!elements.label) {
      elements.label = this.add.text(
        centerX,
        y,
        `Player ${playerId}`,
        {
          fontSize: '18px',
          color: `#${playerColor.toString(16).padStart(6, '0')}`,
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2
        }
      );
      elements.label.setOrigin(0.5, 0);
      elements.label.setDepth(1001);
    } else {
      elements.label.setPosition(centerX, y);
    }
  }

  /**
   * Draws control keys in a box diagram layout (W on top, A S D below)
   * Returns bounds of the keys diagram
   */
  private drawControlKeys(
    player: Player,
    playerIndex: number,
    centerX: number,
    startY: number,
    playerColor: number
  ): { width: number; height: number } {
    const controls = PLAYER_CONTROLS[player.playerId as keyof typeof PLAYER_CONTROLS];
    if (!controls) return { width: 0, height: 0 };

    const elements = this.playerUIElements[playerIndex];
    const keySize = 26; 
    const keySpacing = 2; // Reduced spacing
    const boxLineWidth = 1; // Thinner border
    
    // Format key for display
    const formatKey = (key: string): string => {
      if (key === 'UP') return '↑';
      if (key === 'DOWN') return '↓';
      if (key === 'LEFT') return '←';
      if (key === 'RIGHT') return '→';
      return key;
    };

    // Initialize arrays if needed
    if (!elements.keyBoxes) {
      elements.keyBoxes = [];
      elements.keyTexts = [];
    }

    // Clear and recreate key boxes and texts
    if (elements.keyBoxes) {
      elements.keyBoxes.forEach(box => box.destroy());
    }
    if (elements.keyTexts) {
      elements.keyTexts.forEach(text => text.destroy());
    }
    elements.keyBoxes = [];
    elements.keyTexts = [];

    // Calculate positions for WASD layout
    // W is centered on top
    const wX = centerX;
    const wY = startY;
    
    // A, S, D are below W
    const aX = centerX - keySize - keySpacing;
    const sX = centerX;
    const dX = centerX + keySize + keySpacing;
    const bottomY = startY + keySize + keySpacing;

    // Draw W (up)
    const wBox = this.add.rectangle(wX, wY, keySize, keySize, 0x222222, 0.8);
    wBox.setStrokeStyle(boxLineWidth, playerColor);
    wBox.setDepth(1001);
    elements.keyBoxes.push(wBox);
    
    const wText = this.add.text(wX, wY, formatKey(controls.up), {
      fontSize: '20px',
      color: `#${playerColor.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1
    });
    wText.setOrigin(0.5, 0.5);
    wText.setDepth(1002);
    elements.keyTexts.push(wText);

    // Draw A (left)
    const aBox = this.add.rectangle(aX, bottomY, keySize, keySize, 0x222222, 0.8);
    aBox.setStrokeStyle(boxLineWidth, playerColor);
    aBox.setDepth(1001);
    elements.keyBoxes.push(aBox);
    
    const aText = this.add.text(aX, bottomY, formatKey(controls.left), {
      fontSize: '20px',
      color: `#${playerColor.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1
    });
    aText.setOrigin(0.5, 0.5);
    aText.setDepth(1002);
    elements.keyTexts.push(aText);

    // Draw S (down)
    const sBox = this.add.rectangle(sX, bottomY, keySize, keySize, 0x222222, 0.8);
    sBox.setStrokeStyle(boxLineWidth, playerColor);
    sBox.setDepth(1001);
    elements.keyBoxes.push(sBox);
    
    const sText = this.add.text(sX, bottomY, formatKey(controls.down), {
      fontSize: '20px',
      color: `#${playerColor.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1
    });
    sText.setOrigin(0.5, 0.5);
    sText.setDepth(1002);
    elements.keyTexts.push(sText);

    // Draw D (right)
    const dBox = this.add.rectangle(dX, bottomY, keySize, keySize, 0x222222, 0.8);
    dBox.setStrokeStyle(boxLineWidth, playerColor);
    dBox.setDepth(1001);
    elements.keyBoxes.push(dBox);
    
    const dText = this.add.text(dX, bottomY, formatKey(controls.right), {
      fontSize: '20px',
      color: `#${playerColor.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1
    });
    dText.setOrigin(0.5, 0.5);
    dText.setDepth(1002);
    elements.keyTexts.push(dText);
    
    // Return bounds of the keys diagram
    const keysWidth = keySize * 3 + keySpacing * 2; // Width of bottom row
    const keysHeight = keySize * 2 + keySpacing; // Height of both rows
    return { width: keysWidth, height: keysHeight };
  }

  /**
   * Draws hearts for a player
   * Returns bounds of the hearts
   */
  private drawHearts(
    player: Player,
    playerIndex: number,
    centerX: number,
    startY: number,
    playerColor: number
  ): { width: number; height: number } {
    const heartSpacing = 5;
    const heartSize = 20;
    const totalHeartsWidth = MAX_PLAYER_HEARTS * heartSize + (MAX_PLAYER_HEARTS - 1) * heartSpacing;
    const heartsStartX = centerX - totalHeartsWidth / 2;
    
    // Draw hearts (filled for remaining, outline for lost)
    for (let i = 0; i < MAX_PLAYER_HEARTS; i++) {
      const heartX = heartsStartX + i * (heartSize + heartSpacing) + heartSize / 2; // Center the heart
      const heartY = startY;
      const hasHeart = i < player.hearts;

      if (hasHeart) {
        // Draw filled heart
        drawHeart(this.heartsGraphics, heartX, heartY, heartSize, playerColor, true);
      } else {
        // Draw outline heart (gray)
        drawHeart(this.heartsGraphics, heartX, heartY, heartSize, 0x666666, false);
      }
    }
    
    return { width: totalHeartsWidth, height: heartSize };
  }

  /**
   * Updates the level message display
   * Called from GameScene via event
   */
  private updateLevelMessage(message: string | undefined): void {
    console.log(`📝 UIScene received level message:`, message);
    
    // Remove existing message text if it exists
    if (this.levelMessageText) {
      this.levelMessageText.destroy();
      this.levelMessageText = undefined;
    }

    // Only create message text if message is provided
    if (message && message.trim().length > 0) {
      console.log(`📝 Creating level message text: "${message}"`);
      // Position message below player UI
      // Player UI starts at sectionTop (10px) and has contentHeight (~80-100px)
      // So message should be positioned around 110-120px from top
      const messageY = 110;
      
      this.levelMessageText = this.add.text(
        GAME_WIDTH / 2,
        messageY,
        message,
        {
          fontSize: '18px',
          color: '#FFFFFF',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 40 } // Allow wrapping with margins
        }
      );
      this.levelMessageText.setOrigin(0.5, 0);
      this.levelMessageText.setDepth(1001); // Above player UI
    }
  }

  /**
   * Updates the level message2 display
   * Called from GameScene via event
   */
  private updateLevelMessage2(message: string | undefined): void {
    console.log(`📝 UIScene received level message2:`, message);
    
    // Remove existing message2 text if it exists
    if (this.levelMessage2Text) {
      this.levelMessage2Text.destroy();
      this.levelMessage2Text = undefined;
    }

    // Only create message2 text if message is provided
    if (message && message.trim().length > 0) {
      console.log(`📝 Creating level message2 text: "${message}"`);
      
      // Position message2 below message1
      // message1 is at y=110, so message2 should be below it
      // If message1 exists, position below it; otherwise use same starting position
      let message2Y: number;
      if (this.levelMessageText) {
        // Position below message1 with spacing
        // Get the bottom of message1 text (top + height)
        const message1Bottom = 110 + this.levelMessageText.height;
        message2Y = message1Bottom + 10; // 10px spacing between messages
      } else {
        // No message1, so position at the same starting point
        message2Y = 110;
      }
      
      this.levelMessage2Text = this.add.text(
        GAME_WIDTH / 2,
        message2Y,
        message,
        {
          fontSize: '18px',
          color: '#FFFFFF',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 40 } // Allow wrapping with margins
        }
      );
      this.levelMessage2Text.setOrigin(0.5, 0);
      this.levelMessage2Text.setDepth(1001); // Above player UI
    }
  }
}



