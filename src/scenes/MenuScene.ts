import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { TEXT_STYLE_TITLE, TEXT_STYLE_SUBTITLE, TEXT_STYLE_BUTTON, BUTTON_HOVER_COLOR_DARKEN } from '../config/uiConstants';
import { createInteractiveButton } from '../utils/uiHelpers';
import { Level1 } from '../levels/Level1';
import { generateRandomLevel } from '../utils/levelGenerator';

/**
 * Menu Scene - Main menu with player count and game start options
 */
export class MenuScene extends Phaser.Scene {
  private selectedPlayerCount: number = 4;
  private playerCountButtons: Phaser.GameObjects.Text[] = [];
  private startButton?: Phaser.GameObjects.Text;
  private playTutorialButton?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    // Stop UIScene if it's still running (from GameScene)
    if (this.scene.isActive('UIScene')) {
      this.scene.stop('UIScene');
    }

    // Clear button arrays when scene is recreated
    this.playerCountButtons = [];

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // Display cover image as background (960x960, covers entire screen)
    this.add.image(centerX, centerY, 'tabula-cover')
      .setOrigin(0.5, 0.5)
      .setDepth(0); // Behind all UI elements

    // Player count selection
    this.add.text(centerX, 400, 'Players', {
      ...TEXT_STYLE_SUBTITLE,
      color: '#FFFFFF',
      fontSize: '24px'
    }).setOrigin(0.5, 0.5).setDepth(10);

    // Player count buttons (1, 2, 3, 4)
    const playerCountY = 460;
    const playerCountSpacing = 80;
    const playerCountStartX = centerX - (playerCountSpacing * 1.5);

    for (let i = 1; i <= 4; i++) {
      const buttonX = playerCountStartX + (i - 1) * playerCountSpacing;
      const isSelected = i === this.selectedPlayerCount;
      
      const button = createInteractiveButton(
        this,
        buttonX,
        playerCountY,
        i.toString(),
        {
          ...TEXT_STYLE_BUTTON,
          color: isSelected ? '#00FF00' : '#FFFFFF',
          fontSize: '32px'
        },
        '#00CC00',
        () => {
          this.selectPlayerCount(i);
        }
      );
      button.setDepth(10); // Above background image

      this.playerCountButtons.push(button);
    }

    // TUTORIAL button
    this.playTutorialButton = createInteractiveButton(
      this,
      centerX,
      centerY + 200,
      'TUTORIAL',
      {
        ...TEXT_STYLE_BUTTON,
        color: '#00FF00',
        fontSize: '36px'
      },
      '#00CC00',
      () => {
        this.startTutorial();
      }
    );
    this.playTutorialButton.setDepth(10); // Above background image

    // Start button
    this.startButton = createInteractiveButton(
      this,
      centerX,
      centerY + 280,
      'START',
      {
        ...TEXT_STYLE_BUTTON,
        color: '#00FF00',
        fontSize: '36px'
      },
      '#00CC00',
      () => {
        this.startRoguelike();
      }
    );
    this.startButton.setDepth(10); // Above background image

    console.log('📋 Menu scene initialized');
  }

  /**
   * Selects player count and updates button appearance
   */
  private selectPlayerCount(count: number): void {
    this.selectedPlayerCount = count;
    
    // Update button colors and hover handlers
    this.playerCountButtons.forEach((button, index) => {
      const playerNum = index + 1;
      const isSelected = playerNum === count;
      const newColor = isSelected ? '#00FF00' : '#FFFFFF';
      
      // Update button style
      button.setStyle({
        ...TEXT_STYLE_BUTTON,
        color: newColor,
        fontSize: '32px'
      });
      
      // Update hover handlers to use current color
      button.removeAllListeners('pointerover');
      button.removeAllListeners('pointerout');
      button.on('pointerover', () => {
        button.setStyle({ color: '#00CC00' });
      });
      button.on('pointerout', () => {
        button.setStyle({ color: newColor });
      });
      button.on('pointerdown', () => {
        this.selectPlayerCount(playerNum);
      });
    });

    console.log(`👥 Selected ${count} player(s)`);
  }

  /**
   * Starts the tutorial (Level 1) with selected player count
   */
  private startTutorial(): void {
    console.log(`🚀 Starting tutorial: ${this.selectedPlayerCount} players, Level 1`);
    
    // Start GameScene with Level1 and selected player count
    this.scene.start('GameScene', {
      levelData: Level1,
      playerCount: this.selectedPlayerCount,
      isRoguelike: false
    });
  }

  /**
   * Starts roguelike mode with a randomly generated level 1
   */
  private startRoguelike(): void {
    console.log(`🎲 Starting roguelike mode: ${this.selectedPlayerCount} players, Level 1`);
    
    // Generate first random level
    const level1 = generateRandomLevel(1);
    
    // Start GameScene with generated level, player count, and roguelike flag
    this.scene.start('GameScene', {
      levelData: level1,
      playerCount: this.selectedPlayerCount,
      isRoguelike: true,
      levelNumber: 1
    });
  }
}

