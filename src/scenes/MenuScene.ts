import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { TEXT_STYLE_TITLE, TEXT_STYLE_SUBTITLE, TEXT_STYLE_BUTTON, BUTTON_HOVER_COLOR_DARKEN } from '../config/uiConstants';
import { createInteractiveButton } from '../utils/uiHelpers';
import { Level1 } from '../levels/Level1';
import { Level2 } from '../levels/Level2';
import { Level3 } from '../levels/Level3';
import { Level4 } from '../levels/Level4';
import { LevelData } from '../types';

/**
 * Menu Scene - Main menu with player count and level selection
 */
export class MenuScene extends Phaser.Scene {
  private selectedPlayerCount: number = 4;
  private selectedLevel: LevelData = Level1;
  private playerCountButtons: Phaser.GameObjects.Text[] = [];
  private levelButtons: Phaser.GameObjects.Text[] = [];
  private startButton?: Phaser.GameObjects.Text;

  // Available levels
  private availableLevels: LevelData[] = [Level1, Level2, Level3, Level4];

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
    this.levelButtons = [];

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

    // Level selection
    this.add.text(centerX, 550, 'Level', {
      ...TEXT_STYLE_SUBTITLE,
      color: '#FFFFFF',
      fontSize: '24px'
    }).setOrigin(0.5, 0.5).setDepth(10);

    // Level buttons
    const levelY = 600;
    const levelSpacing = 150;
    const levelStartX = centerX - ((this.availableLevels.length - 1) * levelSpacing) / 2;

    this.availableLevels.forEach((level, index) => {
      const buttonX = levelStartX + index * levelSpacing;
      const isSelected = level.id === this.selectedLevel.id;
      
      const button = createInteractiveButton(
        this,
        buttonX,
        levelY,
        level.name,
        {
          ...TEXT_STYLE_BUTTON,
          color: isSelected ? '#00FF00' : '#FFFFFF',
          fontSize: '20px'
        },
        '#00CC00',
        () => {
          this.selectLevel(level);
        }
      );
      button.setDepth(10); // Above background image

      this.levelButtons.push(button);
    });

    // Start button
    this.startButton = createInteractiveButton(
      this,
      centerX,
      centerY + 260,
      'START',
      {
        ...TEXT_STYLE_BUTTON,
        color: '#00FF00',
        fontSize: '36px'
      },
      '#00CC00',
      () => {
        this.startGame();
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
   * Selects level and updates button appearance
   */
  private selectLevel(level: LevelData): void {
    this.selectedLevel = level;
    
    // Update button colors and hover handlers
    this.levelButtons.forEach((button, index) => {
      const levelData = this.availableLevels[index];
      const isSelected = levelData.id === this.selectedLevel.id;
      const newColor = isSelected ? '#00FF00' : '#FFFFFF';
      
      // Update button style
      button.setStyle({
        ...TEXT_STYLE_BUTTON,
        color: newColor,
        fontSize: '20px'
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
        this.selectLevel(levelData);
      });
    });

    console.log(`🎮 Selected level: ${level.name}`);
  }

  /**
   * Starts the game with selected player count and level
   */
  private startGame(): void {
    console.log(`🚀 Starting game: ${this.selectedPlayerCount} players, Level ${this.selectedLevel.id} (${this.selectedLevel.name})`);
    
    // Start GameScene with selected level and player count
    this.scene.start('GameScene', {
      levelData: this.selectedLevel,
      playerCount: this.selectedPlayerCount
    });
  }
}

