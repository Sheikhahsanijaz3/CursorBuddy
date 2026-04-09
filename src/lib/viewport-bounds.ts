/**
 * Viewport Bounds
 *
 * Returns the coordinate space the buddy lives in.
 *
 * - Web / CDN: the browser viewport (0,0 = top-left of visible page)
 * - Electron overlay: the primary screen in screen coordinates
 *
 * All flyTo coordinates should be within these bounds.
 */

export interface ViewportBounds {
  /** Left edge x coordinate */
  x: number;
  /** Top edge y coordinate */
  y: number;
  /** Viewport width in logical pixels */
  width: number;
  /** Viewport height in logical pixels */
  height: number;
}

/**
 * Get the current viewport bounds.
 * In the browser this is the visible window area.
 * In Electron the main process sends screen bounds via IPC;
 * we cache the latest value.
 */
export function getViewportBounds(): ViewportBounds {
  // Electron: use cached screen bounds if available
  if (cachedScreenBounds) {
    return cachedScreenBounds;
  }

  // Browser: use the visible viewport
  return {
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Return a random point inside the viewport, inset by `padding` px
 * from each edge so the buddy doesn't fly off-screen.
 */
export function randomPointInViewport(padding = 120): { x: number; y: number } {
  const bounds = getViewportBounds();
  return {
    x: bounds.x + padding + Math.random() * (bounds.width - padding * 2),
    y: bounds.y + padding + Math.random() * (bounds.height - padding * 2),
  };
}

/**
 * Return the coordinate of a named viewport position.
 * Padding keeps the buddy away from edges.
 */
export function viewportAnchor(
  position:
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "top-center"
    | "bottom-center"
    | "center-left"
    | "center-right",
  padding = 120
): { x: number; y: number } {
  const b = getViewportBounds();
  const left = b.x + padding;
  const right = b.x + b.width - padding;
  const top = b.y + padding;
  const bottom = b.y + b.height - padding;
  const midX = b.x + b.width / 2;
  const midY = b.y + b.height / 2;

  switch (position) {
    case "center":       return { x: midX, y: midY };
    case "top-left":     return { x: left, y: top };
    case "top-right":    return { x: right, y: top };
    case "bottom-left":  return { x: left, y: bottom };
    case "bottom-right": return { x: right, y: bottom };
    case "top-center":   return { x: midX, y: top };
    case "bottom-center":return { x: midX, y: bottom };
    case "center-left":  return { x: left, y: midY };
    case "center-right": return { x: right, y: midY };
  }
}

// ── Electron screen bounds cache ──────────────────────────────

let cachedScreenBounds: ViewportBounds | null = null;

/**
 * Called from the Electron preload to set the screen bounds.
 * The main process sends these on startup and on display change.
 */
export function setScreenBounds(bounds: ViewportBounds): void {
  cachedScreenBounds = bounds;
}
