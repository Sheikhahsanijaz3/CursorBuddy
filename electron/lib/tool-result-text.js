/**
 * Tool Result Text Extractor
 *
 * Normalizes the various formats MCP tools and pi-compatible tools
 * return into a plain text string for Anthropic's tool_result content.
 *
 * Handles: raw strings, MCP content arrays, { result } wrappers,
 * and falls back to JSON.stringify for anything else.
 */

/**
 * @param {any} toolResult
 * @returns {string}
 */
function extractToolResultText(toolResult) {
  if (typeof toolResult === "string") {
    return toolResult;
  }
  if (toolResult?.content && Array.isArray(toolResult.content)) {
    const textParts = toolResult.content
      .filter(c => c.type === "text")
      .map(c => c.text);
    return textParts.length > 0 ? textParts.join("\n") : JSON.stringify(toolResult);
  }
  if (toolResult?.result) {
    return typeof toolResult.result === "string"
      ? toolResult.result
      : JSON.stringify(toolResult.result);
  }
  return JSON.stringify(toolResult);
}

module.exports = { extractToolResultText };
