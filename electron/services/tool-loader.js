/**
 * Tool Loader
 *
 * Discovers and loads pi-compatible TypeScript tool files from:
 *   1. .pi/agent/tools/   (project-local)
 *   2. ~/.pi/agent/tools/  (global)
 *   3. ~/.cursorbuddy/tools/ (CursorBuddy-specific)
 *
 * Each tool is a .ts or .js file exporting:
 *   { name, description, parameters, execute }
 *
 * Tools are compiled at load time via esbuild (if .ts) or required
 * directly (if .js). They're registered as available functions for
 * the AI and exposed via the MCP server.
 */

const fs = require("fs");
const path = require("path");

const HOME = process.env.HOME || process.env.USERPROFILE || ".";

/** Directories to scan for tools, in priority order */
const TOOL_DIRS = [
  path.join(process.cwd(), ".pi", "agent", "tools"),
  path.join(HOME, ".pi", "agent", "tools"),
  path.join(HOME, ".cursorbuddy", "tools"),
];

/** Loaded tools: name → { name, description, parameters, execute, filePath } */
const loadedTools = new Map();

/** File watchers for hot-reload */
const watchers = new Map();

/**
 * Scan all tool directories and load tools.
 */
async function loadAllTools() {
  loadedTools.clear();

  for (const dir of TOOL_DIRS) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(
      (f) => (f.endsWith(".js") || f.endsWith(".ts")) && !f.startsWith(".")
    );

    for (const file of files) {
      const filePath = path.join(dir, file);
      await loadToolFile(filePath);
    }
  }

  console.log(`[ToolLoader] Loaded ${loadedTools.size} tools from ${TOOL_DIRS.filter(d => fs.existsSync(d)).length} directories`);
  return getToolList();
}

/**
 * Load a single tool file. Supports .js directly, .ts via esbuild transform.
 */
async function loadToolFile(filePath) {
  try {
    let mod;

    if (filePath.endsWith(".ts")) {
      // Compile TypeScript to JS at runtime
      try {
        const esbuild = require("esbuild");
        const result = await esbuild.build({
          entryPoints: [filePath],
          bundle: false,
          write: false,
          format: "cjs",
          platform: "node",
          target: "node18",
        });
        const code = result.outputFiles[0].text;
        const Module = require("module");
        const m = new Module(filePath);
        m._compile(code, filePath);
        mod = m.exports;
      } catch (esbuildError) {
        // Fallback: try requiring directly (might work if tsx is available)
        try {
          delete require.cache[filePath];
          mod = require(filePath);
        } catch (_) {
          console.warn(`[ToolLoader] Cannot compile ${path.basename(filePath)}: ${esbuildError.message}`);
          return;
        }
      }
    } else {
      // Plain JS — require directly
      delete require.cache[filePath];
      mod = require(filePath);
    }

    // Handle default export
    if (mod.default) mod = mod.default;

    // Validate tool shape
    if (!mod.name || !mod.execute) {
      console.warn(`[ToolLoader] Skipping ${path.basename(filePath)}: missing name or execute`);
      return;
    }

    loadedTools.set(mod.name, {
      name: mod.name,
      description: mod.description || "",
      parameters: mod.parameters || {},
      execute: mod.execute,
      filePath,
    });

    console.log(`[ToolLoader] Loaded tool: ${mod.name} (${path.basename(filePath)})`);
  } catch (err) {
    console.warn(`[ToolLoader] Failed to load ${path.basename(filePath)}: ${err.message}`);
  }
}

/**
 * Watch tool directories for changes and hot-reload.
 */
function watchToolDirs() {
  for (const dir of TOOL_DIRS) {
    if (!fs.existsSync(dir)) continue;
    if (watchers.has(dir)) continue;

    try {
      const watcher = fs.watch(dir, { persistent: false }, async (eventType, filename) => {
        if (!filename || (!filename.endsWith(".js") && !filename.endsWith(".ts"))) return;
        console.log(`[ToolLoader] File changed: ${filename} — reloading`);
        const filePath = path.join(dir, filename);
        if (fs.existsSync(filePath)) {
          await loadToolFile(filePath);
        } else {
          // File deleted — find and remove the tool
          for (const [name, tool] of loadedTools) {
            if (tool.filePath === filePath) {
              loadedTools.delete(name);
              console.log(`[ToolLoader] Removed tool: ${name}`);
              break;
            }
          }
        }
      });
      watchers.set(dir, watcher);
    } catch (_) {}
  }
}

/**
 * Execute a loaded tool by name.
 */
async function executeTool(name, params) {
  const tool = loadedTools.get(name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool.execute(params);
}

/**
 * Get list of all loaded tools (for AI function calling / MCP).
 */
function getToolList() {
  return Array.from(loadedTools.values()).map(({ name, description, parameters, filePath }) => ({
    name,
    description,
    parameters,
    source: path.basename(filePath),
  }));
}

/**
 * Stop all file watchers.
 */
function stopWatching() {
  for (const [, watcher] of watchers) {
    watcher.close();
  }
  watchers.clear();
}

module.exports = { loadAllTools, executeTool, getToolList, watchToolDirs, stopWatching };
