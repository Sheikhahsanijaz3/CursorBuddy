# Event Bus

CursorBuddy uses a typed event bus as the central communication layer. Every component talks through events — no direct imports between subsystems. This is what makes the overlay embeddable: external code drives it through the same events the internal components use.

---

## How It Works

The event bus is a singleton `ClickyEventBus` backed by `eventemitter3`. It provides typed `emit()`, `on()`, `once()`, and `off()` methods.

```ts
import { eventBus } from 'cursor-buddy';

// Emit
eventBus.emit('cursor:fly-to', { x: 500, y: 300, label: 'button' });

// Listen
eventBus.on('cursor:arrived', () => console.log('arrived'));

// Listen once
eventBus.once('cursor:returned', () => console.log('returned'));

// Remove
eventBus.off('cursor:arrived', handler);

// Remove all
eventBus.removeAllListeners('cursor:arrived');
eventBus.removeAllListeners(); // all events
```

---

## Event Categories

### Cursor Events

| Event | Payload | Description |
|-------|---------|-------------|
| `cursor:position` | `{ x, y }` | System cursor position update (screen coords) |
| `cursor:fly-to` | `{ x, y, label, bubbleText? }` | Navigate the buddy to a screen element |
| `cursor:arrived` | *void* | Buddy arrived at the target element |
| `cursor:returned` | *void* | Buddy finished pointing and returned to cursor |
| `cursor:show` | *void* | Show the cursor overlay |
| `cursor:hide` | *void* | Hide the cursor overlay |
| `cursor:set-voice-state` | `{ state }` | Set voice state: `idle`, `listening`, `processing`, `responding` |

### Voice Events

| Event | Payload | Description |
|-------|---------|-------------|
| `voice:push-start` | *void* | Push-to-talk key pressed — start recording |
| `voice:push-stop` | *void* | Push-to-talk key released — stop recording |
| `voice:audio-level` | `{ level }` | Live audio power level (0–1) for waveform visualization |
| `voice:transcript-partial` | `{ text }` | Partial transcript update while recording |
| `voice:transcript-final` | `{ text }` | Final transcript after key release |
| `voice:error` | `{ message }` | Voice pipeline error |

### Screen Capture Events

| Event | Payload | Description |
|-------|---------|-------------|
| `capture:request` | *void* | Request a screenshot of all displays |
| `capture:ready` | `{ screens }` | Screenshot data ready (see below) |
| `capture:error` | `{ message }` | Capture error |

Each screen in `capture:ready` contains:

```ts
{
  imageDataBase64: string;
  label: string;
  isCursorScreen: boolean;
  displayWidthPx: number;
  displayHeightPx: number;
  screenshotWidthPx: number;
  screenshotHeightPx: number;
  displayFrame: { x, y, width, height };
}
```

### AI Inference Events

| Event | Payload | Description |
|-------|---------|-------------|
| `inference:request` | `{ transcript, screens }` | Send transcript + screenshots to AI |
| `inference:text-chunk` | `{ accumulatedText }` | Streaming text chunk from AI |
| `inference:complete` | `{ spokenText, point }` | AI response complete with parsed POINT data |
| `inference:error` | `{ message }` | AI inference error |

### TTS Events

| Event | Payload | Description |
|-------|---------|-------------|
| `tts:request` | `{ text }` | Request TTS playback |
| `tts:playing` | *void* | TTS audio started playing |
| `tts:finished` | *void* | TTS audio finished |
| `tts:error` | `{ message }` | TTS error |

### Pipeline Events

| Event | Payload | Description |
|-------|---------|-------------|
| `pipeline:state-change` | `{ from, to }` | Full pipeline state transition |

---

## Bridging to Remote Processes

The event bus is designed to be bridgeable. To relay events over WebSocket or SSE, wrap the bus with a transport adapter:

```ts
// Example: bridge events to a WebSocket
const ws = new WebSocket('ws://localhost:8080');

eventBus.on('cursor:fly-to', (payload) => {
  ws.send(JSON.stringify({ event: 'cursor:fly-to', payload }));
});

ws.onmessage = (msg) => {
  const { event, payload } = JSON.parse(msg.data);
  eventBus.emit(event, payload);
};
```

This pattern is used internally by the Electron app — the main process relays panel commands to the overlay window via IPC, and the overlay listens on the same event bus.
