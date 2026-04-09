/**
 * Bezier Flight Animation
 *
 * Quadratic bezier arc animation engine, ported from the Swift
 * OverlayWindow.swift implementation. Drives the buddy's flight
 * from cursor to target element and back.
 *
 * All math matches the original:
 * - Hermite smoothstep easing: 3t² - 2t³
 * - Quadratic bezier: B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
 * - Tangent rotation: B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
 * - Scale pulse: sin(π·t) peaking at 1.3× midpoint
 * - Arc height: min(distance × 0.2, 80px)
 * - Duration: clamp(distance / 800, 0.6, 1.4) seconds
 */

export interface Point {
  x: number;
  y: number;
}

export interface BezierFlightFrame {
  /** Current position along the bezier arc */
  position: Point;
  /** Rotation in degrees (tangent to curve + 90° offset) */
  rotationDegrees: number;
  /** Scale factor (1.0 → 1.3 → 1.0 sine pulse) */
  scale: number;
  /** Linear progress 0–1 */
  progress: number;
}

export interface BezierFlightConfig {
  from: Point;
  to: Point;
  /** Called on each animation frame (~60fps) */
  onFrame: (frame: BezierFlightFrame) => void;
  /** Called when the flight completes */
  onComplete: () => void;
}

/**
 * Starts a bezier arc flight animation.
 * Returns a cancel function that stops the animation immediately.
 */
export function startBezierFlight(config: BezierFlightConfig): () => void {
  const { from, to, onFrame, onComplete } = config;

  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);

  // Flight duration scales with distance, clamped to 0.6s–1.4s
  const flightDurationMs = Math.min(Math.max(distance / 800, 0.6), 1.4) * 1000;

  // Control point: midpoint offset upward for the parabolic arc
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const arcHeight = Math.min(distance * 0.2, 80);
  const controlPoint: Point = { x: midX, y: midY - arcHeight };

  let startTime: number | null = null;
  let animationFrameId: number | null = null;
  let cancelled = false;

  function tick(timestamp: number) {
    if (cancelled) return;

    if (startTime === null) {
      startTime = timestamp;
    }

    const elapsed = timestamp - startTime;
    const linearProgress = Math.min(elapsed / flightDurationMs, 1.0);

    // Hermite smoothstep easeInOut: 3t² - 2t³
    const t =
      linearProgress * linearProgress * (3.0 - 2.0 * linearProgress);

    // Quadratic bezier: B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
    const oneMinusT = 1.0 - t;
    const bezierX =
      oneMinusT * oneMinusT * from.x +
      2.0 * oneMinusT * t * controlPoint.x +
      t * t * to.x;
    const bezierY =
      oneMinusT * oneMinusT * from.y +
      2.0 * oneMinusT * t * controlPoint.y +
      t * t * to.y;

    // Tangent to bezier: B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
    const tangentX =
      2.0 * oneMinusT * (controlPoint.x - from.x) +
      2.0 * t * (to.x - controlPoint.x);
    const tangentY =
      2.0 * oneMinusT * (controlPoint.y - from.y) +
      2.0 * t * (to.y - controlPoint.y);

    // +90° because the triangle tip points up at 0° rotation,
    // atan2 returns 0° for rightward movement
    const rotationDegrees =
      Math.atan2(tangentY, tangentX) * (180 / Math.PI) + 90;

    // Scale pulse: sin curve peaks at 1.3× at the midpoint
    const scalePulse = Math.sin(linearProgress * Math.PI);
    const scale = 1.0 + scalePulse * 0.3;

    onFrame({
      position: { x: bezierX, y: bezierY },
      rotationDegrees,
      scale,
      progress: linearProgress,
    });

    if (linearProgress >= 1.0) {
      onComplete();
      return;
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  animationFrameId = requestAnimationFrame(tick);

  // Return cancel function
  return () => {
    cancelled = true;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}
