# Design Tokens

All colors, dimensions, and animation constants are centralized in the design system. Static tokens live in `design-tokens.ts`; mutable overrides live in `runtime-config.ts`.

---

## Colors

| Token | Value | Usage |
|-------|-------|-------|
| `cursorBlue` | `#3b82f6` | Triangle, waveform, spinner, bubble |
| `cursorBlueDim` | `rgba(59, 130, 246, 0.5)` | Dimmed blue |
| `cursorBlueGlow` | `rgba(59, 130, 246, 0.6)` | Glow effects |
| `bubbleBackground` | `#3b82f6` | Speech bubble fill |
| `bubbleText` | `#ffffff` | Speech bubble text |
| `waveformBlue` | `#3b82f6` | Waveform bars |
| `spinnerBlue` | `#3b82f6` | Spinner stroke |
| `background` | `#101211` | App background |
| `surface1` | `#171918` | First surface layer |
| `surface2` | `#202221` | Second surface layer |
| `surface3` | `#272A29` | Third surface layer |
| `textPrimary` | `#ECEEED` | Primary text |
| `textSecondary` | `#ADB5B2` | Secondary text |
| `textTertiary` | `#6B736F` | Tertiary / muted text |

---

## Viewport Dimensions

| Token | Value | Description |
|-------|-------|-------------|
| `viewport.width` | `320` | Overlay viewport width in pixels |
| `viewport.height` | `80` | Overlay viewport height in pixels |
| `viewport.localBuddyX` | `24` | Buddy's X position within the viewport |
| `viewport.localBuddyY` | `40` | Buddy's Y position within the viewport |

The viewport is the small transparent container that moves to follow the buddy. In Electron, this is the `BrowserWindow`. In the browser, it's a CSS-transformed `div`.

---

## Cursor Offset

| Token | Value | Description |
|-------|-------|-------------|
| `cursorOffset.x` | `35` | Buddy sits 35px right of the system cursor |
| `cursorOffset.y` | `25` | Buddy sits 25px below the system cursor |

---

## Animation Constants

| Token | Value | Description |
|-------|-------|-------------|
| `defaultTriangleRotation` | `-35°` | Triangle rotation when following cursor |
| `bubbleStreamDelayRange.min` | `30ms` | Min delay between streamed characters |
| `bubbleStreamDelayRange.max` | `60ms` | Max delay between streamed characters |
| `pointingHoldDurationMs` | `3000ms` | How long to hold at target before flying back |
| `returnFlightCancelThresholdPx` | `100px` | Cursor movement distance that cancels return flight |

---

## Pointer Phrases

Random phrases shown in the speech bubble when no custom text is provided:

```
"right here!"
"this one!"
"over here!"
"click this!"
"here it is!"
"found it!"
```

---

## Chat Panel Colors

| Token | Value | Usage |
|-------|-------|-------|
| `bg` | `#0c0e12` | Chat background |
| `surface` | `rgba(17, 20, 27, 0.9)` | Message area |
| `surfaceHover` | `rgba(25, 28, 36, 0.9)` | Hover state |
| `border` | `rgba(59, 130, 246, 0.1)` | Borders |
| `text` | `#e2e8f0` | Chat text |
| `dim` | `#64748b` | Dimmed text |
| `muted` | `#3a413d` | Muted elements |
| `blue` | `#3b82f6` | Accent / buttons |
| `blueDim` | `rgba(59, 130, 246, 0.12)` | Dimmed accent |
| `userBubble` | `rgba(59, 130, 246, 0.15)` | User message background |
| `assistantBubble` | `rgba(255, 255, 255, 0.04)` | Assistant message background |

---

## Bezier Flight Constants

| Constant | Formula | Description |
|----------|---------|-------------|
| Arc height | `min(distance × 0.2, 80px)` | Control point offset above midpoint |
| Duration | `clamp(distance / 800, 0.6, 1.4)s` | Flight time in seconds |
| Easing | `3t² - 2t³` | Hermite smoothstep |
| Scale pulse | `1.0 + sin(πt) × 0.3` | Peaks at 1.3× midpoint |
| Tangent offset | `+90°` | Added to atan2 for triangle orientation |

---

## Waveform Constants

| Constant | Value | Description |
|----------|-------|-------------|
| Bar count | `5` | Number of vertical bars |
| Bar profile | `[0.4, 0.7, 1.0, 0.7, 0.4]` | Height multipliers (pyramid) |
| Bar width | `2px` | Each bar's width |
| Bar gap | `2px` | Space between bars |
| Bar radius | `1.5px` | Corner rounding |
| Animation speed | `3.6` | Idle pulse frequency multiplier |
| Phase offset | `0.35` | Per-bar sine phase shift |
