/**
 * MCP Client
 *
 * Connects to external MCP servers (stdio or SSE) and discovers
 * their tools. Discovered tools are passed to the inference service
 * as available functions for the AI to call.
 */

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { spawn } = require("child_process");

/** Active MCP client connections: name → { client, tools } */
const connections = new Map();

/**
 * Connect to an MCP server.
 * @param {object} config - { name, command, args?, env? }
 * @returns {Promise<{ tools: Array }>}
 */
async function connectServer(config) {
  // Disconnect existing connection with same name
  await disconnectServer(config.name);

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args || [],
    env: { ...process.env, ...(config.env || {}) },
  });

  const client = new Client({ name: "cursorbuddy", version: "0.1.0" }, {});
  await client.connect(transport);

  // Discover tools
  const toolsResult = await client.listTools();
  const tools = (toolsResult.tools || []).map((t) => ({
    name: t.name,
    description: t.description || "",
    inputSchema: t.inputSchema || {},
    serverName: config.name,
  }));

  connections.set(config.name, { client, transport, tools, config });
  console.log(`[MCP Client] Connected to "${config.name}" — ${tools.length} tools`);
  return { tools };
}

/**
 * Disconnect from an MCP server.
 */
async function disconnectServer(name) {
  const conn = connections.get(name);
  if (!conn) return;
  try {
    await conn.client.close();
  } catch (_) {}
  connections.delete(name);
  console.log(`[MCP Client] Disconnected from "${name}"`);
}

/**
 * Call a tool on a connected MCP server.
 */
async function callTool(serverName, toolName, args) {
  const conn = connections.get(serverName);
  if (!conn) throw new Error(`MCP server "${serverName}" not connected`);

  const result = await conn.client.callTool({ name: toolName, arguments: args });
  return result;
}

/**
 * Get all discovered tools across all connected servers.
 */
function getAllTools() {
  const allTools = [];
  for (const [, conn] of connections) {
    allTools.push(...conn.tools);
  }
  return allTools;
}

/**
 * Get connected server names.
 */
function getConnectedServers() {
  return Array.from(connections.keys());
}

/**
 * Disconnect all servers.
 */
async function disconnectAll() {
  for (const name of connections.keys()) {
    await disconnectServer(name);
  }
}

module.exports = {
  connectServer,
  disconnectServer,
  callTool,
  getAllTools,
  getConnectedServers,
  disconnectAll,
};
