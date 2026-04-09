/**
 * System Actions
 *
 * Built-in tools that give Claude the ability to interact with the OS:
 * click, type, press keys, open apps/URLs, and scroll. Uses cliclick
 * on macOS for reliable mouse/keyboard automation.
 *
 * These tools are injected into the inference tool array alongside
 * MCP tools so Claude can call them during conversation.
 */

const { execFileSync } = require("child_process");
const log = require("../lib/session-logger.js");

// ── Helpers ──────────────────────────────────────────────────

function runCliclick(args) {
  execFileSync("cliclick", args, { timeout: 5000 });
}

function runOsascript(script) {
  execFileSync("osascript", ["-e", script], { timeout: 5000 });
}

// ── Tool Definitions (Anthropic format) ──────────────────────

const SYSTEM_TOOLS = [
  {
    name: "click",
    description: "Click at screen coordinates. Use after identifying where to click from a screenshot.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate in logical screen pixels" },
        y: { type: "number", description: "Y coordinate in logical screen pixels" },
        button: { type: "string", enum: ["left", "right"], description: "Mouse button (default: left)" },
        double: { type: "boolean", description: "Double-click (default: false)" },
      },
      required: ["x", "y"],
    },
    execute: async (input) => {
      const { x, y, button, double: dbl } = input;
      const ix = Math.round(x);
      const iy = Math.round(y);
      try {
        if (button === "right") {
          runCliclick([`rc:${ix},${iy}`]);
        } else if (dbl) {
          runCliclick([`dc:${ix},${iy}`]);
        } else {
          runCliclick([`c:${ix},${iy}`]);
        }
        log.event("action:click", { x: ix, y: iy, button: button || "left", double: !!dbl });
        return { content: [{ type: "text", text: `Clicked at (${ix}, ${iy})` }] };
      } catch (err) {
        log.error("action:click_error", err, { x: ix, y: iy });
        return { content: [{ type: "text", text: `Click failed: ${err.message}` }] };
      }
    },
  },
  {
    name: "type_text",
    description: "Type text at the current cursor position. Click a text field first, then type into it.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to type" },
      },
      required: ["text"],
    },
    execute: async (input) => {
      const { text } = input;
      try {
        runCliclick([`t:${text}`]);
        log.event("action:type", { textLength: text.length });
        return { content: [{ type: "text", text: `Typed: "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"` }] };
      } catch (err) {
        log.error("action:type_error", err);
        return { content: [{ type: "text", text: `Type failed: ${err.message}` }] };
      }
    },
  },
  {
    name: "key_press",
    description: "Press a key or key combination. Examples: 'return', 'cmd+t', 'cmd+l', 'cmd+space', 'escape', 'tab', 'cmd+shift+a'. Use for keyboard shortcuts and special keys.",
    inputSchema: {
      type: "object",
      properties: {
        keys: { type: "string", description: "Key combo like 'return', 'cmd+t', 'cmd+l', 'escape', 'cmd+space'" },
      },
      required: ["keys"],
    },
    execute: async (input) => {
      const { keys } = input;
      try {
        const cliclickArgs = buildKeySequence(keys);
        runCliclick(cliclickArgs);
        log.event("action:key_press", { keys });
        return { content: [{ type: "text", text: `Pressed: ${keys}` }] };
      } catch (err) {
        log.error("action:key_press_error", err, { keys });
        return { content: [{ type: "text", text: `Key press failed: ${err.message}` }] };
      }
    },
  },
  {
    name: "open_app_or_url",
    description: "Open an application by name or a URL in the default browser. Examples: 'Safari', 'GitHub Desktop', 'https://github.com'.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "App name (e.g. 'Safari', 'Terminal') or full URL (e.g. 'https://github.com')" },
      },
      required: ["target"],
    },
    execute: async (input) => {
      const { target } = input;
      try {
        if (target.startsWith("http://") || target.startsWith("https://")) {
          execFileSync("open", [target], { timeout: 5000 });
          log.event("action:open_url", { url: target });
          return { content: [{ type: "text", text: `Opened URL: ${target}` }] };
        } else {
          execFileSync("open", ["-a", target], { timeout: 5000 });
          log.event("action:open_app", { app: target });
          return { content: [{ type: "text", text: `Opened app: ${target}` }] };
        }
      } catch (err) {
        log.error("action:open_error", err, { target });
        return { content: [{ type: "text", text: `Open failed: ${err.message}` }] };
      }
    },
  },
  {
    name: "scroll",
    description: "Scroll at the current mouse position. Use positive dy to scroll down, negative dy to scroll up.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate to scroll at" },
        y: { type: "number", description: "Y coordinate to scroll at" },
        dy: { type: "number", description: "Scroll amount: positive = down, negative = up. Typical: 3-5." },
      },
      required: ["dy"],
    },
    execute: async (input) => {
      const { x, y, dy } = input;
      try {
        if (x != null && y != null) {
          runCliclick([`m:${Math.round(x)},${Math.round(y)}`]);
        }
        // AppleScript scroll — cliclick doesn't support scroll
        const direction = dy > 0 ? "down" : "up";
        const amount = Math.abs(Math.round(dy));
        runOsascript(`tell application "System Events" to scroll ${direction} by ${amount}`);
        log.event("action:scroll", { x, y, dy });
        return { content: [{ type: "text", text: `Scrolled ${direction} by ${amount}` }] };
      } catch (err) {
        log.error("action:scroll_error", err);
        return { content: [{ type: "text", text: `Scroll failed: ${err.message}` }] };
      }
    },
  },
  {
    name: "wait",
    description: "Wait for milliseconds. Use between actions to let UI update or pages load.",
    inputSchema: {
      type: "object",
      properties: {
        ms: { type: "number", description: "Milliseconds to wait (max 5000)" },
      },
      required: ["ms"],
    },
    execute: async (input) => {
      const ms = Math.min(input.ms || 1000, 5000);
      await new Promise(resolve => setTimeout(resolve, ms));
      log.event("action:wait", { ms });
      return { content: [{ type: "text", text: `Waited ${ms}ms` }] };
    },
  },
];

// ── Key Combo Parser ─────────────────────────────────────────

const KEY_MAP = {
  return: "kp:return", enter: "kp:return",
  tab: "kp:tab",
  escape: "kp:escape", esc: "kp:escape",
  space: "kp:space",
  delete: "kp:delete", backspace: "kp:delete",
  up: "kp:arrow-up", down: "kp:arrow-down",
  left: "kp:arrow-left", right: "kp:arrow-right",
  home: "kp:home", end: "kp:end",
  pageup: "kp:page-up", pagedown: "kp:page-down",
  f1: "kp:f1", f2: "kp:f2", f3: "kp:f3", f4: "kp:f4",
  f5: "kp:f5", f6: "kp:f6", f7: "kp:f7", f8: "kp:f8",
  f9: "kp:f9", f10: "kp:f10", f11: "kp:f11", f12: "kp:f12",
};

const MODIFIER_MAP = {
  cmd: "cmd", command: "cmd",
  ctrl: "ctrl", control: "ctrl",
  alt: "alt", option: "alt",
  shift: "shift",
};

/**
 * Convert a human-readable key combo into cliclick argument array.
 * "cmd+l" → ["kd:cmd", "kp:l", "ku:cmd"]
 */
function buildKeySequence(combo) {
  const parts = combo.toLowerCase().split("+").map(p => p.trim());
  const modifiers = [];
  let key = null;

  for (const part of parts) {
    if (MODIFIER_MAP[part]) {
      modifiers.push(MODIFIER_MAP[part]);
    } else {
      key = part;
    }
  }

  if (!key) throw new Error(`No key found in combo: ${combo}`);

  const args = [];

  // Press modifiers down
  for (const mod of modifiers) args.push(`kd:${mod}`);

  // Press the key
  if (KEY_MAP[key]) {
    args.push(KEY_MAP[key]);
  } else if (key.length === 1) {
    args.push(`t:${key}`);
  } else {
    args.push(`kp:${key}`);
  }

  // Release modifiers (reverse order)
  for (const mod of [...modifiers].reverse()) args.push(`ku:${mod}`);

  return args;
}

// ── Public API ───────────────────────────────────────────────

function getSystemTools() {
  return SYSTEM_TOOLS;
}

module.exports = { getSystemTools };
