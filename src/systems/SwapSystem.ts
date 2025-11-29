import Phaser from 'phaser';
import { GROUND_ITEM_PICKUP_RADIUS, PLAYER_SWAP_DURATION, PLAYER_OVERLAP_RADIUS } from '../config/constants';
import { Player } from '../entities/Player';
import { Baby } from '../entities/Baby';
import { Weapon } from '../entities/Weapon';

interface PlayerSwapState {
  player1: Player;
  player2: Player;
  timer: number;
  progressBar?: Phaser.GameObjects.Graphics;
}

export class SwapSystem {
  private scene: Phaser.Scene;
  private players: Player[] = [];
  private groundItems: (Baby | Weapon)[] = [];
  private activePlayerSwap: PlayerSwapState | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setPlayers(players: Player[]) {
    this.players = players;
  }

  addGroundItem(item: Baby | Weapon) {
    this.groundItems.push(item);
  }

  removeGroundItem(item: Baby | Weapon) {
    const index = this.groundItems.indexOf(item);
    if (index > -1) {
      this.groundItems.splice(index, 1);
    }
  }

  update(delta: number) {
    // Check each player against ground items
    this.players.forEach(player => {
      this.groundItems.forEach(item => {
        if (this.isPlayerNearItem(player, item)) {
          this.swapWithGroundItem(player, item);
        }
      });
    });

    // Check for player-to-player swaps
    this.updatePlayerToPlayerSwap(delta);
  }

  private updatePlayerToPlayerSwap(delta: number) {
    // Check if there's an active swap in progress
    if (this.activePlayerSwap) {
      const swap = this.activePlayerSwap;
      
      // Check if both players are still overlapping and stationary
      if (this.arePlayersOverlapping(swap.player1, swap.player2) && 
          this.arePlayersStationary(swap.player1, swap.player2)) {
        
        // Update timer
        swap.timer += delta;
        
        // Update progress indicator
        this.updateSwapProgressBar(swap);
        
        // Check if swap duration reached
        if (swap.timer >= PLAYER_SWAP_DURATION) {
          this.completePlayerSwap(swap);
        }
      } else {
        // Players moved or separated - cancel swap
        this.cancelPlayerSwap();
      }
    } else {
      // Look for new player pairs to start swapping
      for (let i = 0; i < this.players.length; i++) {
        for (let j = i + 1; j < this.players.length; j++) {
          const player1 = this.players[i];
          const player2 = this.players[j];
          
          if (this.arePlayersOverlapping(player1, player2) && 
              this.arePlayersStationary(player1, player2)) {
            this.startPlayerSwap(player1, player2);
            break;
          }
        }
        if (this.activePlayerSwap) break;
      }
    }
  }

  private arePlayersOverlapping(player1: Player, player2: Player): boolean {
    const dx = player2.x - player1.x;
    const dy = player2.y - player1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= PLAYER_OVERLAP_RADIUS;
  }

  private arePlayersStationary(player1: Player, player2: Player): boolean {
    const p1Moving = player1.body.velocity.x !== 0 || player1.body.velocity.y !== 0;
    const p2Moving = player2.body.velocity.x !== 0 || player2.body.velocity.y !== 0;
    return !p1Moving && !p2Moving;
  }

  private startPlayerSwap(player1: Player, player2: Player) {
    // Cancel any existing swap
    this.cancelPlayerSwap();
    
    // Start new swap
    this.activePlayerSwap = {
      player1,
      player2,
      timer: 0
    };
    
    // Create progress bar
    this.createSwapProgressBar(this.activePlayerSwap);
  }

  private cancelPlayerSwap() {
    if (this.activePlayerSwap) {
      if (this.activePlayerSwap.progressBar) {
        this.activePlayerSwap.progressBar.destroy();
      }
      this.activePlayerSwap = null;
    }
  }

  private completePlayerSwap(swap: PlayerSwapState) {
    // Swap items between players
    const p1Item = swap.player1.getHeldItem();
    const p2Item = swap.player2.getHeldItem();
    
    // Remove items from players
    swap.player1.setHeldBaby(null);
    swap.player1.setHeldWeapon(null);
    swap.player2.setHeldBaby(null);
    swap.player2.setHeldWeapon(null);
    
    // Give items to other player
    if (p1Item instanceof Baby) {
      swap.player2.setHeldBaby(p1Item);
    } else if (p1Item instanceof Weapon) {
      swap.player2.setHeldWeapon(p1Item);
    }
    
    if (p2Item instanceof Baby) {
      swap.player1.setHeldBaby(p2Item);
    } else if (p2Item instanceof Weapon) {
      swap.player1.setHeldWeapon(p2Item);
    }
    
    // Clean up
    this.cancelPlayerSwap();
  }

  private createSwapProgressBar(swap: PlayerSwapState) {
    const barWidth = 30;
    const barHeight = 4;
    const midpointX = (swap.player1.x + swap.player2.x) / 2;
    const midpointY = (swap.player1.y + swap.player2.y) / 2 - 30;
    
    swap.progressBar = this.scene.add.graphics();
    swap.progressBar.setDepth(2000);
  }

  private updateSwapProgressBar(swap: PlayerSwapState) {
    if (!swap.progressBar) return;
    
    const barWidth = 30;
    const barHeight = 4;
    const midpointX = (swap.player1.x + swap.player2.x) / 2;
    const midpointY = (swap.player1.y + swap.player2.y) / 2 - 30;
    const progress = swap.timer / PLAYER_SWAP_DURATION;
    const fillWidth = barWidth * progress;
    
    swap.progressBar.clear();
    swap.progressBar.fillStyle(0x888888);
    swap.progressBar.fillRect(midpointX - barWidth / 2, midpointY - barHeight / 2, barWidth, barHeight);
    swap.progressBar.fillStyle(0x00FF00);
    swap.progressBar.fillRect(midpointX - barWidth / 2, midpointY - barHeight / 2, fillWidth, barHeight);
  }

  private isPlayerNearItem(player: Player, item: Baby | Weapon): boolean {
    const dx = item.x - player.x;
    const dy = item.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= GROUND_ITEM_PICKUP_RADIUS;
  }

  private swapWithGroundItem(player: Player, groundItem: Baby | Weapon) {
    const playerCurrentItem = player.getHeldItem();
    const groundItemX = groundItem.x;
    const groundItemY = groundItem.y;

    // Remove ground item from ground items list (it will be picked up)
    this.removeGroundItem(groundItem);

    // Place player's current item on ground (if they have one)
    if (playerCurrentItem) {
      if (playerCurrentItem instanceof Baby) {
        player.setHeldBaby(null);
        playerCurrentItem.placeOnGround(groundItemX, groundItemY);
        this.addGroundItem(playerCurrentItem);
      } else if (playerCurrentItem instanceof Weapon) {
        player.setHeldWeapon(null);
        playerCurrentItem.placeOnGround(groundItemX, groundItemY);
        this.addGroundItem(playerCurrentItem);
      }
    }

    // Player picks up ground item
    if (groundItem instanceof Baby) {
      player.setHeldBaby(groundItem);
    } else if (groundItem instanceof Weapon) {
      player.setHeldWeapon(groundItem);
    }
  }
}

