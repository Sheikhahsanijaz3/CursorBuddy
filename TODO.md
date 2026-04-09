# CursorBuddy — Master TODO

Complete feature list extracted from conversation. Nothing gets skipped.

---

## ✅ DONE

- [x] Cursor overlay component (triangle, waveform, spinner, bubble)
- [x] Bezier flight animation (ported from Swift, exact math)
- [x] Spring physics cursor following (response 0.2, damping 0.6)
- [x] Event bus architecture (all components decoupled)
- [x] Electron shell (transparent overlay + tray icon)
- [x] IIFE library build (`cursor-buddy.iife.js` — script tag embed)
- [x] ESM library build (`cursor-buddy.es.js`)
- [x] Viewport-aware coordinates (real screen bounds, multi-monitor)
- [x] Control panel (frameless, transparent, drag region, close button)
- [x] Playground controls (voice states, flight anchors, audio sim)
- [x] test.html responsive CDN test page
- [x] Settings storage IPC (~/.cursorbuddy/settings.json)
- [x] CLI path verification IPC (claude, codex, ollama, lms)
- [x] Equilateral triangle shape (sqrt(3)/2 — matches Swift)
- [x] AGENTS.md + CLAUDE.md
- [x] **Phase 1: Settings panel** — 8 vertical tabs (Playground, API Keys, Models, STT, TTS, CLI Tools, Appearance, MCP), Lucide icons, all provider keys, model selection, local LLM endpoints, VAD sliders, CLI auto-detect
- [x] **Phase 2: Screen capture** — `electron/services/capture.js`, desktopCapturer, multi-monitor, JPEG base64, cursor position metadata, IPC wired
- [x] **Phase 3: Inference pipeline** — `electron/services/inference.js`, Anthropic SDK streaming, OpenAI SDK streaming, Ollama/LM Studio (OpenAI-compatible), conversation history, POINT tag in system prompt, IPC wired
- [x] **Phase 6 (partial): MCP server** — `electron/services/mcp-server.js`, cursor_fly_to, cursor_set_voice_state, cursor_show/hide, screenshot_capture, cursor_set_audio_level, stdio transport
- [x] **Phase 5: Chat interface** — Chat tab in panel (first tab, message bubbles, streaming display, Enter to send, POINT tag parsing → cursor flight, TTS playback, basic markdown rendering). Also `src/components/ChatPanel.tsx` React component for web embed.
- [x] **Phase 6: MCP complete** — `electron/services/mcp-client.js` (connect to external MCP servers via stdio, discover tools, call tools, disconnect). IPC wired: mcp:connect, mcp:disconnect, mcp:call-tool, mcp:list-tools, mcp:list-servers.
- [x] **Phase 7: Extensible tooling** — `electron/services/tool-loader.js`. Scans `.pi/agent/tools/`, `~/.pi/agent/tools/`, `~/.cursorbuddy/tools/` for .ts/.js files. Compiles TS via esbuild at runtime. Hot-reloads on file change. pi-compatible format: `{ name, description, parameters, execute }`. IPC: tools:list, tools:execute, tools:reload.
- [x] **Phase 8: Element selection** — `src/components/ElementSelector.tsx`. Click-drag to select page elements. Emits `selection:complete` with { bounds, html, elementCount }. Works in web + Electron. API: `buddy.startSelection()`. Escape to cancel.
- [x] **Phase 4: Voice pipeline** — `electron/services/transcription.js` (AssemblyAI WebSocket, Deepgram WebSocket, OpenAI Whisper upload), `electron/services/tts.js` (ElevenLabs, Cartesia), push-to-talk global shortcut (Ctrl+Alt+Space), PCM16 audio IPC, transcript streaming, TTS audio return as base64

---

## Phase 1 — Settings Panel

Vertical tabs with Lucide icons. Frameless panel with custom titlebar.

### Tabs

| Tab | Lucide Icon | Content |
|-----|-------------|---------|
| **Playground** | `play` | Existing controls (voice state, flight, audio sim, show/hide) |
| **API Keys** | `key-round` | All provider keys — masked input, auto-save |
| **Models** | `brain` | LLM provider + model picker, temperature, max tokens |
| **Transcription** | `mic` | STT provider picker, VAD settings |
| **TTS** | `volume-2` | TTS provider picker, voice ID, speed |
| **CLI Tools** | `terminal` | Claude, Codex, Ollama, LM Studio — path verify + status |
| **Appearance** | `palette` | Cursor color/size, glow, spring params, bubble duration |
| **MCP** | `plug` | MCP server connections + CursorBuddy's own MCP server config |

### API Keys

| Provider | Key | Used for |
|----------|-----|----------|
| Anthropic | `ANTHROPIC_API_KEY` | Claude chat, vision, computer use |
| OpenAI | `OPENAI_API_KEY` | Whisper STT, GPT/Codex chat, computer use |
| ElevenLabs | `ELEVENLABS_API_KEY` | TTS (eleven_flash_v2_5) |
| Cartesia | `CARTESIA_API_KEY` | TTS (Sonic, ultra-low latency) |
| Deepgram | `DEEPGRAM_API_KEY` | Streaming STT with VAD (nova-3) |
| AssemblyAI | `ASSEMBLYAI_API_KEY` | Streaming STT (u3-rt-pro) |

### Models

| Category | Provider | Models |
|----------|----------|--------|
| **Chat** | Anthropic | claude-sonnet-4-6, claude-opus-4-6, claude-haiku-3-5 |
| | OpenAI | gpt-4o, gpt-4o-mini, o3, o4-mini |
| | Ollama | auto-list from `http://localhost:11434/api/tags` |
| | LM Studio | auto-list from `http://localhost:1234/v1/models` |
| **Computer Use** | Anthropic | claude-sonnet-4-6 (`computer-use-2025-11-24` beta) |
| | OpenAI | computer-use-preview |
| **Transcription** | OpenAI | gpt-4o-transcribe, whisper-1 |
| | Deepgram | nova-3 |
| | AssemblyAI | u3-rt-pro |
| | Apple | on-device (no model) |
| **TTS** | ElevenLabs | eleven_flash_v2_5, eleven_multilingual_v2 |
| | Cartesia | sonic-2 |

---

## Phase 2 — Screen Capture

Cross-platform screenshot capture for vision models.

- Electron `desktopCapturer.getSources({ types: ['screen'] })` for all displays
- Label each: cursor screen = "primary focus", others = "secondary"
- Include pixel dimensions in label (e.g. `"primary focus (1440x900 pixels)"`)
- Draw red crosshair at cursor position on the screenshot (matching PucksApp)
- Exclude CursorBuddy's own windows from capture
- JPEG compression at 0.8 quality, base64 encode
- Max 1280px on longest edge (aspect-ratio preserved)
- IPC: `capture:request` → main process captures → `capture:ready` with array of screens
- Wire to event bus (`capture:*` events)
- Cross-platform: works on macOS, Windows, Linux (desktopCapturer is Chromium-native)

Source ref: `~/Documents/GitHub/PucksApp/CursorBuddy/Utilities/ScreenshotManager.swift`

---

## Phase 3 — Inference Pipeline

### Anthropic SDK streaming
- `@anthropic-ai/sdk` — `client.messages.stream()`
- Vision: base64 screenshots as image content blocks
- System prompt from PucksApp's ClaudeAPI.swift (cursor buddy persona + POINT instructions)
- Conversation history (10 turns)
- Parse `[POINT:x,y:label]` → `cursor:fly-to` events
- Wire: `inference:request` → `inference:text-chunk` (SSE) → `inference:complete`

### OpenAI SDK streaming
- `openai` npm — `client.chat.completions.create({ stream: true })`
- Vision: base64 screenshots
- Same POINT tag parsing + event bus wiring

### Computer Use — Anthropic
- `anthropic-beta: computer-use-2025-11-24` header
- Tool: `{ type: "computer_20251124", name: "computer", display_width_px, display_height_px }`
- Returns `tool_use` with `{ action: "left_click", coordinate: [x, y] }`
- Resize to recommended resolutions (1280×800, 1024×768, 1366×768)
- Coordinate scaling: screenshot pixels → display points → screen coords

### Computer Use — OpenAI
- `computer-use-preview` model
- Similar tool_use response format
- Same coordinate scaling

### Local LLMs
- **Ollama**: OpenAI-compatible at `http://localhost:11434/v1`
- **LM Studio**: OpenAI-compatible at `http://localhost:1234/v1`
- Use same `openai` SDK with custom `baseURL`
- Vision depends on model (llava, gemma-4, etc.)
- Auto-detect running + available models

### Claude Code SDK
- `@anthropic-ai/claude-code` — `query({ prompt, options })`
- Agent-level: file read/write, command execution, multi-turn
- Streaming responses via SDK's built-in streaming
- Alternative inference provider via event bus

### Codex CLI
- Spawn `codex` as child process
- Stream stdout for responses
- Pass prompts via stdin or CLI args
- Alternative inference provider via event bus

Source refs:
- `~/Documents/GitHub/PucksApp/CursorBuddy/API/ClaudeAPI.swift`
- `~/Documents/GitHub/PucksApp/CursorBuddy/API/OpenAIAPI.swift`
- `~/Documents/GitHub/PucksApp/CursorBuddy/API/CodexAPI.swift`
- `~/clawd/collaborator-clone/src/main/agent-stream.ts`

---

## Phase 4 — Voice Pipeline

### Microphone Capture
- Web Audio API `AudioWorklet` in renderer
- PCM16 mono at 16kHz (convert from mic's native rate)
- Audio power level: RMS metering → `voice:audio-level` events → waveform
- Push-to-talk global shortcut in Electron (configurable combo, default Ctrl+Option)

### Transcription Providers
| Provider | Transport | Model | Needs key |
|----------|-----------|-------|-----------|
| AssemblyAI | WebSocket streaming (v3) | u3-rt-pro | Yes |
| OpenAI Whisper | Upload POST | gpt-4o-transcribe | Yes |
| Deepgram | WebSocket streaming | nova-3 | Yes |
| Apple Speech | `webkitSpeechRecognition` | on-device | No |

- Turn-based transcript composition (AssemblyAI format_turns)
- Final transcript on key release + grace period
- Configurable VAD: threshold slider (0.01–0.3), silence duration (300–3000ms)
- Keyterms support for domain-specific vocabulary

### TTS Providers
| Provider | Transport | Model | Needs key |
|----------|-----------|-------|-----------|
| ElevenLabs | POST → MP3 | eleven_flash_v2_5 | Yes |
| Cartesia | WebSocket streaming | sonic-2 | Yes |

- Voice ID field (per provider)
- Speed slider (0.5×–2.0×)
- Playback via Web Audio API (`AudioContext` + `decodeAudioData`)
- `tts:playing` / `tts:finished` events for transient cursor scheduling

Source refs:
- `~/Documents/GitHub/PucksApp/CursorBuddy/Audio/AssemblyAIStreamingTranscriptionProvider.swift`
- `~/Documents/GitHub/PucksApp/CursorBuddy/Audio/DeepgramTranscriptionProvider.swift`
- `~/Documents/GitHub/PucksApp/CursorBuddy/Audio/OpenAIAudioTranscriptionProvider.swift`
- `~/Documents/GitHub/PucksApp/CursorBuddy/API/ElevenLabsTTSClient.swift`
- `~/Documents/GitHub/PucksApp/CursorBuddy/API/CartesiaTTSClient.swift`
- `~/Documents/GitHub/PucksApp/CursorBuddy/Audio/BuddyDictationManager.swift`

---

## Phase 5 — Chat Interface

Extract from `~/clawd/collaborator-clone` and adapt.

- Self-contained chat panel component (React)
- Message list: user bubbles, assistant bubbles, tool-use blocks
- Streaming text display (character-by-character or chunk)
- Markdown rendering in assistant responses
- Code block syntax highlighting
- Input bar with send button + keyboard shortcut (Enter)
- Conversation history display
- Wire to inference pipeline via event bus
- Mount in panel as a tab or separate Electron window

Source refs:
- `~/clawd/collaborator-clone/src/renderer/src/components/ChatTile.tsx` (2138 lines)
- `~/clawd/collaborator-clone/src/main/ipc/chat.ts`
- `~/clawd/collaborator-clone/src/main/agent-stream.ts`

---

## Phase 6 — MCP (dual-direction)

### CursorBuddy as MCP Client
- Connect to external MCP servers (stdio + SSE transports)
- Settings tab: add/remove servers (name, command, args, env)
- Tool discovery: `tools/list` → show in UI
- Tool execution: pass to Claude/OpenAI as available functions
- Server health monitoring

### CursorBuddy as MCP Server
- Expose CursorBuddy's capabilities so other apps/agents can control it
- Transports: **stdio** (for Claude Code / Codex) + **SSE over HTTP** (for network)
- Use `@modelcontextprotocol/sdk` package

**Tools to expose:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `cursor_fly_to` | Fly buddy to screen coordinates | `x, y, label, bubbleText?` |
| `cursor_fly_to_anchor` | Fly to named viewport position | `position, label, bubbleText?` |
| `cursor_point_at` | Point at element with bubble | `x, y, label, bubbleText` |
| `cursor_set_voice_state` | Switch visual state | `state: idle\|listening\|processing\|responding` |
| `cursor_set_audio_level` | Drive waveform | `level: 0–1` |
| `cursor_show` / `cursor_hide` | Toggle visibility | — |
| `cursor_get_viewport` | Return viewport bounds | — |
| `screenshot_capture` | Capture current screen(s) | `screen?: number` |
| `tts_speak` | Speak text via configured TTS | `text, voice?` |
| `chat_send` | Send a message to the chat | `message` |
| `element_select` | Trigger element selection mode | — |

This means Claude Code, Codex, or any MCP-compatible agent can:
- Make the cursor fly to things on screen
- Capture screenshots
- Speak through TTS
- Send chat messages
- Control the overlay state

Source ref: `~/clawd/collaborator-clone/src/main/mcp-server.ts`

---

## Phase 7 — Extensible Tooling

### pi-compatible tool format
- Detect and load tools from `.pi/agent/tools/` (project-local) and `~/.pi/agent/tools/` (global)
- Each tool is a TypeScript file exporting `{ name, description, parameters, execute }`
- Compatible with pi-coding-agent's `registerTool()` format
- Tools are available to the AI during inference (passed as function definitions)
- Tools are also exposed via the MCP server automatically

### Tool format (pi-compatible)
```typescript
import { Type } from "@sinclair/typebox";
export const name = "my_tool";
export const description = "Does something useful";
export const parameters = Type.Object({
  input: Type.String({ description: "The input" }),
});
export async function execute(params: { input: string }) {
  return { result: "done" };
}
```

### Runtime
- TypeScript files loaded via `tsx` or `esbuild` at startup
- Hot-reload on file change (watch `.pi/agent/tools/`)
- Tool registry shared between inference pipeline and MCP server
- Tools appear in settings panel (CLI Tools tab) with enable/disable toggles

Source ref: pi-coding-agent `docs/extensions.md`, `examples/extensions/tools.ts`

---

## Phase 8 — Element Selection (Web)

Click-and-drag to select UI elements on the page (like cluso-widget).

### Browser embed mode
- When initialized via `CursorBuddy.init()`, optionally enable element selection
- User clicks + drags to draw a selection rectangle
- On release: capture selected area as screenshot, extract HTML of elements within
- Send to AI as context ("the user selected this area")
- Or copy to clipboard (HTML + screenshot)
- Or relay via MCP tool (`element_select` result)

### Electron mode
- Trigger via MCP tool or keyboard shortcut
- Overlay becomes interactive temporarily (disable click-through)
- User draws selection rectangle on screen
- Capture area, extract info, relay back

### Integration
- Selection result available via event bus: `selection:complete` with `{ screenshot, html, bounds }`
- AI can act on it: "what's in this area?", "rewrite this component", etc.
- Compatible with cluso-widget component pattern

Source ref: `~/clawd/collaborator-clone/src/renderer/src/components/ClusoWidgetMount.tsx`

---

## 📋 EXECUTION ORDER

| # | Phase | Key deliverable | New deps |
|---|-------|----------------|----------|
| 1 | Settings Panel | Vertical tabs, all provider config | lucide (CDN) |
| 2 | Screen Capture | Cross-platform screenshots for vision | none (Electron built-in) |
| 3 | Inference Pipeline | Claude + OpenAI + local LLM streaming | `@anthropic-ai/sdk`, `openai` |
| 4 | Voice Pipeline | STT + TTS + push-to-talk | none (Web Audio + WebSocket) |
| 5 | Chat Interface | Full conversation UI | extracted from collaborator-clone |
| 6 | MCP | Client + server, dual-direction | `@modelcontextprotocol/sdk` |
| 7 | Extensible Tooling | pi-compatible .ts tools, hot-reload | `esbuild` (for tool loading) |
| 8 | Element Selection | Click-drag select on web, relay to AI | none |

---

## 🗂️ SOURCE REFERENCES

| What | Where |
|------|-------|
| Settings UI + all tabs | `~/Documents/GitHub/PucksApp/CursorBuddy/Views/SettingsWindow.swift` |
| API key storage | `~/Documents/GitHub/PucksApp/CursorBuddy/Utilities/APIKeysManager.swift` |
| Provider types (STT/TTS) | `~/Documents/GitHub/PucksApp/CursorBuddy/Utilities/ProviderTypes.swift` |
| Claude API + system prompt | `~/Documents/GitHub/PucksApp/CursorBuddy/API/ClaudeAPI.swift` |
| OpenAI API | `~/Documents/GitHub/PucksApp/CursorBuddy/API/OpenAIAPI.swift` |
| Codex API | `~/Documents/GitHub/PucksApp/CursorBuddy/API/CodexAPI.swift` |
| ElevenLabs TTS | `~/Documents/GitHub/PucksApp/CursorBuddy/API/ElevenLabsTTSClient.swift` |
| Cartesia TTS | `~/Documents/GitHub/PucksApp/CursorBuddy/API/CartesiaTTSClient.swift` |
| AssemblyAI STT | `~/Documents/GitHub/PucksApp/CursorBuddy/Audio/AssemblyAIStreamingTranscriptionProvider.swift` |
| Deepgram STT | `~/Documents/GitHub/PucksApp/CursorBuddy/Audio/DeepgramTranscriptionProvider.swift` |
| Screen capture | `~/Documents/GitHub/PucksApp/CursorBuddy/Utilities/ScreenshotManager.swift` |
| Computer Use detector | `~/Documents/GitHub/PucksApp/CursorBuddy/Utilities/ElementLocationDetector.swift` |
| Cursor appearance config | `~/Documents/GitHub/PucksApp/CursorBuddy/Utilities/CursorAppearanceConfiguration.swift` |
| Push-to-talk shortcut | `~/Documents/GitHub/PucksApp/CursorBuddy/Utilities/PushToTalkShortcutConfiguration.swift` |
| MCP server pattern | `~/clawd/collaborator-clone/src/main/mcp-server.ts` |
| Agent streaming parsers | `~/clawd/collaborator-clone/src/main/agent-stream.ts` |
| Chat tile (2138 lines) | `~/clawd/collaborator-clone/src/renderer/src/components/ChatTile.tsx` |
| Chat IPC | `~/clawd/collaborator-clone/src/main/ipc/chat.ts` |
| Cluso widget pattern | `~/clawd/collaborator-clone/src/renderer/src/components/ClusoWidgetMount.tsx` |
| pi tool format | `~/.nvm/.../pi-coding-agent/docs/extensions.md` |
| pi tool examples | `~/.nvm/.../pi-coding-agent/examples/extensions/tools.ts` |

---

## ⚠️ CONSTRAINTS

- **Cross-platform**: macOS + Windows + Linux. No platform-specific code without fallback.
- **Dual build**: IIFE (web embed) + Electron desktop must both work.
- **Event bus is the API boundary**: components never import each other directly.
- **Viewport-aware**: no hardcoded pixel values. Use viewport-bounds helpers.
- **No platform sniffing in components**: platform logic in hooks/utilities only.
- **pi-compatible tools**: same TypeScript format as pi-coding-agent.
- **MCP-compatible**: both as client and server, stdio + SSE transports.
- **Settings in ~/.cursorbuddy/**: keys.json for API keys, settings.json for config.
