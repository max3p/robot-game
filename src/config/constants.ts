// Display constants
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 960;
export const TILE_SIZE = 96;

// Player
export const BASE_PLAYER_SPEED = 200;
export const BABY_HOLDER_SPEED = 120; // 60% of base speed
export const PLAYER_RADIUS = 16; // 32px diameter / 2
export const PLAYER_COLORS = [0x00FF00, 0x0088FF, 0xFFFF00, 0xAA00FF]; // Green, Blue, Yellow, Purple

// Baby
export const BABY_RADIUS = 8; // 16px diameter / 2
export const CALM_METER_MAX = 100;
export const CALM_METER_DRAIN_RATE = 10; // per second
export const CALM_METER_FILL_RATE = 15; // per second

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

// Debug
export const DEBUG_MODE = false; // Enable verbose debug logging

