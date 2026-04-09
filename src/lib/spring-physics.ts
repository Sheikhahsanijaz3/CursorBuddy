/**
 * Spring Physics
 *
 * Damped spring simulation matching SwiftUI's
 * .spring(response: 0.2, dampingFraction: 0.6, blendDuration: 0)
 *
 * SwiftUI's spring parameters:
 *   response = 0.2     → natural period (seconds)
 *   dampingFraction = 0.6  → underdamped (< 1.0 = oscillates)
 *
 * The math: critically-damped-like spring with overshoot.
 *   ω = 2π / response           (angular frequency)
 *   ζ = dampingFraction          (damping ratio)
 *   ωd = ω × √(1 - ζ²)         (damped frequency)
 *
 * We simulate this as a second-order system that smooths position
 * updates at ~60fps, producing the same elastic trailing feel as
 * SwiftUI's spring animation on cursor position.
 */

export interface SpringState {
  /** Current smoothed value */
  current: number;
  /** Current velocity */
  velocity: number;
}

export interface SpringConfig {
  /** Natural period in seconds (SwiftUI "response"). Default 0.2 */
  response: number;
  /** Damping ratio (0–1, <1 = bouncy). Default 0.6 */
  dampingFraction: number;
}

/** Default config matching the Swift original */
export const CURSOR_SPRING_CONFIG: SpringConfig = {
  response: 0.2,
  dampingFraction: 0.6,
};

/**
 * Advance a spring simulation by one time step.
 *
 * @param state   Current spring state (mutated in place for perf)
 * @param target  Target value to spring toward
 * @param config  Spring parameters
 * @param dt      Time step in seconds (typically 1/60)
 * @returns The new current value
 */
export function springStep(
  state: SpringState,
  target: number,
  config: SpringConfig,
  dt: number
): number {
  // Derived spring constants
  const omega = (2 * Math.PI) / config.response; // angular frequency
  const zeta = config.dampingFraction;            // damping ratio

  // Displacement from target
  const displacement = state.current - target;

  // Spring force: -ω²·x - 2ζω·v
  const springForce = -omega * omega * displacement;
  const dampingForce = -2 * zeta * omega * state.velocity;
  const acceleration = springForce + dampingForce;

  // Semi-implicit Euler integration (stable for springs)
  state.velocity += acceleration * dt;
  state.current += state.velocity * dt;

  // Snap to target when close enough (avoid infinite micro-oscillation)
  if (
    Math.abs(displacement) < 0.1 &&
    Math.abs(state.velocity) < 0.1
  ) {
    state.current = target;
    state.velocity = 0;
  }

  return state.current;
}

/**
 * Create a fresh spring state starting at a given value.
 */
export function createSpringState(initial: number): SpringState {
  return { current: initial, velocity: 0 };
}
