# Screen Capture

CursorBuddy captures screenshots of all connected displays and sends them to the AI so it can see what you see.

---

## How It Works

The capture service uses Electron's `desktopCapturer` API to grab screenshots of all screens. Each screenshot includes full coordinate mapping metadata so POINT coordinates can be converted from screenshot pixels to logical screen pixels.

```
desktopCapturer → Raw screenshot (up to 3840×2160)
                       ↓
            Resize to MAX_DIMENSION on longest edge (1280px)
                       ↓
            Convert to JPEG (quality 80)
                       ↓
            Base64 encode + compute scale factors
                       ↓
            Label with dimensions and cursor info
```

---

## Screenshot Metadata

Each captured screen returns:

| Field | Type | Description |
|-------|------|-------------|
| `imageDataBase64` | `string` | JPEG image as base64 |
| `label` | `string` | Human-readable label for the AI |
| `isCursorScreen` | `boolean` | Whether the mouse cursor is on this screen |
| `displayWidthPx` | `number` | Logical screen width (e.g., 1920) |
| `displayHeightPx` | `number` | Logical screen height (e.g., 1080) |
| `displayX` | `number` | Screen origin X in multi-monitor space |
| `displayY` | `number` | Screen origin Y in multi-monitor space |
| `screenshotWidthPx` | `number` | Resized image width (≤ 1280) |
| `screenshotHeightPx` | `number` | Resized image height |
| `scaleX` | `number` | `displayWidth / screenshotWidth` |
| `scaleY` | `number` | `displayHeight / screenshotHeight` |
| `scaleFactor` | `number` | Retina/HiDPI multiplier (e.g., 2.0) |
| `cursorX` | `number` | Cursor X relative to this display (if cursor screen) |
| `cursorY` | `number` | Cursor Y relative to this display (if cursor screen) |

---

## Labels

The AI receives labeled screenshots so it knows which screen is which:

**Single monitor:**
```
user's screen (cursor is here) (image dimensions: 1280x720 pixels)
```

**Multi-monitor (cursor on screen 1):**
```
screen 1 of 2 — cursor is on this screen (primary focus) (image dimensions: 1280x720 pixels)
screen 2 of 2 — secondary screen (image dimensions: 1280x800 pixels)
```

The cursor screen is sorted first so the AI prioritizes it.

---

## Coordinate Conversion

When the AI returns `[POINT:640,360:button]`, those are in screenshot pixel space. To get logical screen coordinates:

```js
function screenshotPointToScreenCoords(pointX, pointY, screenCapture) {
  // Clamp to screenshot bounds
  const clampedX = Math.max(0, Math.min(pointX, screenCapture.screenshotWidthPx));
  const clampedY = Math.max(0, Math.min(pointY, screenCapture.screenshotHeightPx));

  return {
    x: screenCapture.displayX + clampedX * screenCapture.scaleX,
    y: screenCapture.displayY + clampedY * screenCapture.scaleY,
  };
}
```

### Example

Screenshot is 1280×720. Display is 2560×1440 at origin (0, 0).

```
POINT: (640, 360) in screenshot pixels
scaleX = 2560 / 1280 = 2.0
scaleY = 1440 / 720 = 2.0
Screen coords: (640 × 2.0, 360 × 2.0) = (1280, 720)
```

---

## Multi-Monitor Screen Selection

When the AI returns `[POINT:x,y:label:screen2]`, the `screen2` suffix selects which capture's coordinate space to use. Screen numbers are 1-based.

If no screen number is specified, the cursor screen is used (the one marked `isCursorScreen: true`).

---

## Screenshot Interceptor

In addition to automatic capture, CursorBuddy watches the clipboard every 500ms for new screenshots (e.g., from macOS `Cmd+Shift+4`). When detected:

1. A thumbnail is sent to the panel for display
2. The full image is stored as an attachment for the next AI message
3. The cursor flies to the center with a "screenshot captured!" bubble

User-attached screenshots are labeled `user-attached screenshot (ask about this)` so the AI gives them priority over auto-captured screens.

---

## Computer Use Resolutions

For Anthropic Computer Use fallback, screenshots are matched to recommended resolutions based on display aspect ratio:

| Resolution | Aspect Ratio | Typical Display |
|------------|-------------|-----------------|
| 1024×768 | 4:3 | Older monitors |
| 1280×800 | 16:10 | Mac default |
| 1366×768 | ~16:9 | Wide displays |
