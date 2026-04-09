# CursorBuddy Documentation

CursorBuddy is a drop-in animated cursor companion that lives on your screen. A friendly blue triangle that follows your mouse, flies to UI elements along smooth bezier arcs, shows speech bubbles, and visualises voice states — all powered by AI.

---

## Quick Links

| Guide | Description |
|-------|-------------|
| [Getting Started](./getting-started.md) | Install, run, and embed CursorBuddy in under 5 minutes |
| [Web Embed](./web-embed.md) | Add CursorBuddy to any web page with a single `<script>` tag |
| [Electron Desktop App](./electron-app.md) | Run CursorBuddy as a system-wide overlay on macOS, Windows, and Linux |
| [JavaScript API](./api-reference.md) | Full API reference for controlling the buddy programmatically |
| [Event Bus](./event-bus.md) | The typed event system that connects all components |
| [Voice Pipeline](./voice-pipeline.md) | Push-to-talk, speech-to-text, and text-to-speech integration |
| [AI & Inference](./ai-inference.md) | Multi-provider AI chat with vision, streaming, and tool use |
| [Screen Capture](./screen-capture.md) | Multi-monitor screenshot capture with coordinate mapping |
| [Cursor Animation](./cursor-animation.md) | Bezier flight, spring physics, and the pointing system |
| [MCP Integration](./mcp-integration.md) | Model Context Protocol — use CursorBuddy as a tool server or connect external tools |
| [Custom Tools](./custom-tools.md) | Load your own tools from the filesystem |
| [Element Selector](./element-selector.md) | Click-and-drag to select page elements |
| [Customization](./customization.md) | Runtime config, colors, sizes, spring tuning |
| [Design Tokens](./design-tokens.md) | Colors, dimensions, and animation constants |
| [Architecture](./architecture.md) | How the pieces fit together |

---

## What CursorBuddy Can Do

- **Follow your cursor** with smooth spring physics matching SwiftUI's damped spring
- **Fly to screen elements** along quadratic bezier arcs with rotation and scale animation
- **Show speech bubbles** with character-by-character streaming text
- **Visualise voice states** — idle (triangle), listening (waveform), processing (spinner), responding (triangle)
- **See your screen** via multi-monitor screenshot capture with coordinate mapping
- **Talk to AI** with push-to-talk voice input and streaming responses from Claude, GPT-4o, Ollama, or LM Studio
- **Speak responses aloud** via ElevenLabs or Cartesia text-to-speech
- **Point at things** by parsing `[POINT:x,y:label]` tags from AI responses and flying to those coordinates
- **Connect to MCP servers** to give the AI access to external tools
- **Expose itself as an MCP server** so other agents (Claude Code, Codex, etc.) can control the cursor
- **Load custom tools** from `~/.cursorbuddy/tools/` for extensibility

---

## Two Ways to Run

### 1. Web Embed (any website)

```html
<script src="https://unpkg.com/cursor-buddy/dist/cursor-buddy.iife.js"></script>
<script>
  const buddy = CursorBuddy.init();
  buddy.flyTo(500, 300, 'save button');
</script>
```

### 2. Electron Desktop App

```bash
npm install
npm run dev:electron
```

A transparent overlay follows your real cursor across the entire OS. A tray icon opens a control panel with chat, settings, and AI configuration.

---

## License

AGPL-3.0-only — GNU Affero General Public License v3.0
