/**
 * Design Tokens
 *
 * Color and style constants ported from the Swift DesignSystem.swift.
 * Only the cursor overlay tokens are included — the full panel design
 * system will be added when the chat interface component is built.
 */

export const DS = {
  colors: {
    /** The cursor companion's signature blue glow */
    cursorBlue: "#3b82f6", // Tailwind Blue 500
    cursorBlueDim: "rgba(59, 130, 246, 0.5)",
    cursorBlueGlow: "rgba(59, 130, 246, 0.6)",

    /** Speech bubble background (same blue as cursor) */
    bubbleBackground: "#3b82f6",
    bubbleText: "#ffffff",

    /** Waveform and spinner share the cursor blue */
    waveformBlue: "#3b82f6",
    spinnerBlue: "#3b82f6",

    /** Backgrounds (from Swift DesignSystem) */
    background: "#101211",
    surface1: "#171918",
    surface2: "#202221",
    surface3: "#272A29",

    /** Text */
    textPrimary: "#ECEEED",
    textSecondary: "#ADB5B2",
    textTertiary: "#6B736F",
  },

  /** Default triangle rotation when following cursor (degrees) */
  defaultTriangleRotation: -35,

  /** Buddy offset from the system cursor (px) */
  cursorOffset: { x: 35, y: 25 },

  /**
   * Compact overlay viewport — the small transparent window that
   * follows the buddy around. Components render at fixed LOCAL
   * positions within this viewport; the viewport itself moves.
   */
  viewport: {
    width: 320,
    height: 80,
    /** Where the buddy triangle center sits within the viewport */
    localBuddyX: 24,
    localBuddyY: 40,
  },

  /** Navigation speech bubble phrases */
  pointerPhrases: [
    "right here!",
    "this one!",
    "over here!",
    "click this!",
    "here it is!",
    "found it!",
  ] as const,

  /** Speech bubble character streaming delay range (ms) */
  bubbleStreamDelayRange: { min: 30, max: 60 },

  /** Time to hold the pointing bubble before flying back (ms) */
  pointingHoldDurationMs: 3000,

  /** Distance threshold to cancel return flight (px) */
  returnFlightCancelThresholdPx: 100,
} as const;
