# Custom Tools

CursorBuddy can load custom tool files from the filesystem, making them available to the AI during inference. Tools are hot-reloaded when files change.

---

## Tool Directories

CursorBuddy scans these directories for `.js` and `.ts` files (in priority order):

| Directory | Scope |
|-----------|-------|
| `.pi/agent/tools/` | Project-local (relative to working directory) |
| `~/.pi/agent/tools/` | Global (shared across all projects) |
| `~/.cursorbuddy/tools/` | CursorBuddy-specific |

---

## Tool File Format

Each tool file exports a single object with:

```js
// ~/.cursorbuddy/tools/my-tool.js

module.exports = {
  name: "my_tool",
  description: "Does something useful",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string", description: "The input to process" },
    },
    required: ["input"],
  },
  execute: async (params) => {
    // Do something with params.input
    return { result: "done" };
  },
};
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Unique tool name (used in AI function calls) |
| `execute` | `function` | Async function that receives parameters and returns a result |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | Human-readable description (shown to the AI) |
| `parameters` | `object` | JSON Schema describing the tool's input parameters |

---

## TypeScript Support

TypeScript files are compiled at runtime via esbuild:

```ts
// ~/.cursorbuddy/tools/my-tool.ts

export default {
  name: "greet",
  description: "Generate a greeting",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Person to greet" },
    },
    required: ["name"],
  },
  execute: async ({ name }: { name: string }) => {
    return `Hello, ${name}!`;
  },
};
```

If esbuild is not available, CursorBuddy falls back to `require()` (works if `tsx` or a similar loader is installed).

---

## Hot Reloading

CursorBuddy watches all tool directories with `fs.watch()`. When a file is added, modified, or deleted:

- **Added/modified:** the tool is re-loaded immediately
- **Deleted:** the tool is removed from the registry

No restart needed — changes take effect on the next AI message.

---

## How Tools Reach the AI

1. On startup, `tool-loader` scans all directories and loads tools
2. On each inference request, loaded tools are merged with MCP tools
3. For Anthropic: tools are passed as `tools[]` in the API request
4. When the AI returns a `tool_use` block, `tool-loader.executeTool()` runs the function
5. The result is sent back to the AI as a `tool_result`

---

## Managing Tools via IPC

```js
// List all loaded tools
const tools = await window.electronAPI.listTools();
// [{ name: "my_tool", description: "...", parameters: {...}, source: "my-tool.js" }]

// Execute a tool directly
const result = await window.electronAPI.executeTool("my_tool", { input: "test" });

// Force reload all tools
await window.electronAPI.reloadTools();
```

---

## Example: Shell Command Tool

```js
// ~/.cursorbuddy/tools/shell.js
const { exec } = require("child_process");

module.exports = {
  name: "run_shell",
  description: "Run a shell command and return stdout",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to run" },
    },
    required: ["command"],
  },
  execute: async ({ command }) => {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: 10000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout.trim());
      });
    });
  },
};
```

## Example: Web Search Tool

```js
// ~/.cursorbuddy/tools/search.js
module.exports = {
  name: "web_search",
  description: "Search the web and return results",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
    },
    required: ["query"],
  },
  execute: async ({ query }) => {
    const res = await fetch(`https://api.search.example.com?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.results.map(r => `${r.title}: ${r.url}`).join("\n");
  },
};
```
