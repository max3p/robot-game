// Display constants
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 960;
export const TILE_SIZE = 96;

// Player
export const BASE_PLAYER_SPEED = 200;
export const BABY_HOLDER_SPEED = 120; // 60% of base speed
export const PLAYER_RADIUS = 16; // 32px diameter / 2
export const PLAYER_COLORS = [0x00FF00, 0x0088FF, 0xFFFF00, 0xAA00FF]; // Green, Blue, Yellow, Purple
export const PLAYER_MASS = 1.0; // Base mass for physics
export const PLAYER_PUSH_SPEED_MULTIPLIER = 0.5; // Speed reduction when pushing one player
export const PLAYER_PUSH_SPEED_MULTIPLIER_MULTIPLE = 0.3; // Speed reduction when pushing multiple players
export const PLAYER_BOUNCE = 0.1; // Small bounce on collision
export const MAX_PUSH_VELOCITY = 150; // Maximum velocity from being pushed by another player

// Baby
export const BABY_RADIUS = 8; // 16px diameter / 2
export const CALM_METER_MAX = 100;
export const CALM_METER_DRAIN_RATE = 10; // per second
export const CALM_METER_FILL_RATE = 15; // per second
export const CALM_METER_BAR_WIDTH = 40;
export const CALM_METER_BAR_HEIGHT = 6;
export const CALM_METER_BAR_OFFSET_Y = -20; // Offset above player
export const BABY_OFFSET_Y = -5; // Offset above player when held

// Colors
export const WALL_COLOR = 0x000000;
export const FLOOR_COLOR = 0x1A1A1A;
export const EXIT_COLOR = 0x00FF00;
export const BABY_COLOR = 0xFFFFFF;
export const GOO_GUN_COLOR = 0xFF69B4; // Pink
export const EMP_GUN_COLOR = 0x4169E1; // Blue
export const WATER_GUN_COLOR = 0x00FFFF; // Cyan

// Swapping
export const GROUND_ITEM_PICKUP_RADIUS = 20;
export const PLAYER_SWAP_DURATION = 2000; // 2 seconds in milliseconds
export const PLAYER_OVERLAP_RADIUS = 40;
export const STATIONARY_VELOCITY_THRESHOLD = 5; // Players considered stationary if velocity < this
export const SWAP_PROGRESS_BAR_WIDTH = 30;
export const SWAP_PROGRESS_BAR_HEIGHT = 4;
export const SWAP_PROGRESS_BAR_OFFSET_Y = -30; // Offset above players during swap
export const PUSH_VELOCITY_THRESHOLD = 10; // Velocity difference to determine who's pushing

// Robot (placeholder values for testing - full constants in Phase 3.7)
export const SPIDER_SPEED = 180; // pixels per second
export const SPIDER_SIZE = 24; // pixels
export const SPIDER_COLOR = 0xFF69B4; // Pink
export const SPIDER_LIGHT_RADIUS = 120; // pixels
export const SPIDER_LIGHT_ANGLE = 60; // degrees (total cone angle)
export const SPIDER_LIGHT_COLOR = 0xFF69B4; // Pink

// Shock-Bot constants (for future phases)
export const SHOCK_LIGHT_RADIUS = 150;
export const SHOCK_LIGHT_ANGLE = 45; // degrees
export const SHOCK_LIGHT_COLOR = 0x4169E1; // Blue

// Flame-Bot constants (for future phases)
export const FLAME_LIGHT_RADIUS = 180;
export const FLAME_LIGHT_ANGLE = 50; // degrees
export const FLAME_LIGHT_COLOR = 0xFF4500; // Red-orange

// Debug
export const DEBUG_MODE = true; // Enable verbose debug logging

