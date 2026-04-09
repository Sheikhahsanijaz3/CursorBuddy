# API Reference

The full programmatic API for controlling CursorBuddy.

---

## Initialization

### `CursorBuddy.init(options?)`

Creates and mounts the CursorBuddy overlay.

```ts
const buddy = CursorBuddy.init({
  container?: HTMLElement  // Mount target. Default: document.body
});
```

**Returns:** `CursorBuddyInstance`

---

## Instance Methods

### `flyTo(x, y, label, bubbleText?)`

Fly the buddy to absolute coordinates.

```ts
buddy.flyTo(500, 300, 'save button');
buddy.flyTo(500, 300, 'save button', 'click here to save your work');
```

| Param | Type | Description |
|-------|------|-------------|
| `x` | `number` | X coordinate in viewport pixels |
| `y` | `number` | Y coordinate in viewport pixels |
| `label` | `string` | Short 1-3 word label for the target |
| `bubbleText` | `string?` | Optional text for the speech bubble. If omitted, a random phrase is chosen from: "right here!", "this one!", "over here!", "click this!", "here it is!", "found it!" |

The buddy flies along a quadratic bezier arc, holds at the target for 3 seconds showing the speech bubble, then flies back to the cursor.

---

### `flyToAnchor(position, label, bubbleText?)`

Fly to a named viewport position.

```ts
buddy.flyToAnchor('top-right', 'settings');
buddy.flyToAnchor('center', 'main area', 'look at the middle of the screen');
```

| Param | Type | Description |
|-------|------|-------------|
| `position` | `AnchorPosition` | Named position (see below) |
| `label` | `string` | Short label |
| `bubbleText` | `string?` | Optional bubble text |

**AnchorPosition values:**

| Value | Location |
|-------|----------|
| `center` | Center of viewport |
| `top-left` | Top-left with 120px padding |
| `top-center` | Top-center |
| `top-right` | Top-right |
| `center-left` | Center-left |
| `center-right` | Center-right |
| `bottom-left` | Bottom-left |
| `bottom-center` | Bottom-center |
| `bottom-right` | Bottom-right |

All anchor positions have 120px edge padding to keep the buddy visible.

---

### `flyToElement(element, label, bubbleText?)`

Fly to a DOM element's center.

```ts
const btn = document.querySelector('.save-btn');
buddy.flyToElement(btn, 'save', 'click this button');
```

| Param | Type | Description |
|-------|------|-------------|
| `element` | `Element` | Any DOM element |
| `label` | `string` | Short label |
| `bubbleText` | `string?` | Optional bubble text |

Uses `getBoundingClientRect()` to find the element's center.

---

### `flyToRandom(label?, bubbleText?)`

Fly to a random point inside the viewport.

```ts
buddy.flyToRandom();
buddy.flyToRandom('surprise', 'look over here!');
```

| Param | Type | Description |
|-------|------|-------------|
| `label` | `string?` | Label (default: "random") |
| `bubbleText` | `string?` | Optional bubble text |

Uses 120px edge padding to avoid corners.

---

### `setVoiceState(state)`

Switch the visual indicator.

```ts
buddy.setVoiceState('idle');
buddy.setVoiceState('listening');
buddy.setVoiceState('processing');
buddy.setVoiceState('responding');
```

| State | Visual |
|-------|--------|
| `idle` | Blue triangle with glow |
| `listening` | 5-bar audio-reactive waveform |
| `processing` | Spinning arc indicator |
| `responding` | Blue triangle (same as idle) |

States cross-fade via opacity transitions (0.15–0.25s) so there's no visual pop.

---

### `setAudioLevel(level)`

Drive the waveform bars. Only visible when voice state is `listening`.

```ts
buddy.setAudioLevel(0.5); // 0.0 to 1.0
```

The waveform has a pyramid bar profile `[0.4, 0.7, 1.0, 0.7, 0.4]` — the center bar is tallest. Audio level is eased with `pow(level * 2.85, 0.76)` for natural-feeling reactivity.

---

### `startSelection()`

Enter element selection mode. The user can click-and-drag to select a region of the page.

```ts
buddy.startSelection();
```

- A crosshair cursor appears over the full page
- Dragging draws a blue selection rectangle
- Press `Escape` to cancel
- On mouse-up, a `selection:complete` event fires with the selected bounds and HTML

---

### `show()` / `hide()`

Toggle overlay visibility.

```ts
buddy.show();
buddy.hide();
```

---

### `getViewport()`

Get the current viewport bounds.

```ts
const vp = buddy.getViewport();
// { x: 0, y: 0, width: 1920, height: 1080 }
```

In browser mode this returns `window.innerWidth/Height`. In Electron it returns the screen bounds from the main process.

---

### `on(event, handler)` / `off(event, handler)`

Listen for overlay events.

```ts
buddy.on('cursor:arrived', () => { /* buddy reached the target */ });
buddy.on('cursor:returned', () => { /* buddy flew back to cursor */ });
buddy.on('selection:complete', (result) => { /* element selection done */ });

// Remove a listener
buddy.off('cursor:arrived', myHandler);
```

See [Event Bus](./event-bus.md) for all events.

---

### `destroy()`

Unmount the overlay and clean up everything.

```ts
buddy.destroy();
```

Unmounts the React root, removes the host DOM element, and clears all event listeners.

---

## TypeScript Types

```ts
import type {
  CursorBuddyInstance,
  CursorBuddyOptions,
  AnchorPosition,
  VoiceState,          // 'idle' | 'listening' | 'processing' | 'responding'
  ViewportBounds,      // { x, y, width, height }
  EventName,           // Union of all event names
  AllEvents,           // Full event type map
} from 'cursor-buddy';
```

---

## Re-exports

The library also exports these for advanced use:

```ts
import {
  eventBus,                    // The singleton event bus
  getViewportBounds,           // Get viewport dimensions
  viewportAnchor,              // Get anchor coordinates
  randomPointInViewport,       // Random point with padding
  ChatPanel,                   // React component for the chat UI
} from 'cursor-buddy';
```
