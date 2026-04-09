#!/usr/bin/env node

/**
 * CursorBuddy CLI
 *
 * Control the CursorBuddy overlay from the terminal.
 * Connects to the running CursorBuddy MCP server via HTTP/SSE.
 *
 * Usage:
 *   buddy fly 500 300 "save button"
 *   buddy fly top-right "settings"
 *   buddy say "hello world"
 *   buddy screenshot
 *   buddy show / hide
 *   buddy state idle|listening|processing|responding
 *   buddy audio 0.7
 *   buddy chat "what's on my screen?"
 *   buddy tools
 *   buddy status
 *   buddy server start|stop|status
 *   buddy config
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────

const CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".cursorbuddy"
);
const CONFIG_FILE = path.join(CONFIG_DIR, "settings.json");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch (_) {}
  return {};
}

function getServerUrl() {
  const config = loadConfig();
  return process.env.CURSORBUDDY_URL || config.cliServerUrl || "http://127.0.0.1:6274";
}

// ── HTTP helpers ──────────────────────────────────────────

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    http.get(urlStr, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (_) { resolve(data); }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

function httpPost(urlStr, body) {
  const url = new URL(urlStr);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch (_) { resolve(data); }
        });
      }
    );
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Call an MCP tool on the running CursorBuddy server.
 * Uses the JSON-RPC over HTTP/SSE protocol.
 */
async function callTool(toolName, args) {
  const base = getServerUrl();
  try {
    const result = await httpPost(`${base}/call`, { tool: toolName, args });
    return result;
  } catch (err) {
    try {
      await httpGet(`${base}/info`);
      console.error(`Server is running but tool call failed: ${err.message}`);
    } catch (_) {
      console.error(`Cannot connect to CursorBuddy at ${base}`);
      console.error("Is CursorBuddy running? Start the MCP server in settings.");
    }
    process.exit(1);
  }
}

// ── Commands ──────────────────────────────────────────────

const ANCHORS = new Set([
  "center", "top-left", "top-right", "bottom-left", "bottom-right",
  "top-center", "bottom-center", "center-left", "center-right",
]);

async function cmdFly(args) {
  if (args.length === 0) {
    console.error("Usage: buddy fly <x> <y> [label] [bubbleText]");
    console.error("       buddy fly <anchor> [label] [bubbleText]");
    console.error("Anchors:", [...ANCHORS].join(", "));
    process.exit(1);
  }

  // Check if first arg is an anchor name
  if (ANCHORS.has(args[0])) {
    const result = await callTool("cursor_fly_to_anchor", {
      position: args[0],
      label: args[1] || args[0],
      bubbleText: args[2] || undefined,
    });
    printResult(result);
    return;
  }

  // Coordinate mode
  const x = parseFloat(args[0]);
  const y = parseFloat(args[1]);
  if (isNaN(x) || isNaN(y)) {
    console.error("Invalid coordinates. Use: buddy fly <x> <y> [label]");
    process.exit(1);
  }
  const result = await callTool("cursor_fly_to", {
    x, y,
    label: args[2] || "target",
    bubbleText: args[3] || undefined,
  });
  printResult(result);
}

async function cmdSay(args) {
  if (args.length === 0) {
    console.error("Usage: buddy say <text>");
    process.exit(1);
  }
  const result = await callTool("tts_speak", { text: args.join(" ") });
  printResult(result);
}

async function cmdScreenshot() {
  const result = await callTool("screenshot_capture", {});
  if (result?.result?.content) {
    const textBlocks = result.result.content.filter((c) => c.type === "text");
    textBlocks.forEach((b) => console.log(b.text));
    const imageBlocks = result.result.content.filter((c) => c.type === "image");
    if (imageBlocks.length > 0) {
      console.log(`\n${imageBlocks.length} screenshot(s) captured (base64 in response).`);
    }
  } else {
    printResult(result);
  }
}

async function cmdShow() {
  const result = await callTool("cursor_show", {});
  printResult(result);
}

async function cmdHide() {
  const result = await callTool("cursor_hide", {});
  printResult(result);
}

async function cmdState(args) {
  const valid = ["idle", "listening", "processing", "responding"];
  if (args.length === 0 || !valid.includes(args[0])) {
    console.error("Usage: buddy state <idle|listening|processing|responding>");
    process.exit(1);
  }
  const result = await callTool("cursor_set_voice_state", { state: args[0] });
  printResult(result);
}

async function cmdAudio(args) {
  const level = parseFloat(args[0]);
  if (isNaN(level) || level < 0 || level > 1) {
    console.error("Usage: buddy audio <0.0-1.0>");
    process.exit(1);
  }
  const result = await callTool("cursor_set_audio_level", { level });
  printResult(result);
}

async function cmdTools() {
  const base = getServerUrl();
  try {
    const info = await httpGet(`${base}/info`);
    console.log(`${info.name} v${info.version}`);
    console.log(`\nAvailable tools (${info.tools.length}):`);
    info.tools.forEach((t) => console.log(`  ${t}`));
  } catch (_) {
    console.error(`Cannot connect to CursorBuddy at ${base}`);
    process.exit(1);
  }
}

async function cmdStatus() {
  const base = getServerUrl();
  try {
    const info = await httpGet(`${base}/info`);
    console.log(`✅ ${info.name} v${info.version} running at ${base}`);
    console.log(`   Transport: ${info.transport}`);
    console.log(`   SSE: ${base}/sse`);
    console.log(`   Tools: ${info.tools.length}`);
  } catch (_) {
    console.error(`❌ CursorBuddy not reachable at ${base}`);
    process.exit(1);
  }
}

async function cmdConfig() {
  const config = loadConfig();
  console.log(`Config: ${CONFIG_FILE}`);
  console.log(`Server: ${getServerUrl()}`);
  console.log(`\nMCP config for Claude Code / .claude.json:`);
  console.log(JSON.stringify({
    mcpServers: {
      cursorbuddy: {
        type: "sse",
        url: `${getServerUrl()}/sse`,
      },
    },
  }, null, 2));
}

async function cmdCalibrate() {
  console.log("Cursor Calibration Wizard");
  console.log("========================");
  console.log("The cursor will fly to 5 points on your screen.");
  console.log("After each, move your REAL mouse to where the cursor SHOULD be,");
  console.log("then press Enter.\n");

  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise((resolve) => rl.question(q, resolve));

  const base = getServerUrl();
  const bounds = await httpGet(`${base}/info`).catch(() => null);
  if (!bounds) {
    console.error("Cannot connect to CursorBuddy server. Start it first.");
    process.exit(1);
  }

  // Use approximate screen bounds
  const w = 1920, h = 1080, pad = 200;
  const points = [
    { x: w/2, y: h/2 },
    { x: pad, y: pad },
    { x: w-pad, y: pad },
    { x: pad, y: h-pad },
    { x: w-pad, y: h-pad },
  ];

  const pairs = [];
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    console.log(`\nPoint ${i+1}/${points.length}: flying to (${pt.x}, ${pt.y})...`);
    await callTool("cursor_fly_to", { x: pt.x, y: pt.y, label: `cal ${i+1}`, bubbleText: `drag to correct spot (${i+1}/${points.length})` });
    await question("Move mouse to correct position, then press Enter: ");
    // Read actual cursor position
    const actual = await httpGet(`${base}/call`).catch(() => ({ x: pt.x, y: pt.y }));
    // For now just record what user reports
    console.log(`  Expected: (${pt.x}, ${pt.y})`);
    pairs.push({ expected: pt, actual: pt }); // TODO: read actual from server
  }

  console.log("\nCalibration data collected. Apply it in the CursorBuddy panel > Playground > Calibration.");
  rl.close();
}

function cmdHelp() {
  console.log(`
CursorBuddy CLI — control the cursor companion from your terminal

Commands:
  buddy fly <x> <y> [label] [bubble]   Fly cursor to coordinates
  buddy fly <anchor> [label] [bubble]   Fly to viewport anchor
  buddy say <text>                      Speak text via TTS
  buddy screenshot                      Capture all screens
  buddy show                            Show cursor overlay
  buddy hide                            Hide cursor overlay
  buddy state <state>                   Set voice state (idle/listening/processing/responding)
  buddy audio <0-1>                     Set waveform audio level
  buddy tools                           List available MCP tools
  buddy status                          Check if server is running
  buddy config                          Show config + MCP setup
  buddy calibrate                       Run cursor calibration wizard

Anchors: center, top-left, top-right, bottom-left, bottom-right,
         top-center, bottom-center, center-left, center-right

Environment:
  CURSORBUDDY_URL   Override server URL (default: http://127.0.0.1:6274)
`.trim());
}

// ── Output ────────────────────────────────────────────────

function printResult(result) {
  if (!result) return;
  if (result.ok && result.result) {
    // Direct /call endpoint response
    if (typeof result.result === "string") console.log(result.result);
    else if (result.result.text) console.log(result.result.text);
    else console.log(JSON.stringify(result.result, null, 2));
  } else if (result.result?.content) {
    // MCP JSON-RPC response
    result.result.content
      .filter((c) => c.type === "text")
      .forEach((c) => console.log(c.text));
  } else if (result.error) {
    console.error("Error:", result.error.message || result.error);
  } else if (typeof result === "string") {
    console.log(result);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0]?.toLowerCase();
  const rest = args.slice(1);

  switch (cmd) {
    case "fly":        return cmdFly(rest);
    case "say":
    case "speak":      return cmdSay(rest);
    case "screenshot":
    case "capture":    return cmdScreenshot();
    case "show":       return cmdShow();
    case "hide":       return cmdHide();
    case "state":      return cmdState(rest);
    case "audio":
    case "level":      return cmdAudio(rest);
    case "tools":      return cmdTools();
    case "status":     return cmdStatus();
    case "config":
    case "setup":      return cmdConfig();
    case "calibrate": return cmdCalibrate();
    case "help":
    case "--help":
    case "-h":         return cmdHelp();
    default:
      if (!cmd) return cmdHelp();
      console.error(`Unknown command: ${cmd}`);
      console.error("Run 'buddy help' for usage.");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
