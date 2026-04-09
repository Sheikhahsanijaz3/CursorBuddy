# Cursor Animation

CursorBuddy's animations are ported from the original Swift implementation. Every motion uses GPU-composited CSS `transform` — never `top`/`left` — for smooth 60fps rendering.

---

## Spring Physics (Cursor Following)

When following the cursor, the buddy's position is smoothed through a damped spring simulation matching SwiftUI's `.spring(response: 0.2, dampingFraction: 0.6)`.

### Spring Parameters

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `response` | 0.2 | Natural period in seconds |
| `dampingFraction` | 0.6 | Underdamped (< 1.0 = oscillates slightly) |

### The Math

```
ω = 2π / response          → Angular frequency
ζ = dampingFraction         → Damping ratio

Spring force:   F = -ω² × displacement
Damping force:  D = -2ζω × velocity
Acceleration:   a = F + D

Integration: semi-implicit Euler (stable for springs)
  velocity += acceleration × dt
  position += velocity × dt
```

The spring runs on `requestAnimationFrame` for frame-perfect smoothing. When displacement and velocity are both < 0.1, the spring snaps to the target to avoid infinite micro-oscillation.

### Buddy Offset

The buddy sits 35px right and 25px below the system cursor:

```
buddyTarget.x = cursor.x + 35
buddyTarget.y = cursor.y + 25
```

### Initialization

On the first cursor event, the spring is seeded at the cursor position (not 0,0) so there's no initial fly-in animation from the corner.

---

## Bezier Flight Animation

When the buddy flies to a target element, it follows a quadratic bezier arc with smooth easing.

### Path: Quadratic Bezier

```
B(t) = (1-t)² · P0 + 2(1-t)t · P1 + t² · P2

P0 = start position (current buddy location)
P1 = control point (midpoint, offset upward)
P2 = end position (target element)
```

### Control Point (Arc Shape)

The control point sits above the midpoint of the start→end line, creating a parabolic arc:

```
midX = (start.x + end.x) / 2
midY = (start.y + end.y) / 2
arcHeight = min(distance × 0.2, 80px)
controlPoint = (midX, midY - arcHeight)
```

### Easing: Hermite Smoothstep

Linear progress `t` is transformed through smoothstep for ease-in-out:

```
eased = 3t² - 2t³
```

This produces zero velocity at both endpoints and smooth acceleration/deceleration.

### Duration

Flight duration scales with distance, clamped to a comfortable range:

```
duration = clamp(distance / 800, 0.6, 1.4) seconds
```

Short flights take 0.6s minimum. Long cross-screen flights cap at 1.4s.

### Rotation (Tangent to Curve)

The triangle rotates to point along the direction of travel:

```
B'(t) = 2(1-t)(P1 - P0) + 2t(P2 - P1)    ← bezier tangent
angle = atan2(tangent.y, tangent.x) + 90°   ← +90° because triangle tip is "up"
```

### Scale Pulse

The buddy grows to 1.3× at the midpoint of flight, creating a "swooping" feel:

```
scale = 1.0 + sin(π × progress) × 0.3
```

This produces a smooth sine pulse: 1.0 → 1.3 → 1.0.

### Glow Intensification

The blue glow radius increases during flight proportional to scale:

```
glowRadius = baseGlow + (flightScale - 1.0) × 20
```

---

## Flight Sequence

The full navigation sequence has four phases:

### Phase 1: Fly to Target

1. Cursor-following is paused
2. Bezier flight starts from current buddy position to target (offset +8px right, +12px down)
3. Each frame updates: position, rotation, scale, and window position (Electron)
4. On complete → Phase 2

### Phase 2: Arrive and Point

1. Navigation mode switches to `pointing-at-target`
2. Rotation resets to default (-35°)
3. Speech bubble appears with scale-bounce entrance (0.5 → 1.0, cubic-bezier overshoot)
4. Text streams character by character (30–60ms per character, randomized)
5. Random phrase chosen from: "right here!", "this one!", "over here!", "click this!", "here it is!", "found it!"
6. After streaming completes → hold for 3 seconds

### Phase 3: Hold

The buddy stays at the target for 3 seconds (configurable via `DS.pointingHoldDurationMs`), then:
1. Speech bubble fades out over 0.5s
2. → Phase 4

### Phase 4: Fly Back

1. Bezier flight from current position back to where the cursor is NOW (not where it was)
2. Same bezier arc + rotation + scale animation as Phase 1
3. On complete: cursor-following resumes, all navigation state resets
4. `cursor:returned` event emitted

### Cancellation

If the user moves the cursor more than 100px from where it was when navigation started (during the return flight), the flight is cancelled and cursor-following resumes immediately.

---

## Visual States

All three visual indicators (triangle, waveform, spinner) stay mounted at all times and cross-fade via CSS `opacity` transitions. This avoids the visible pop that React unmount/remount would cause.

| State | Triangle Opacity | Waveform Opacity | Spinner Opacity |
|-------|-----------------|------------------|-----------------|
| `idle` | 1.0 | 0 | 0 |
| `listening` | 0 | 1.0 | 0 |
| `processing` | 0 | 0 | 1.0 |
| `responding` | 1.0 | 0 | 0 |

Transition times:
- Triangle: 0.25s ease-in
- Waveform: 0.15s ease
- Spinner: 0.15s ease

---

## The Blue Triangle

The triangle is an equilateral SVG polygon matching the Swift implementation exactly:

```
height = size × √3 / 2
top vertex:    (size/2, size/2 - height/1.5)
bottom-left:   (0, size/2 + height/3)
bottom-right:  (size, size/2 + height/3)
```

Default size is 16px. Color, size, and glow are all configurable at runtime.

---

## The Waveform

Five vertical bars with a pyramid height profile: `[0.4, 0.7, 1.0, 0.7, 0.4]`. The center bar is tallest.

Rendered on a `<canvas>` element at 60fps via `requestAnimationFrame`:

- **Bar width:** 2px, **gap:** 2px, **corner radius:** 1.5px
- **Audio reactivity:** `pow(min(level × 2.85, 1), 0.76)` — eased for natural feel
- **Idle pulse:** each bar has a sine wave offset creating a ripple effect
- **Phase offset:** 0.35 per bar, animation speed 3.6× time

---

## The Spinner

A spinning SVG arc (circle with `strokeDasharray: "24.2 10.4"`). Rotates via CSS keyframes at 0.8s per revolution.
