import Phaser from 'phaser';
import { GROUND_ITEM_PICKUP_RADIUS, PLAYER_SWAP_DURATION, PLAYER_OVERLAP_RADIUS, STATIONARY_VELOCITY_THRESHOLD, DEBUG_MODE, SWAP_PROGRESS_BAR_WIDTH, SWAP_PROGRESS_BAR_HEIGHT, SWAP_PROGRESS_BAR_OFFSET_Y, REVIVE_DURATION, REVIVE_PROGRESS_BAR_COLOR } from '../config/constants';
import { Player } from '../entities/Player';
import { Baby } from '../entities/Baby';
import { Weapon } from '../entities/Weapon';

interface PlayerSwapState {
  player1: Player;
  player2: Player;
  timer: number;
  progressBar?: Phaser.GameObjects.Graphics;
}

interface PlayerRevivalState {
  revivingPlayer: Player; // The player doing the reviving
  downedPlayer: Player; // The player being revived
  timer: number;
  progressBar?: Phaser.GameObjects.Graphics;
}

export class SwapSystem {
  private scene: Phaser.Scene;
  private players: Player[] = [];
  private groundItems: (Baby | Weapon)[] = [];
  private activePlayerSwap: PlayerSwapState | null = null;
  private activeRevival: PlayerRevivalState | null = null; // Phase 4.9: Revival state

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Sets the players that the swap system will manage
   * @param players Array of player instances
   */
  setPlayers(players: Player[]) {
    this.players = players;
    if (DEBUG_MODE) {
      console.log(`[DEBUG] SwapSystem initialized with ${players.length} players`);
      console.log(`[DEBUG] Swap settings: OVERLAP_RADIUS=${PLAYER_OVERLAP_RADIUS}, STATIONARY_THRESHOLD=${STATIONARY_VELOCITY_THRESHOLD}, DURATION=${PLAYER_SWAP_DURATION}ms`);
    }
  }

  /**
   * Adds an item to the ground items tracking
   * @param item The item to add
   */
  addGroundItem(item: Baby | Weapon) {
    this.groundItems.push(item);
  }

  /**
   * Removes an item from the ground items tracking
   * @param item The item to remove
   */
  removeGroundItem(item: Baby | Weapon) {
    const index = this.groundItems.indexOf(item);
    if (index > -1) {
      this.groundItems.splice(index, 1);
    }
  }

  /**
   * Updates the swap system, checking for ground item pickups, player-to-player swaps, and revivals
   * @param delta Time elapsed since last frame in milliseconds
   */
  update(delta: number) {
    // DISABLED: Ground item pickup system (kept for future use)
    // Check each player against ground items (skip downed players)
    /*
    this.players.forEach(player => {
      // Downed players cannot swap items
      if (player.isDowned) {
        return;
      }
      
      this.groundItems.forEach(item => {
        if (this.isPlayerNearItem(player, item)) {
          this.swapWithGroundItem(player, item);
        }
      });
    });
    */

    // Check for revivals first (Phase 4.9) - takes priority over swaps
    this.updateRevival(delta);
    
    // Only check for player-to-player swaps if no revival is active
    if (!this.activeRevival) {
      this.updatePlayerToPlayerSwap(delta);
    }
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
        
        // Check if swap duration reached (before updating progress bar to avoid drawing completed bar)
        if (swap.timer >= PLAYER_SWAP_DURATION) {
          this.completePlayerSwap(swap);
          return; // Exit early to avoid updating progress bar after completion
        }
        
        // Update progress indicator
        this.updateSwapProgressBar(swap);
        
        if (DEBUG_MODE && Math.floor(swap.timer / 100) !== Math.floor((swap.timer - delta) / 100)) {
          // Log every 100ms
          const progress = (swap.timer / PLAYER_SWAP_DURATION * 100).toFixed(0);
          console.log(`[DEBUG] Swap progress: ${progress}% (${swap.timer.toFixed(0)}ms / ${PLAYER_SWAP_DURATION}ms)`);
        }
      } else {
        // Players moved or separated - cancel swap
        this.cancelPlayerSwap();
      }
    } else {
      // Look for new player pairs to start swapping (skip downed players)
      for (let i = 0; i < this.players.length; i++) {
        for (let j = i + 1; j < this.players.length; j++) {
          const player1 = this.players[i];
          const player2 = this.players[j];
          
          // Skip if either player is downed (revival is handled separately)
          if (player1.isDowned || player2.isDowned) {
            continue;
          }
          
          const isOverlapping = this.arePlayersOverlapping(player1, player2);
          const isStationary = this.arePlayersStationary(player1, player2);
          
          if (DEBUG_MODE) {
            if (isOverlapping && !isStationary) {
              console.log(`[DEBUG] Players ${player1.playerId} and ${player2.playerId} are overlapping but not stationary`);
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
      const wasCancelled = this.activePlayerSwap.timer > 0 && this.activePlayerSwap.timer < PLAYER_SWAP_DURATION;
      if (wasCancelled) {
        console.log(`❌ Player swap cancelled: Player ${this.activePlayerSwap.player1.playerId} ↔ Player ${this.activePlayerSwap.player2.playerId}`);
        if (DEBUG_MODE) {
          console.log(`[DEBUG] Swap cancelled at ${this.activePlayerSwap.timer.toFixed(0)}ms`);
        }
      }
      
      // Clean up progress bar
      this.cleanupProgressBar(this.activePlayerSwap);
      
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
    
    // Clean up progress bar - ensure it's fully removed from display
    this.cleanupProgressBar(swap);
    
    // Reset swap state
    this.activePlayerSwap = null;
  }
  
  private cleanupProgressBar(swap: PlayerSwapState) {
    if (swap.progressBar) {
      // Clear any rendered graphics
      swap.progressBar.clear();
      // Make invisible before destroying
      swap.progressBar.setVisible(false);
      // Destroy the graphics object
      swap.progressBar.destroy();
      swap.progressBar = undefined;
    }
  }
  
  private getItemType(item: Baby | Weapon | null): string {
    if (!item) return 'nothing';
    if (item instanceof Baby) return 'Baby';
    if (item instanceof Weapon) return item.weaponType;
    return 'unknown';
  }

  private createSwapProgressBar(swap: PlayerSwapState) {
    swap.progressBar = this.scene.add.graphics();
    swap.progressBar.setDepth(2000);
  }

  private updateSwapProgressBar(swap: PlayerSwapState) {
    if (!swap.progressBar) return;
    
    const midpointX = (swap.player1.x + swap.player2.x) / 2;
    const midpointY = (swap.player1.y + swap.player2.y) / 2 + SWAP_PROGRESS_BAR_OFFSET_Y;
    const progress = swap.timer / PLAYER_SWAP_DURATION;
    const fillWidth = SWAP_PROGRESS_BAR_WIDTH * progress;
    
    swap.progressBar.clear();
    swap.progressBar.fillStyle(0x888888);
    swap.progressBar.fillRect(midpointX - SWAP_PROGRESS_BAR_WIDTH / 2, midpointY - SWAP_PROGRESS_BAR_HEIGHT / 2, SWAP_PROGRESS_BAR_WIDTH, SWAP_PROGRESS_BAR_HEIGHT);
    swap.progressBar.fillStyle(0x00FF00);
    swap.progressBar.fillRect(midpointX - SWAP_PROGRESS_BAR_WIDTH / 2, midpointY - SWAP_PROGRESS_BAR_HEIGHT / 2, fillWidth, SWAP_PROGRESS_BAR_HEIGHT);
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

  /**
   * Updates revival system (Phase 4.9)
   * Checks if a player is reviving a downed player
   */
  private updateRevival(delta: number) {
    // Check if there's an active revival in progress
    if (this.activeRevival) {
      const revival = this.activeRevival;
      
      // Check if players are still overlapping and stationary
      if (this.arePlayersOverlapping(revival.revivingPlayer, revival.downedPlayer) && 
          this.arePlayersStationary(revival.revivingPlayer, revival.downedPlayer) &&
          revival.downedPlayer.isDowned) {
        
        // Update timer
        revival.timer += delta;
        
        // Check if revival duration reached
        if (revival.timer >= REVIVE_DURATION) {
          this.completeRevival(revival);
          return; // Exit early to avoid updating progress bar after completion
        }
        
        // Update progress indicator
        this.updateRevivalProgressBar(revival);
        
        if (DEBUG_MODE && Math.floor(revival.timer / 100) !== Math.floor((revival.timer - delta) / 100)) {
          // Log every 100ms
          const progress = (revival.timer / REVIVE_DURATION * 100).toFixed(0);
          console.log(`[DEBUG] Revival progress: ${progress}% (${revival.timer.toFixed(0)}ms / ${REVIVE_DURATION}ms)`);
        }
      } else {
        // Players moved, separated, or downed player is no longer downed - cancel revival
        this.cancelRevival();
      }
    } else {
      // Look for player pairs where one is downed
      for (let i = 0; i < this.players.length; i++) {
        for (let j = i + 1; j < this.players.length; j++) {
          const player1 = this.players[i];
          const player2 = this.players[j];
          
          // Check if one player is downed
          if (player1.isDowned && !player2.isDowned) {
            // Player1 is downed, Player2 is reviving
            const isOverlapping = this.arePlayersOverlapping(player1, player2);
            const isStationary = this.arePlayersStationary(player1, player2);
            
            if (isOverlapping && isStationary) {
              this.startRevival(player2, player1);
              break;
            }
          } else if (player2.isDowned && !player1.isDowned) {
            // Player2 is downed, Player1 is reviving
            const isOverlapping = this.arePlayersOverlapping(player1, player2);
            const isStationary = this.arePlayersStationary(player1, player2);
            
            if (isOverlapping && isStationary) {
              this.startRevival(player1, player2);
              break;
            }
          }
        }
        if (this.activeRevival) break;
      }
    }
  }

  /**
   * Starts a revival process (Phase 4.9)
   */
  private startRevival(revivingPlayer: Player, downedPlayer: Player) {
    // Cancel any existing swap or revival
    this.cancelPlayerSwap();
    this.cancelRevival();
    
    // Start new revival
    this.activeRevival = {
      revivingPlayer,
      downedPlayer,
      timer: 0
    };
    
    // Create progress bar
    this.createRevivalProgressBar(this.activeRevival);
    
    console.log(`💚 Revival started: Player ${revivingPlayer.playerId} reviving Player ${downedPlayer.playerId} - 3 second timer started`);
  }

  /**
   * Cancels an active revival
   */
  private cancelRevival() {
    if (this.activeRevival) {
      const wasCancelled = this.activeRevival.timer > 0 && this.activeRevival.timer < REVIVE_DURATION;
      if (wasCancelled) {
        console.log(`❌ Revival cancelled: Player ${this.activeRevival.revivingPlayer.playerId} stopped reviving Player ${this.activeRevival.downedPlayer.playerId}`);
        if (DEBUG_MODE) {
          console.log(`[DEBUG] Revival cancelled at ${this.activeRevival.timer.toFixed(0)}ms`);
        }
      }
      
      // Clean up progress bar
      this.cleanupRevivalProgressBar(this.activeRevival);
      
      this.activeRevival = null;
    }
  }

  /**
   * Completes a revival (Phase 4.9)
   */
  private completeRevival(revival: PlayerRevivalState) {
    const downedPlayer = revival.downedPlayer;
    
    // Revive the player: restore 1 heart, exit downed state, restore opacity
    downedPlayer.hearts = 1;
    downedPlayer.isDowned = false;
    downedPlayer.setAlpha(1); // Restore full opacity
    
    // Ensure player has no items (must pick one up)
    downedPlayer.setHeldBaby(null);
    downedPlayer.setHeldWeapon(null);
    
    console.log(`✅ Revival completed: Player ${downedPlayer.playerId} revived with 1 heart (no items)`);
    
    // Clean up progress bar
    this.cleanupRevivalProgressBar(revival);
    
    // Reset revival state
    this.activeRevival = null;
  }

  /**
   * Creates the revival progress bar (Phase 4.9)
   */
  private createRevivalProgressBar(revival: PlayerRevivalState) {
    revival.progressBar = this.scene.add.graphics();
    revival.progressBar.setDepth(2000);
  }

  /**
   * Updates the revival progress bar (Phase 4.9)
   */
  private updateRevivalProgressBar(revival: PlayerRevivalState) {
    if (!revival.progressBar) return;
    
    const midpointX = (revival.revivingPlayer.x + revival.downedPlayer.x) / 2;
    const midpointY = (revival.revivingPlayer.y + revival.downedPlayer.y) / 2 + SWAP_PROGRESS_BAR_OFFSET_Y;
    const progress = revival.timer / REVIVE_DURATION;
    const fillWidth = SWAP_PROGRESS_BAR_WIDTH * progress;
    
    revival.progressBar.clear();
    // Background (gray)
    revival.progressBar.fillStyle(0x888888);
    revival.progressBar.fillRect(midpointX - SWAP_PROGRESS_BAR_WIDTH / 2, midpointY - SWAP_PROGRESS_BAR_HEIGHT / 2, SWAP_PROGRESS_BAR_WIDTH, SWAP_PROGRESS_BAR_HEIGHT);
    // Fill (cyan for revival)
    revival.progressBar.fillStyle(REVIVE_PROGRESS_BAR_COLOR);
    revival.progressBar.fillRect(midpointX - SWAP_PROGRESS_BAR_WIDTH / 2, midpointY - SWAP_PROGRESS_BAR_HEIGHT / 2, fillWidth, SWAP_PROGRESS_BAR_HEIGHT);
  }

  /**
   * Cleans up the revival progress bar
   */
  private cleanupRevivalProgressBar(revival: PlayerRevivalState) {
    if (revival.progressBar) {
      revival.progressBar.clear();
      revival.progressBar.setVisible(false);
      revival.progressBar.destroy();
      revival.progressBar = undefined;
    }
  }
}

