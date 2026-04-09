# MCP Integration

CursorBuddy supports the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) in both directions: as a **tool server** that other agents can control, and as a **client** that connects to external tool servers.

---

## CursorBuddy as an MCP Server

Other AI agents (Claude Code, Codex, custom agents) can connect to CursorBuddy and control the cursor overlay, capture screenshots, and trigger TTS.

### Starting the Server

The MCP server can be started from the panel UI or via IPC:

```js
// Start on default port 6274
await window.electronAPI.startMCPServer(6274);

// Start on any available port
await window.electronAPI.startMCPServer(0);
```

### Transport: HTTP/SSE

The server runs on `http://127.0.0.1:{port}` with two endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sse` | GET | SSE connection for MCP protocol |
| `/messages` | POST | Send MCP messages (requires active SSE connection) |
| `/` or `/info` | GET | Server info and available tools |

### Transport: stdio

For piped connections (e.g., Claude Code):

```js
await mcpServer.startStdioTransport();
```

### Available Tools

When connected, agents can call these tools:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `cursor_fly_to` | `x`, `y`, `label`, `bubbleText?` | Fly the cursor to screen coordinates |
| `cursor_fly_to_anchor` | `position`, `label`, `bubbleText?` | Fly to a viewport anchor (center, top-right, etc.) |
| `cursor_set_voice_state` | `state` | Set visual state: idle, listening, processing, responding |
| `cursor_show` | — | Show the cursor overlay |
| `cursor_hide` | — | Hide the cursor overlay |
| `screenshot_capture` | — | Capture screenshots of all displays (returns images) |
| `cursor_set_audio_level` | `level` | Drive the waveform (0.0–1.0) |
| `tts_speak` | `text` | Speak text aloud via configured TTS |

### Example: Controlling from Another Agent

```python
# From any MCP client
result = await client.call_tool("cursor_fly_to", {
    "x": 500,
    "y": 300,
    "label": "save button",
    "bubbleText": "click here to save"
})

# Capture what's on screen
screenshots = await client.call_tool("screenshot_capture", {})

# Speak to the user
await client.call_tool("tts_speak", {"text": "all done!"})
```

### Server Status

```js
const status = await window.electronAPI.getMCPServerStatus();
// {
//   running: true,
//   port: 6274,
//   url: "http://127.0.0.1:6274",
//   sseUrl: "http://127.0.0.1:6274/sse",
//   hasClient: true
// }
```

---

## Connecting to External MCP Servers

CursorBuddy can connect to external MCP tool servers (via stdio transport) and make their tools available to the AI during inference.

### Connecting

```js
const result = await window.electronAPI.connectMCPServer({
  name: "my-tools",
  command: "npx",
  args: ["-y", "@my-org/mcp-tools"],
  env: { API_KEY: "..." }
});

console.log(result.tools); // Array of discovered tools
```

### How Tools Are Used

When external tools are connected:

1. Tool descriptions are added to the AI system prompt
2. Tools are passed as Anthropic tool definitions in the API request
3. When the AI calls a tool, CursorBuddy executes it via the MCP client and returns the result
4. The AI can call tools multiple times (up to 5 rounds per message)

### Managing Connections

```js
// List connected servers
const servers = await window.electronAPI.listMCPServers();

// List all discovered tools
const tools = await window.electronAPI.listMCPTools();

// Disconnect
await window.electronAPI.disconnectMCPServer("my-tools");
```

### Auto-Reconnect

MCP server connections are saved in `~/.cursorbuddy/settings.json`. On app launch, CursorBuddy automatically reconnects to all saved servers.

---

## Tool Discovery

Connected MCP tools and custom tools are merged into a single list for the AI. The AI sees tool descriptions and can call any of them during inference.

```
inference request → AI response with tool_use block
                         ↓
              Is it an MCP tool? → Execute via MCP client
              Is it a custom tool? → Execute via tool-loader
                         ↓
              Return result → AI continues
```
