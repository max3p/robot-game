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

// Robot constants
export const SPIDER_SPEED = 90; // pixels per second (patrol speed, cut in half from 180)
export const SPIDER_SIZE = 24; // pixels
export const SPIDER_COLOR = 0xFF69B4; // Pink
export const SPIDER_LIGHT_RADIUS = 120; // pixels
export const SPIDER_LIGHT_ANGLE = 60; // degrees (total cone angle)
export const SPIDER_LIGHT_COLOR = 0xFF69B4; // Pink
export const SPIDER_ATTACK_RANGE = 60; // pixels (melee)
export const SPIDER_ATTACK_COOLDOWN = 1000; // milliseconds
export const SPIDER_ATTACK_DAMAGE = 1;
export const SPIDER_LEAP_SPEED = 600; // pixels per second (leap speed toward player)
export const SPIDER_LEAP_DISTANCE = 80; // pixels (fixed distance to leap toward player)
export const SPIDER_RECUPERATION_DURATION = 500; // milliseconds (pause time after leap before chasing again)

// Shock-Bot constants
export const SHOCK_SPEED = 60; // pixels per second (patrol speed, cut in half from 120)
export const SHOCK_SIZE = 36; // pixels
export const SHOCK_COLOR = 0x4169E1; // Blue
export const SHOCK_LIGHT_RADIUS = 150; // pixels
export const SHOCK_LIGHT_ANGLE = 45; // degrees (total cone angle)
export const SHOCK_LIGHT_COLOR = 0x4169E1; // Blue
export const SHOCK_ATTACK_RANGE = 150; // pixels (ranged, matches vision radius - for detection)
export const SHOCK_ATTACK_COOLDOWN = 2000; // milliseconds
export const SHOCK_ATTACK_DAMAGE = 1;
export const SHOCK_ATTACK_CHARGE_TIME = 500; // milliseconds
export const SHOCK_ATTACK_AOE_RADIUS = 75; // pixels (half of vision radius - robot must get closer)
export const SHOCK_MIN_CHASE_DISTANCE = 50; // pixels (robot stops chasing if closer than this)

// Flame-Bot constants
export const FLAME_SPEED = 35; // pixels per second (patrol speed, cut in half from 70)
export const FLAME_SIZE = 48; // pixels
export const FLAME_COLOR = 0xFF4500; // Red-orange
export const FLAME_LIGHT_RADIUS = 180; // pixels
export const FLAME_LIGHT_ANGLE = 50; // degrees (total cone angle)
export const FLAME_LIGHT_COLOR = 0xFF4500; // Red-orange
export const FLAME_ATTACK_RANGE = 140; // pixels (ranged)
export const FLAME_ATTACK_COOLDOWN = 2500; // milliseconds
export const FLAME_ATTACK_DAMAGE = 1;
export const FLAME_ATTACK_CONE_ANGLE = 40; // degrees (flame cone width)
export const FLAME_ATTACK_CONE_LENGTH = 140; // pixels (flame cone length)
export const FLAME_EXPAND_DURATION = 300; // milliseconds (time for flame to expand to full size)
export const FLAME_DAMAGE_INTERVAL = 1000; // milliseconds (damage dealt every second)
export const FLAME_CHASE_SPEED_MULTIPLIER = 0.6; // Flame-bot moves 60% of player speed when chasing (slower for easier evasion)

// Detection and AI
export const ALERT_SPEED_MULTIPLIER = 0.85; // Robots move 85% of player speed when chasing (slower than player)
export const ROBOT_ACCELERATION = 400; // pixels per second squared
export const ROBOT_DECELERATION = 600; // pixels per second squared
export const ROBOT_CHASE_ABANDON_DISTANCE = 3 * TILE_SIZE; // Distance in pixels (3 tiles) at which robot gives up chasing and returns to patrol
export const ROBOT_CLOSE_RANGE_DETECTION_RADIUS = 80; // pixels - robots detect players within this radius regardless of facing direction
export const SHOOTING_SOUND_RADIUS = 200; // pixels - robots detect shooting sounds within this radius
export const SOUND_INVESTIGATION_DURATION = 2000; // milliseconds - robots investigate for 2 seconds after hearing a sound

// Weapons
export const WEAPON_RANGE = 150; // pixels
export const WEAPON_AIM_ARC = 90; // degrees (45 degrees each side of facing direction)
export const GOO_GUN_COOLDOWN = 800; // milliseconds
export const EMP_GUN_COOLDOWN = 1200; // milliseconds
export const WATER_GUN_COOLDOWN = 1000; // milliseconds
export const SPIDER_GOO_HITS_TO_KILL = 3; // Number of goo hits to kill spider
export const SPIDER_GOO_SPEED_REDUCTION = 0.33; // 33% speed reduction per hit
export const SPIDER_LANTERN_RADIUS = 100; // pixels - permanent light radius
export const SHOCK_EMP_HITS_TO_KILL = 4; // Number of EMP hits to kill shock-bot
export const SHOCK_EMP_DAZED_DURATION = 2000; // milliseconds - 2 seconds dazed state after EMP hit

// Debug
export const DEBUG_MODE = true; // Enable verbose debug logging

