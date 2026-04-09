# Architecture

How CursorBuddy's pieces fit together.

---

## High-Level Overview

```
┌──────────────────────────────────────────────────────────┐
│                       Event Bus                          │
│   cursor:* · voice:* · capture:* · inference:* · tts:*   │
└───────┬──────────┬───────────┬──────────┬────────────────┘
        │          │           │          │
        ▼          ▼           ▼          ▼
  ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────────┐
  │  Voice   │ │ Screen  │ │   AI    │ │  Cursor Overlay  │
  │  Input   │ │ Capture │ │ Infer.  │ │  (React + store) │
  └──────────┘ └─────────┘ └─────────┘ └──────────────────┘
```

Every subsystem communicates exclusively through the event bus. Components never import each other directly. This decoupling is what makes CursorBuddy work in both browser and Electron — the same events flow regardless of the runtime.

---

## Two Runtimes, Same Components

### Browser (Web Embed)

```
┌────────────────────────────────────────────┐
│  Web Page                                   │
│  ┌──────────────────────────────────────┐  │
│  │  #cursor-buddy-root (position:fixed) │  │
│  │  ┌──────────────────────────────┐    │  │
│  │  │  OverlayViewport (CSS transform) │  │
│  │  │  ├─ BlueCursorTriangle       │    │  │
│  │  │  ├─ BlueCursorWaveform       │    │  │
│  │  │  ├─ BlueCursorSpinner        │    │  │
│  │  │  └─ NavigationBubble         │    │  │
│  │  └──────────────────────────────┘    │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

- Mounted via `CursorBuddy.init()` → creates a `div#cursor-buddy-root` on `document.body`
- `OverlayViewport` moves via CSS `transform: translate(x, y)`
- Cursor tracked via `mousemove` events
- Spring physics runs in `requestAnimationFrame`

### Electron (Desktop App)

```
┌─────────────────────────────────────────────────────────┐
│  Main Process                                            │
│  ├─ Tray icon                                           │
│  ├─ Cursor tracking (16ms poll via screen.getCursorScreenPoint) │
│  ├─ Services: capture, inference, transcription, tts    │
│  ├─ MCP server + client                                 │
│  └─ Tool loader                                         │
│                                                          │
│  Overlay Window (320×80, transparent, click-through)     │
│  ┌──────────────────────────────────────┐               │
│  │  OverlayViewport (static div)        │               │
│  │  ├─ BlueCursorTriangle               │               │
│  │  ├─ BlueCursorWaveform               │               │
│  │  ├─ BlueCursorSpinner                │               │
│  │  └─ NavigationBubble                 │               │
│  └──────────────────────────────────────┘               │
│                                                          │
│  Panel Window (680×580, frameless, transparent)          │
│  ┌──────────────────────────────────────┐               │
│  │  Chat, Settings, MCP config          │               │
│  └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

- Overlay window is positioned by `setPosition()` calls from the renderer
- Main process polls cursor position and sends it via IPC
- Spring physics runs in the renderer (not main process)
- Panel commands relay through main process → overlay via IPC → event bus

---

## Overlay Viewport Model

The overlay is a 320×80px transparent container. Components render at fixed LOCAL positions within it. The viewport itself moves to place them at the correct screen location.

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

### Coordinate Flow

```
System cursor position (screen coords)
  → buddyPosition = cursor + offset (35, 25)
  → Spring physics smooths toward target
  → Viewport moves so localBuddy (24, 40) maps to buddyPosition
  → Components render at fixed positions within viewport
```

During bezier flight:
```
Bezier engine → buddyPosition each frame
                → moveOverlayWindow() moves Electron window (IPC)
                → OverlayViewport CSS transform (browser)
```

---

## State Management

All overlay state lives in a single Zustand store:

| Category | Fields |
|----------|--------|
| **Position** | `buddyPosition`, `systemCursorPosition` |
| **Navigation** | `navigationMode`, `flyToTarget`, `isReturningToCursor`, `cursorPositionAtNavigationStart` |
| **Voice** | `voiceState`, `audioLevel` |
| **Animation** | `triangleRotationDegrees`, `buddyFlightScale` |
| **Bubble** | `navigationBubbleText`, `navigationBubbleOpacity`, `navigationBubbleScale` |
| **Visibility** | `isOverlayVisible`, `cursorOpacity` |

Components use Zustand selectors for 60fps updates — only the fields they need trigger re-renders.

### Navigation Modes

| Mode | Description |
|------|-------------|
| `following-cursor` | Spring physics drives position toward cursor |
| `navigating-to-target` | Bezier engine drives position along flight arc |
| `pointing-at-target` | Stationary at target, showing speech bubble |

---

## Hard Rules

1. **Event bus is the API boundary** — components never import each other
2. **No platform sniffing in components** — React components don't check for Electron/browser
3. **Fixed local positions** — components render at fixed positions within the 320×80 viewport
4. **GPU-composited rendering** — all motion uses CSS `transform`, never `top`/`left`
5. **Viewport-aware coordinates** — use `getViewportBounds()`, never hardcoded pixel values
6. **Cross-platform always** — every line of code works on macOS, Windows, and Linux

---

## Data Flow: Full Voice Interaction

```
1. User presses Ctrl+Alt+Space
   → main process: register push-to-talk
   → overlay: voice state → "listening"

2. Audio streams to STT provider
   → partial transcripts shown in panel
   → waveform reacts to audio level

3. User releases key
   → STT: ForceEndpoint → final transcript

4. Main process captures all screens
   → JPEG screenshots with scale metadata

5. Transcript + screenshots → AI provider
   → streaming text chunks → panel + overlay

6. AI responds with text + [POINT:x,y:label]
   → overlay: voice state → "processing" → "responding"
   → POINT coords scaled to screen coords
   → cursor flies to target

7. TTS speaks the response
   → voice response pipeline chunks sentences
   → parallel TTS prefetch
   → sequential audio playback

8. Flight returns, voice state → "idle"
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI rendering |
| `zustand` | State management (selector-based, 60fps) |
| `eventemitter3` | Typed event bus |
| `@anthropic-ai/sdk` | Anthropic Claude API |
| `openai` | OpenAI SDK (also used for Ollama/LM Studio) |
| `@modelcontextprotocol/sdk` | MCP server + client |
| `ws` | WebSocket client for STT streaming |
| `electron` | Desktop shell (dev dependency) |
| `vite` | Build tool + dev server |
| `typescript` | Type checking |
