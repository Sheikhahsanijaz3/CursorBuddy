# Element Selector

CursorBuddy includes a click-and-drag element selection mode that lets users visually select regions of the page and extract information about the DOM elements within.

---

## How It Works

1. **Activate** — call `buddy.startSelection()` or emit `selection:start` on the event bus
2. **Select** — a full-page overlay with a crosshair cursor appears; click and drag to draw a selection rectangle
3. **Result** — on mouse-up, the selector finds all DOM elements overlapping the rectangle and emits a `selection:complete` event
4. **Cancel** — press `Escape` at any time to exit without selecting

---

## Activation

### Via the API

```js
const buddy = CursorBuddy.init();
buddy.startSelection();
```

### Via the Event Bus

```js
import { eventBus } from 'cursor-buddy';
eventBus.emit('selection:start');
```

### Cancel Programmatically

```js
eventBus.emit('selection:cancel');
```

---

## Selection Result

When a selection is completed (rectangle > 10×10 pixels), the `selection:complete` event fires:

```js
buddy.on('selection:complete', (result) => {
  console.log(result.bounds);       // { x: 100, y: 200, width: 300, height: 150 }
  console.log(result.html);         // Outer HTML of matching elements (truncated)
  console.log(result.elementCount); // Total number of overlapping elements
});
```

### Result Shape

| Field | Type | Description |
|-------|------|-------------|
| `bounds` | `{ x, y, width, height }` | The selection rectangle in viewport coordinates |
| `html` | `string` | Concatenated `outerHTML` of matching elements (each truncated to 500 chars, max 20 elements) |
| `elementCount` | `number` | Total number of elements that overlap the selection |

---

## Visual Behavior

- The selector overlay sits at `z-index: 2147483646` (one below the cursor buddy overlay)
- A centered instruction reads "Click and drag to select elements" with "Press Escape to cancel"
- During drag: the selection rectangle has a blue border, subtle blue fill, and a page-dimming shadow (`box-shadow: 0 0 0 9999px rgba(0,0,0,0.15)`)
- The cursor changes to `crosshair` in selection mode
- `pointer-events: auto` is enabled only on the selector overlay — the rest of the page is still visible but not interactive

---

## Element Detection

The selector finds elements by iterating all DOM nodes and checking if their bounding rect overlaps the selection rectangle. Elements inside `#cursor-buddy-root` (the overlay itself) are excluded.

```
For each element on page:
  if element is inside cursor-buddy-root → skip
  if element.getBoundingClientRect() overlaps selection → include
  truncate outerHTML to 500 chars
  cap at 20 elements total
```

---

## Use Cases

- **AI context** — select a UI region and ask the AI about it
- **Component extraction** — grab HTML snippets from a page
- **Accessibility audit** — identify elements in a region
- **Teaching** — show students which elements make up a UI section
