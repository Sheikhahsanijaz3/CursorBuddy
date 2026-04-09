/**
 * POINT Tag Parser
 *
 * Parses [POINT:x,y:label:screenN] and [POINT:none] tags from
 * Claude's response text. Direct port of the Swift regex in
 * CompanionManager.parsePointingCoordinates().
 *
 * This module is pure — no side effects, no dependencies.
 * Can be used in any JavaScript runtime (browser, Node, Deno).
 */

export interface PointingParseResult {
  /** The response text with the [POINT:...] tag removed — spoken aloud */
  spokenText: string;
  /** Parsed pixel coordinate, or null if Claude said "none" or no tag found */
  coordinate: { x: number; y: number } | null;
  /** Short label describing the element (e.g. "run button"), or "none" */
  elementLabel: string | null;
  /** Which screen the coordinate refers to (1-based), or null for cursor screen */
  screenNumber: number | null;
}

/**
 * Parses a [POINT:x,y:label:screenN] or [POINT:none] tag from the
 * end of Claude's response.
 *
 * Matches:
 *   [POINT:none]
 *   [POINT:123,456:label]
 *   [POINT:123,456:label:screen2]
 */
export function parsePointingCoordinates(
  responseText: string
): PointingParseResult {
  // Same regex as the Swift version
  const pattern =
    /\[POINT:(?:none|(\d+)\s*,\s*(\d+)(?::([^\]:\s][^\]:]*?))?(?::screen(\d+))?)\]\s*$/;

  const match = responseText.match(pattern);

  if (!match) {
    // No tag found
    return {
      spokenText: responseText,
      coordinate: null,
      elementLabel: null,
      screenNumber: null,
    };
  }

  // Remove the tag from spoken text
  const tagStartIndex = responseText.lastIndexOf(match[0]);
  const spokenText = responseText.slice(0, tagStartIndex).trim();

  // Check if it's [POINT:none]
  if (!match[1] || !match[2]) {
    return {
      spokenText,
      coordinate: null,
      elementLabel: "none",
      screenNumber: null,
    };
  }

  const x = parseInt(match[1], 10);
  const y = parseInt(match[2], 10);
  const elementLabel = match[3]?.trim() ?? null;
  const screenNumber = match[4] ? parseInt(match[4], 10) : null;

  return {
    spokenText,
    coordinate: { x, y },
    elementLabel,
    screenNumber,
  };
}
