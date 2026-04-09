# Customization

CursorBuddy's appearance and behavior can be changed at runtime through the config system. The panel UI or external code can update these values, and all components react immediately.

---

## Runtime Config

The runtime config holds mutable design tokens that override the static defaults:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `cursorColor` | `string` | `#3b82f6` | Hex color for the triangle, waveform, spinner, bubble, and glow |
| `cursorSize` | `number` | `16` | Triangle SVG size in pixels |
| `glowIntensity` | `number` | `8` | Base glow radius in pixels (increases during flight) |
| `springResponse` | `number` | `0.2` | Spring natural period in seconds (lower = snappier) |
| `springDamping` | `number` | `0.6` | Spring damping ratio (lower = bouncier, 1.0 = critically damped) |
| `bubbleHoldMs` | `number` | `3000` | How long the speech bubble stays visible after arriving at a target |

---

## Changing Config

### Via the Event Bus

Send a `config:update` event with the properties you want to change:

```js
import { eventBus } from 'cursor-buddy';

// Change the cursor color to red
eventBus.emit('config:update', { cursorColor: '#ef4444' });

// Make it bigger with more glow
eventBus.emit('config:update', { cursorSize: 24, glowIntensity: 12 });

// Snappier spring (less lag)
eventBus.emit('config:update', { springResponse: 0.1, springDamping: 0.8 });

// Bouncier spring (more playful)
eventBus.emit('config:update', { springResponse: 0.3, springDamping: 0.4 });

// Longer bubble hold
eventBus.emit('config:update', { bubbleHold: 5 }); // 5 seconds
```

All properties are optional — only include the ones you want to change. Components re-render automatically when config changes.

### From the Electron Panel

The panel sends `config:update` events through the overlay command relay. Changes are applied instantly to the overlay.

---

## Color

The `cursorColor` controls everything:

- Triangle fill color
- Triangle glow (`drop-shadow`)
- Waveform bar fill
- Spinner stroke
- Speech bubble background
- Speech bubble glow

Set any valid CSS color:

```js
eventBus.emit('config:update', { cursorColor: '#10b981' }); // Green
eventBus.emit('config:update', { cursorColor: '#f59e0b' }); // Amber
eventBus.emit('config:update', { cursorColor: '#8b5cf6' }); // Purple
eventBus.emit('config:update', { cursorColor: 'rgb(255, 100, 50)' });
```

---

## Size

The `cursorSize` controls the triangle SVG viewBox. The triangle vertices are recomputed when size changes:

```
height = size × √3 / 2
top:    (size/2, size/2 - height/1.5)
left:   (0, size/2 + height/3)
right:  (size, size/2 + height/3)
```

Reasonable range: 10–32px.

---

## Spring Tuning

The spring physics control how the buddy follows the cursor:

### `springResponse` (0.05–0.5)

How fast the spring reaches the target. Lower = snappier, higher = lazier.

| Value | Feel |
|-------|------|
| 0.05 | Almost instant, no visible lag |
| 0.1 | Very snappy |
| 0.2 | Default — smooth with slight elastic trail |
| 0.3 | Noticeably laggy, more elastic |
| 0.5 | Very lazy, big elastic bounce |

### `springDamping` (0.3–1.0)

How quickly oscillation dies out. Lower = more bouncy.

| Value | Feel |
|-------|------|
| 0.3 | Very bouncy — visible overshoot |
| 0.6 | Default — subtle elastic with minimal overshoot |
| 0.8 | Almost no bounce |
| 1.0 | Critically damped — smooth with zero oscillation |

---

## Glow

The `glowIntensity` sets the base `drop-shadow` blur radius. During flight, the glow intensifies:

```
effectiveGlow = glowIntensity + (flightScale - 1.0) × 20
```

At the midpoint of a flight arc (scale = 1.3), glow increases by 6px.

---

## Bubble Hold Duration

`bubbleHoldMs` controls how long the speech bubble stays visible after the buddy arrives at a target element. After this duration, the bubble fades out over 0.5s, then the buddy flies back to the cursor.

Default is 3000ms (3 seconds). Set via `bubbleHold` in seconds:

```js
eventBus.emit('config:update', { bubbleHold: 5 }); // 5 seconds
```

---

## Listening for Config Changes

Components can subscribe to config changes:

```js
import { onConfigChange, runtimeConfig } from 'cursor-buddy/lib/runtime-config';

const unsubscribe = onConfigChange(() => {
  console.log('New color:', runtimeConfig.cursorColor);
});

// Clean up
unsubscribe();
```
