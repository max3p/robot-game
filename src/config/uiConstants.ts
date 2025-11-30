/**
 * UI Constants
 * Constants related to UI rendering, layout, and styling
 */

// Hearts UI Layout
export const HEART_SIZE = 20; // Size of each heart
export const HEART_SPACING = 5; // Space between hearts
export const PLAYER_SPACING = 30; // Space between player groups
export const MARGIN_TOP = 20; // Top margin
export const MARGIN_LEFT = 20; // Left margin

// UI Colors
export const HEART_OUTLINE_COLOR = 0x666666; // Gray color for empty hearts

// UI Depths (z-index ordering)
export const UI_DEPTH_HEARTS = 100; // Hearts UI above everything
export const UI_DEPTH_SHOT_EFFECTS = 100; // Shot effects above most things
export const UI_DEPTH_BACKGROUND_OVERLAY = 50; // Background overlays for menus

// Button Styles
export const BUTTON_PADDING = { x: 20, y: 10 };
export const BUTTON_BACKGROUND_COLOR = '#1a1a1a';
export const BUTTON_HOVER_COLOR_DARKEN = 0.9; // Multiplier for hover state (0.9 = 90% brightness)

// Text Styles
export const TEXT_STYLE_TITLE = {
  fontSize: '64px',
  fontStyle: 'bold',
  stroke: '#000000',
  strokeThickness: 4
};

export const TEXT_STYLE_SUBTITLE = {
  fontSize: '32px',
  fontStyle: 'bold',
  stroke: '#000000',
  strokeThickness: 3
};

export const TEXT_STYLE_BUTTON = {
  fontSize: '32px',
  fontStyle: 'bold',
  stroke: '#000000',
  strokeThickness: 3,
  backgroundColor: BUTTON_BACKGROUND_COLOR,
  padding: BUTTON_PADDING
};

// Scene Overlay
export const OVERLAY_COLOR = 0x000000;
export const OVERLAY_ALPHA = 0.7; // Semi-transparent black
