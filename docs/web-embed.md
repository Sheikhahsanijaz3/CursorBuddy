# Web Embed

Add CursorBuddy to any web page with a single `<script>` tag. No build tools, no framework dependencies, zero config.

---

## Quick Start

```html
<script src="https://unpkg.com/cursor-buddy/dist/cursor-buddy.iife.js"></script>
<script>
  const buddy = CursorBuddy.init();
</script>
```

That's it. A blue triangle now follows the user's mouse cursor with spring physics.

## What You Get

In browser mode, CursorBuddy mounts a `position: fixed` overlay at `z-index: 2147483647` (max int). The overlay is fully transparent and `pointer-events: none`, so it never interferes with your page.

The buddy follows the mouse via `mousemove` events, smoothed through a damped spring simulation that matches SwiftUI's `.spring(response: 0.2, dampingFraction: 0.6)`.

---

## CDN Options

```html
<!-- unpkg -->
<script src="https://unpkg.com/cursor-buddy/dist/cursor-buddy.iife.js"></script>

<!-- jsdelivr -->
<script src="https://cdn.jsdelivr.net/npm/cursor-buddy/dist/cursor-buddy.iife.js"></script>
```

## ESM Import

If you're using a bundler:

```js
import { init } from 'cursor-buddy';

const buddy = init();
buddy.flyTo(500, 300, 'save button', 'click this to save your work');
```

React and ReactDOM are bundled into the IIFE build, but marked as `external` in the ESM build (you provide your own).

---

## Configuration

### Mount to a specific container

By default CursorBuddy appends to `document.body`. You can target a different element:

```js
const buddy = CursorBuddy.init({
  container: document.getElementById('my-app'),
});
```

---

## Controlling the Buddy

### Fly to coordinates

```js
buddy.flyTo(500, 300, 'save button');
buddy.flyTo(500, 300, 'save button', 'click here to save!');
```

The buddy flies along a quadratic bezier arc, shows a speech bubble on arrival, holds for 3 seconds, then flies back to the cursor.

### Fly to a viewport anchor

```js
buddy.flyToAnchor('top-right', 'settings', 'your settings are up here');
```

Available anchors: `center`, `top-left`, `top-center`, `top-right`, `center-left`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`.

### Fly to a DOM element

```js
const saveBtn = document.querySelector('.save-btn');
buddy.flyToElement(saveBtn, 'save', 'click this button');
```

The buddy flies to the center of the element's bounding rect.

### Fly to a random spot

```js
buddy.flyToRandom();
buddy.flyToRandom('surprise', 'look over here!');
```

Picks a random point inside the viewport with 120px edge padding.

---

## Voice State Visualizations

Switch between four visual states:

```js
buddy.setVoiceState('idle');        // Blue triangle (default)
buddy.setVoiceState('listening');   // 5-bar audio waveform
buddy.setVoiceState('processing');  // Spinning arc indicator
buddy.setVoiceState('responding');  // Blue triangle (same as idle)
```

When in `listening` state, drive the waveform:

```js
buddy.setAudioLevel(0.5); // 0.0 to 1.0
```

The waveform uses a pyramid bar profile `[0.4, 0.7, 1.0, 0.7, 0.4]` with audio-reactive heights and an idle sine pulse animation.

---

## Visibility

```js
buddy.show();
buddy.hide();
```

## Events

```js
buddy.on('cursor:arrived', () => {
  console.log('Buddy arrived at target');
});

buddy.on('cursor:returned', () => {
  console.log('Buddy returned to cursor');
});
```

See [Event Bus](./event-bus.md) for the full event list.

## Cleanup

```js
buddy.destroy();
```

Unmounts the React root, removes the host element, and clears all event listeners.

---

## Element Selection Mode

CursorBuddy includes a click-and-drag element selector:

```js
buddy.startSelection();

buddy.on('selection:complete', (result) => {
  console.log(result.bounds);       // { x, y, width, height }
  console.log(result.html);         // HTML of selected elements
  console.log(result.elementCount); // Number of elements found
});
```

Press `Escape` to cancel selection mode.

---

## Full Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>CursorBuddy Demo</title>
</head>
<body>
  <h1>Hello World</h1>
  <button id="demo-btn">Click Me</button>

  <script src="https://unpkg.com/cursor-buddy/dist/cursor-buddy.iife.js"></script>
  <script>
    const buddy = CursorBuddy.init();

    // Fly to the button after 2 seconds
    setTimeout(() => {
      const btn = document.getElementById('demo-btn');
      buddy.flyToElement(btn, 'button', 'try clicking this!');
    }, 2000);

    // Log events
    buddy.on('cursor:arrived', () => console.log('arrived'));
    buddy.on('cursor:returned', () => console.log('returned'));
  </script>
</body>
</html>
```
