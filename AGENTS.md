# CursorBuddy — Agent Instructions

## What This Is

A **drop-in animated cursor companion** — a blue triangle that follows the mouse, flies to screen elements along bezier arcs, shows speech bubbles, and visualises voice states (waveform, spinner). Works in two modes:

1. **Web embed** — `<script src="cursor-buddy.iife.js">` on any page, zero dependencies
2. **Electron desktop** — transparent overlay window that follows the real cursor across the OS

Both modes use the same React components and event bus. The Electron shell is a thin wrapper.

## Hard Rules

- **Cross-platform always.** Every line of code must work on macOS, Windows, and Linux. No platform-specific code without a fallback for the other two. Test your assumptions.
- **Two build targets.** The library build (`npm run build:lib`) produces a self-contained IIFE for `<script>` tags and an ESM for `import`. The app build (`npm run build`) produces the Electron app. Both must pass.
- **Event bus is the API boundary.** Components never import each other directly. All communication flows through `eventBus.emit()` / `eventBus.on()`. This is what makes the overlay embeddable — external code drives it through the same events.
- **Viewport-aware coordinates.** Never hardcode pixel values for screen positions. Use `getViewportBounds()`, `viewportAnchor()`, `randomPointInViewport()` from `viewport-bounds.ts`. In Electron these return real screen geometry from the main process. In the browser they return `window.innerWidth/Height`.
- **No platform sniffing in components.** React components (`src/components/`) must not check for Electron/browser. Platform differences live in hooks (`use-cursor-tracking.ts`) and utilities (`move-overlay-window.ts`, `viewport-bounds.ts`).
- **Fixed local positions.** Components render at fixed positions within the 320×80 viewport. The viewport itself moves (CSS transform in browser, `window.setPosition()` in Electron). Components never use `buddyPosition` for their own transforms.
- **GPU-composited rendering.** All motion uses CSS `transform` (not `top`/`left`). The bezier flight uses `requestAnimationFrame`. The waveform uses `<canvas>`. No layout thrashing.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                     Event Bus                          │
│  cursor:* · voice:* · capture:* · inference:* · tts:*  │
└──────┬──────────┬───────────┬──────────┬───────────────┘
       │          │           │          │
       ▼          ▼           ▼          ▼
  ┌─────────┐ ┌────────┐ ┌────────┐ ┌──────────────────┐
  │ Voice   │ │Capture │ │Claude  │ │ Cursor Overlay   │
  │ Input   │ │Service │ │Infer.  │ │ (this package)   │
  └─────────┘ └────────┘ └────────┘ └──────────────────┘
```

### Overlay Viewport Model

The overlay is a **320×80 transparent container** that moves to follow the buddy:

```
Screen
┌─────────────────────────────────────────────┐
│                                             │
│        ┌──────────────────────┐             │
│        │ ▲  "right here!"    │ ← 320×80    │
│        │ buddy  bubble       │   viewport   │
│        └──────────────────────┘             │
│                                             │
└─────────────────────────────────────────────┘
```

- **Electron:** The viewport IS the BrowserWindow. Main process moves it via `setPosition()`.
- **Browser:** The viewport is a `position:fixed` div moved via CSS `transform`.
- **Components** render at `DS.viewport.localBuddyX/Y` — never at screen coordinates.

### Coordinate Flow

```
Cursor position (screen coords)
  → buddyPosition = cursor + offset (store)
  → viewport moves so localBuddy maps to buddyPosition
  → components render at fixed local positions within viewport
```

During bezier flight:
```
Bezier engine → buddyPosition each frame (store)
                → moveOverlayWindow() moves Electron window (IPC)
                → OverlayViewport CSS transform (browser)
```

## File Map

| File | Purpose |
|------|---------|
| **Library** | |
| `src/index.ts` | Library entry. Exports `init()` → mounts overlay, returns controller with `flyTo()`, `flyToAnchor()`, `flyToElement()`, `setVoiceState()`, etc. |
| `src/events/event-bus.ts` | Typed EventEmitter. All inter-component comms. Bridgeable to WebSocket/SSE. |
| `src/stores/cursor-store.ts` | Zustand store. Position, voice state, navigation mode, animation params. 60fps selector-based updates. |
| `src/lib/bezier-flight.ts` | Quadratic bezier arc engine. Smoothstep easing, tangent rotation, scale pulse. Ported from Swift. |
| `src/lib/point-tag-parser.ts` | Parses `[POINT:x,y:label:screenN]` from Claude responses. Pure function. |
| `src/lib/viewport-bounds.ts` | `getViewportBounds()`, `viewportAnchor()`, `randomPointInViewport()`. Reads browser viewport or Electron screen bounds. |
| `src/lib/design-tokens.ts` | Colors, viewport dimensions, animation constants. Single source of truth. |
| `src/lib/move-overlay-window.ts` | Electron: IPC `setWindowPosition`. Browser: no-op. Also `setFollowingCursor()`. |
| `src/lib/spring-physics.ts` | Damped spring simulation matching SwiftUI `spring(response: 0.2, dampingFraction: 0.6)`. Used by cursor tracking. |
| **Components** | |
| `src/components/CursorOverlay.tsx` | Root. Wires event bus → store, mounts sub-components in OverlayViewport. |
| `src/components/OverlayViewport.tsx` | Platform-aware container. Electron: static div. Browser: CSS-transform div. |
| `src/components/BlueCursorTriangle.tsx` | Blue triangle SVG. Rotation + scale from store. Fixed local position. |
| `src/components/BlueCursorWaveform.tsx` | 5-bar canvas waveform. Audio-reactive. Pyramid profile `[0.4, 0.7, 1.0, 0.7, 0.4]`. |
| `src/components/BlueCursorSpinner.tsx` | SVG spinning arc. Processing state. |
| `src/components/NavigationBubble.tsx` | Speech bubble. Scale-bounce entrance, character streaming. |
| `src/components/DemoControls.tsx` | Browser-only dev panel. Uses viewport-bounds for coordinates. |
| **Hooks** | |
| `src/hooks/use-cursor-tracking.ts` | Electron: listens for IPC position from main. Browser: mousemove. Updates store. |
| `src/hooks/use-buddy-navigation.ts` | Full flight sequence: fly → point → hold 3s → return. Drives bezier + store + window position. |
| **Electron** | |
| `electron/main.js` | Creates overlay + panel windows. 60fps cursor poll + window move. IPC relay. Sends screen bounds. |
| `electron/preload.js` | Overlay bridge: cursor position, window position, screen bounds, overlay commands. |
| `electron/preload-panel.js` | Panel bridge: send commands, receive screen bounds. |
| `electron/panel.html` | Dev control panel. Uses real screen bounds for all coordinates. |
| **Build** | |
| `vite.config.ts` | Dev server + Electron app build. |
| `vite.lib.config.ts` | Library build → `cursor-buddy.iife.js` (bundled) + `cursor-buddy.es.js` (React external). |
| `tsconfig.lib.json` | TypeScript config for declaration-only emit (`build:lib`). |
| `test.html` | Local CDN test page. Loads `dist/clicky-x.iife.js` via serve. |

## Public API

```ts
const buddy = CursorBuddy.init({ container?: HTMLElement });

// Fly to coordinates
buddy.flyTo(x, y, label, bubbleText?);

// Fly to a viewport anchor
buddy.flyToAnchor('top-right', label, bubbleText?);
// Anchors: center, top-left, top-center, top-right, center-left,
//          center-right, bottom-left, bottom-center, bottom-right

// Fly to a DOM element
buddy.flyToElement(document.querySelector('.btn'), label, bubbleText?);

// Fly to a random viewport position
buddy.flyToRandom(label?, bubbleText?);

// Voice states
buddy.setVoiceState('idle' | 'listening' | 'processing' | 'responding');
buddy.setAudioLevel(0.0 - 1.0);

// Visibility
buddy.show();
buddy.hide();

// Viewport info
buddy.getViewport(); // → { x, y, width, height }

// Events
buddy.on('cursor:arrived', () => {});
buddy.on('cursor:returned', () => {});

// Cleanup
buddy.destroy();
```

## Build & Run

```bash
npm install

# Browser dev (cursor follows mouse, demo controls visible)
npm run dev

# Electron dev (transparent overlay + control panel)
npm run dev:electron

# Library build (IIFE + ESM)
npm run build:lib

# Electron production build
npm run build && npm start

# Test the script-tag embed (builds lib + serves locally)
npm run test:web
```

## Animation Math (ported from Swift)

All bezier flight math in `bezier-flight.ts` matches the original `OverlayWindow.swift`:

- **Easing:** Hermite smoothstep `3t² - 2t³`
- **Path:** Quadratic bezier `B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2`
- **Rotation:** Tangent to curve `B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)`, +90° offset
- **Scale:** Sine pulse `1.0 + sin(πt) × 0.3` — peaks at 1.3× midpoint
- **Arc height:** `min(distance × 0.2, 80px)`
- **Duration:** `clamp(distance / 800, 0.6, 1.4)` seconds

## Do NOT

- Hardcode screen dimensions or pixel positions anywhere
- Put platform checks (`electronAPI`, `window.innerWidth`) inside React components
- Use `position: absolute` with `top`/`left` for animation (use `transform`)
- Add dependencies without checking they work in both IIFE bundle and Electron
- Break the event bus contract — it's the public API surface
- Import from `electron/` in `src/` or vice versa
