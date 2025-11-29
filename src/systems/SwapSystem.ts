import Phaser from 'phaser';
import { GROUND_ITEM_PICKUP_RADIUS, PLAYER_SWAP_DURATION, PLAYER_OVERLAP_RADIUS, STATIONARY_VELOCITY_THRESHOLD, DEBUG_MODE } from '../config/constants';
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
    if (DEBUG_MODE) {
      console.log(`[DEBUG] SwapSystem initialized with ${players.length} players`);
      console.log(`[DEBUG] Swap settings: OVERLAP_RADIUS=${PLAYER_OVERLAP_RADIUS}, STATIONARY_THRESHOLD=${STATIONARY_VELOCITY_THRESHOLD}, DURATION=${PLAYER_SWAP_DURATION}ms`);
    }
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
        
        if (DEBUG_MODE && Math.floor(swap.timer / 100) !== Math.floor((swap.timer - delta) / 100)) {
          // Log every 100ms
          const progress = (swap.timer / PLAYER_SWAP_DURATION * 100).toFixed(0);
          console.log(`[DEBUG] Swap progress: ${progress}% (${swap.timer.toFixed(0)}ms / ${PLAYER_SWAP_DURATION}ms)`);
        }
        
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
          
          const isOverlapping = this.arePlayersOverlapping(player1, player2);
          const isStationary = this.arePlayersStationary(player1, player2);
          
          if (DEBUG_MODE) {
            if (isOverlapping && !isStationary) {
              console.log(`[DEBUG] Players ${player1.playerId} and ${player2.playerId} are overlapping but not stationary`);
            }
            if (!isOverlapping && isStationary) {
              console.log(`[DEBUG] Players ${player1.playerId} and ${player2.playerId} are stationary but not overlapping`);
            }
          }
          
          if (isOverlapping && isStationary) {
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
    const isOverlapping = distance <= PLAYER_OVERLAP_RADIUS;
    
    if (DEBUG_MODE) {
      console.log(`[DEBUG] Overlap check - P${player1.playerId} (${player1.x.toFixed(1)}, ${player1.y.toFixed(1)}) ↔ P${player2.playerId} (${player2.x.toFixed(1)}, ${player2.y.toFixed(1)}): distance=${distance.toFixed(2)}, threshold=${PLAYER_OVERLAP_RADIUS}, overlapping=${isOverlapping}`);
    }
    
    return isOverlapping;
  }

  private arePlayersStationary(player1: Player, player2: Player): boolean {
    const p1VelX = Math.abs(player1.body.velocity.x);
    const p1VelY = Math.abs(player1.body.velocity.y);
    const p2VelX = Math.abs(player2.body.velocity.x);
    const p2VelY = Math.abs(player2.body.velocity.y);
    
    const p1Moving = p1VelX > STATIONARY_VELOCITY_THRESHOLD || p1VelY > STATIONARY_VELOCITY_THRESHOLD;
    const p2Moving = p2VelX > STATIONARY_VELOCITY_THRESHOLD || p2VelY > STATIONARY_VELOCITY_THRESHOLD;
    
    const isStationary = !p1Moving && !p2Moving;
    
    if (DEBUG_MODE) {
      console.log(`[DEBUG] Stationary check - P${player1.playerId}: vx=${player1.body.velocity.x.toFixed(2)}, vy=${player1.body.velocity.y.toFixed(2)}, P${player2.playerId}: vx=${player2.body.velocity.x.toFixed(2)}, vy=${player2.body.velocity.y.toFixed(2)}, stationary=${isStationary}`);
    }
    
    return isStationary;
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
    
    const p1Item = this.getItemType(player1.getHeldItem());
    const p2Item = this.getItemType(player2.getHeldItem());
    console.log(`🔄 Player swap triggered: Player ${player1.playerId} (${p1Item}) ↔ Player ${player2.playerId} (${p2Item}) - 2 second timer started`);
  }

  private cancelPlayerSwap() {
    if (this.activePlayerSwap) {
      // Clean up progress bar
      if (this.activePlayerSwap.progressBar) {
        this.activePlayerSwap.progressBar.clear();
        this.activePlayerSwap.progressBar.destroy();
        this.activePlayerSwap.progressBar = undefined;
      }
      
      const wasCancelled = this.activePlayerSwap.timer > 0 && this.activePlayerSwap.timer < PLAYER_SWAP_DURATION;
      if (wasCancelled) {
        console.log(`❌ Player swap cancelled: Player ${this.activePlayerSwap.player1.playerId} ↔ Player ${this.activePlayerSwap.player2.playerId}`);
        if (DEBUG_MODE) {
          console.log(`[DEBUG] Swap cancelled at ${this.activePlayerSwap.timer.toFixed(0)}ms`);
        }
      }
      this.activePlayerSwap = null;
    }
  }

  private completePlayerSwap(swap: PlayerSwapState) {
    // Swap items between players
    const p1Item = swap.player1.getHeldItem();
    const p2Item = swap.player2.getHeldItem();
    
    const p1ItemType = this.getItemType(p1Item);
    const p2ItemType = this.getItemType(p2Item);
    
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
    
    console.log(`✅ Player swap completed: Player ${swap.player1.playerId} now has ${p2ItemType}, Player ${swap.player2.playerId} now has ${p1ItemType}`);
    
    // Clean up progress bar explicitly
    if (swap.progressBar) {
      swap.progressBar.clear();
      swap.progressBar.destroy();
      swap.progressBar = undefined;
    }
    
    // Reset swap state
    this.activePlayerSwap = null;
  }
  
  private getItemType(item: Baby | Weapon | null): string {
    if (!item) return 'nothing';
    if (item instanceof Baby) return 'Baby';
    if (item instanceof Weapon) return item.weaponType;
    return 'unknown';
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

    const playerItemType = this.getItemType(playerCurrentItem);
    const groundItemType = this.getItemType(groundItem);

    // Remove ground item from ground items list (it will be picked up)
    this.removeGroundItem(groundItem);

    // Place player's current item on ground (if they have one)
    if (playerCurrentItem) {
      if (playerCurrentItem instanceof Baby) {
        player.setHeldBaby(null);
        playerCurrentItem.placeOnGround(groundItemX, groundItemY);
        this.addGroundItem(playerCurrentItem);
        console.log(`📦 Player ${player.playerId} dropped ${playerItemType} on ground at (${groundItemX.toFixed(0)}, ${groundItemY.toFixed(0)})`);
      } else if (playerCurrentItem instanceof Weapon) {
        player.setHeldWeapon(null);
        playerCurrentItem.placeOnGround(groundItemX, groundItemY);
        this.addGroundItem(playerCurrentItem);
        console.log(`📦 Player ${player.playerId} dropped ${playerItemType} on ground at (${groundItemX.toFixed(0)}, ${groundItemY.toFixed(0)})`);
      }
    }

    // Player picks up ground item
    if (groundItem instanceof Baby) {
      player.setHeldBaby(groundItem);
      console.log(`📥 Player ${player.playerId} picked up ${groundItemType} from ground`);
    } else if (groundItem instanceof Weapon) {
      player.setHeldWeapon(groundItem);
      console.log(`📥 Player ${player.playerId} picked up ${groundItemType} from ground`);
    }
  }
}

