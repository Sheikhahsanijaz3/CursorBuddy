/**
 * POINT Tag Parser (Node.js)
 *
 * Parses [POINT:x,y:label:screenN] and [POINT:none] tags from
 * Claude's response text. Shared between main.js inference handler
 * and voice-response.js pipeline.
 *
 * Mirrors the TypeScript version in src/lib/point-tag-parser.ts.
 */

const POINT_REGEX = /\[POINT:(?:none|(\d+)\s*,\s*(\d+)(?::([^\]:\s][^\]:]*?))?(?::screen(\d+))?)\]\s*$/;

/**
 * Parse a POINT tag from the end of a response string.
 * @param {string} responseText
 * @returns {{ spokenText: string, coordinate: {x:number, y:number}|null, elementLabel: string|null, screenNumber: number|null }}
 */
function parsePointingCoordinates(responseText) {
  const match = responseText.match(POINT_REGEX);
  if (!match) {
    return { spokenText: responseText, coordinate: null, elementLabel: null, screenNumber: null };
  }

  const tagStartIndex = responseText.lastIndexOf(match[0]);
  const spokenText = responseText.slice(0, tagStartIndex).trim();

  if (!match[1] || !match[2]) {
    return { spokenText, coordinate: null, elementLabel: "none", screenNumber: null };
  }

  return {
    spokenText,
    coordinate: { x: parseInt(match[1], 10), y: parseInt(match[2], 10) },
    elementLabel: (match[3] || "element").trim(),
    screenNumber: match[4] ? parseInt(match[4], 10) : null,
  };
}

/**
 * Parse an inline [POINT:...] tag (not necessarily at end of string).
 * Used by voice pipeline for mid-stream detection.
 * @param {string} tag - e.g. "[POINT:123,456:button:screen2]"
 * @returns {{ imgX: number, imgY: number, label: string, screenNumber: number|null }|null}
 */
function parseInlinePointTag(tag) {
  const m = tag.match(/\[POINT:(\d+)\s*,\s*(\d+)(?::([^\]:\s][^\]:]*?))?(?::screen(\d+))?\]/);
  if (!m) return null;
  return {
    imgX: parseInt(m[1]),
    imgY: parseInt(m[2]),
    label: (m[3] || "element").trim(),
    screenNumber: m[4] ? parseInt(m[4]) : null,
  };
}

module.exports = { parsePointingCoordinates, parseInlinePointTag, POINT_REGEX };
