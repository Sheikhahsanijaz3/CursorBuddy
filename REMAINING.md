# CursorBuddy — Remaining Items

All 8 phases are built. These are polish, refinement, and incomplete items.

---

## 🔴 Bugs / Broken

| # | Item | Details |
|---|------|---------|
| 1 | **setPosition crash** | Wrapped in try/catch but root cause unclear — Electron sometimes rejects valid-looking integers. Needs investigation on Windows/Linux. |
| 2 | **Voice double-start stutter** | "I've got, I've got" — voice pipeline gets full text on `done` but may partially overlap with panel-side logic. Need to verify the single-path fix holds. |
| 3 | **MCP tool results format** | Bash tool returns unstructured output — fixed but needs testing with more MCP servers (filesystem, GitHub, etc). |
| 4 | **Sidebar drag order not restored** | Saves `sidebarOrder` to settings but doesn't reorder DOM on load. |
| 5 | **Font change misses dynamic elements** | `setUIFont` applies to existing elements but new ones created after (chat messages, tool blocks) inherit body font — may need CSS variable approach instead. |

---

## 🟡 Incomplete Features

| # | Item | Details | Priority |
|---|------|---------|----------|
| 6 | **Cursor crosshair on screenshots** | `drawCursorCrosshair()` in capture.js is a stub — returns original image. Needs `sharp` or `node-canvas` dep to composite the red crosshair SVG onto the JPEG. | Medium |
| 7 | **Apple Speech fallback** | STT provider option exists in UI but renderer-side `webkitSpeechRecognition` integration not wired. Needs: start recognition on `stt:start` with provider `apple`, pipe results back via IPC. | Low |
| 8 | **MCP SSE client transport** | `mcp-client.js` only supports stdio connections. Need to add SSE/HTTP client transport for connecting to remote MCP servers (e.g. `{ type: "sse", url: "http://..." }`). | Medium |
| 9 | **Codex CLI as inference provider** | Listed in TODO Phase 3. Need: spawn `codex` as child process, stream stdout, parse responses, wire as provider option in Models tab. | Low |
| 10 | **Claude Code SDK integration** | `@anthropic-ai/claude-code` `query()` not wired as an inference provider. Would give agent-level capabilities (file ops, commands) beyond MCP tools. | Medium |
| 11 | **Appearance live preview** | Look tab sliders change values but no demo animation on the cursor to show the effect in real-time. Need: on slider change, trigger a short fly-to demo on the overlay. | Low |
| 12 | **OpenAI tool calling** | Anthropic tool calling loop works. OpenAI path sends tools in system prompt text but doesn't use OpenAI's native `tools` parameter or handle `tool_calls` in responses. | High |
| 13 | **Computer Use (OpenAI)** | `computer-use-preview` model listed but no actual OpenAI computer use implementation. Only Anthropic CU works. | Medium |
| 14 | **Streaming for Anthropic** | Tool calling loop uses `client.messages.create()` (non-streaming) instead of `.stream()`. Means no progressive text display during inference — full response arrives at once. Need to switch back to streaming and handle tool_use events in the stream. | High |

---

## 🟢 Polish / UX

| # | Item | Details | Priority |
|---|------|---------|----------|
| 15 | **Electron-builder packaging** | No `electron-builder` config. Need: `build` section in package.json, icon assets (.icns, .ico), code signing config, auto-update. Required to ship .dmg/.exe/.AppImage. | High |
| 16 | **Web embed library rebuild** | `npm run build:lib` needs to run after all the panel/component changes. Verify IIFE bundle still works on test.html. ChatPanel.tsx React component needs testing. | Medium |
| 17 | **Chat markdown rendering** | Basic code blocks and bold work. Missing: links, lists, tables, images, inline code highlighting, blockquotes. Consider adding a lightweight markdown lib (marked, markdown-it). | Medium |
| 18 | **Chat scroll-to-bottom** | Auto-scroll works but no "scroll to bottom" button when user scrolls up to read history. | Low |
| 19 | **Conversation export** | No way to export/save chat history. Add: copy conversation, export as markdown, export as JSON. | Low |
| 20 | **Keyboard shortcut registration** | Shortcuts tab captures combos but doesn't actually re-register `globalShortcut` in Electron. Captured values saved to settings but not applied at runtime. | High |
| 21 | **Push-to-talk key-up detection** | `globalShortcut` doesn't support key-up. Current workaround is toggle (press to start, press again to stop). For true push-to-talk, need `iohook` or native module for key-up events. | Medium |
| 22 | **Multi-monitor overlay** | Overlay window is single 320×80 that follows cursor. When cursor moves to a different monitor, the window moves but may not render correctly on displays with different scale factors. | Medium |
| 23 | **Settings validation** | No validation on API key format, URL format, or numeric ranges. Bad values silently fail at runtime. | Low |
| 24 | **Error toasts** | Errors show as system messages in chat or console.log. Need: non-intrusive toast notifications for TTS failures, STT errors, MCP connection issues. | Medium |
| 25 | **Panel close-on-click-outside** | Panel stays open when clicking elsewhere. Should auto-hide like the original Clicky menu bar panel (NSPanel with click-outside-to-dismiss). | Low |
| 26 | **Tray icon context menu** | Right-click menu only has "Toggle Panel" and "Quit". Add: quick model switch, mute TTS, show/hide cursor, recent conversations. | Low |
| 27 | **Dark/light theme** | Only dark theme. The CSS variables are ready for a light theme but no toggle exists. | Low |
| 28 | **Onboarding** | No first-run experience. Should: prompt for API key, show quick tutorial, demo the cursor pointing. | Medium |

---

## 📦 Build / Release

| # | Item | Details |
|---|------|---------|
| 29 | **electron-builder config** | Add to package.json: `"build": { "appId": "com.cursorbuddy.app", "mac": { "icon": "electron/icons/icon.png" }, "win": { ... }, "linux": { ... } }` |
| 30 | **Code signing (macOS)** | Need Apple Developer cert for notarization. Without it, users get "unidentified developer" warning. |
| 31 | **Auto-update** | `electron-updater` for checking GitHub releases. |
| 32 | **DMG background** | Custom installer background image with CursorBuddy branding. |
| 33 | **Windows installer** | NSIS or MSI via electron-builder. Test transparent window on Windows (known issues with some GPU drivers). |
| 34 | **Linux AppImage** | Build and test. Transparent windows may not work on all compositors (Wayland vs X11). |

---

## 🧪 Testing

| # | Item | Details |
|---|------|---------|
| 35 | **IIFE bundle test** | Run `npm run build:lib` and verify `test.html` still works with all new features. |
| 36 | **Cross-platform smoke test** | Test Electron on Windows and Linux (at least in a VM). |
| 37 | **MCP server integration test** | Connect Claude Code to CursorBuddy's SSE endpoint and verify tool calls work end-to-end. |
| 38 | **Tool calling round-trip** | Test: user asks question → AI calls MCP tool → result returned → AI responds with tool output. Verify no double-speak, no POINT tag leaks. |
| 39 | **Multi-provider test** | Switch between Anthropic/OpenAI/Ollama in Models tab and verify inference works for each. |
| 40 | **Voice pipeline timing** | Test sentence-chunked TTS: verify cursor flies to the right element at the right moment during speech, not before or after. |

---

## Summary

| Category | Count |
|----------|-------|
| 🔴 Bugs | 5 |
| 🟡 Incomplete | 9 |
| 🟢 Polish | 14 |
| 📦 Build | 6 |
| 🧪 Testing | 6 |
| **Total** | **40** |
