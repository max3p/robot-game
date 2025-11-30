import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { TEXT_STYLE_TITLE, TEXT_STYLE_SUBTITLE, TEXT_STYLE_BUTTON, BUTTON_HOVER_COLOR_DARKEN } from '../config/uiConstants';
import { createInteractiveButton } from '../utils/uiHelpers';
import { Level1 } from '../levels/Level1';
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

  // Available levels (for now just Level1, but structured for easy expansion)
  private availableLevels: LevelData[] = [Level1];

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // Game title
    this.add.text(centerX, 100, 'TABULA RASA', {
      ...TEXT_STYLE_TITLE,
      color: '#FFFFFF'
    }).setOrigin(0.5, 0.5);

    // Player count selection
    this.add.text(centerX, 200, 'Players', {
      ...TEXT_STYLE_SUBTITLE,
      color: '#FFFFFF',
      fontSize: '24px'
    }).setOrigin(0.5, 0.5);

    // Player count buttons (1, 2, 3, 4)
    const playerCountY = 260;
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

      this.playerCountButtons.push(button);
    }

    // Level selection
    this.add.text(centerX, 350, 'Level', {
      ...TEXT_STYLE_SUBTITLE,
      color: '#FFFFFF',
      fontSize: '24px'
    }).setOrigin(0.5, 0.5);

    // Level buttons
    const levelY = 410;
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

      this.levelButtons.push(button);
    });

    // Start button
    this.startButton = createInteractiveButton(
      this,
      centerX,
      centerY + 150,
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

    console.log('📋 Menu scene initialized');
  }

  /**
   * Selects player count and updates button appearance
   */
  private selectPlayerCount(count: number): void {
    this.selectedPlayerCount = count;
    
    // Update button colors
    this.playerCountButtons.forEach((button, index) => {
      const playerNum = index + 1;
      if (playerNum === count) {
        button.setStyle({ color: '#00FF00' });
      } else {
        button.setStyle({ color: '#FFFFFF' });
      }
    });

    console.log(`👥 Selected ${count} player(s)`);
  }

  /**
   * Selects level and updates button appearance
   */
  private selectLevel(level: LevelData): void {
    this.selectedLevel = level;
    
    // Update button colors
    this.levelButtons.forEach((button, index) => {
      const level = this.availableLevels[index];
      if (level.id === this.selectedLevel.id) {
        button.setStyle({ color: '#00FF00' });
      } else {
        button.setStyle({ color: '#FFFFFF' });
      }
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

