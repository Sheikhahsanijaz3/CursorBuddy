/**
 * IPC Helpers
 *
 * Eliminates the repeated pattern of checking if a window exists
 * and isn't destroyed before sending IPC messages. Every IPC send
 * in main.js was guarded by the same 2-line check — now it's one call.
 */

/** @type {import('electron').BrowserWindow | null} */
let _overlayWindow = null;
/** @type {import('electron').BrowserWindow | null} */
let _panelWindow = null;

function setWindows(overlay, panel) {
  _overlayWindow = overlay;
  _panelWindow = panel;
}

function getOverlayWindow() { return _overlayWindow; }
function getPanelWindow() { return _panelWindow; }

/**
 * Send an IPC message to the overlay window (if it exists and isn't destroyed).
 * @param {string} channel
 * @param  {...any} args
 */
function sendToOverlay(channel, ...args) {
  if (_overlayWindow && !_overlayWindow.isDestroyed()) {
    _overlayWindow.webContents.send(channel, ...args);
  }
}

/**
 * Send an IPC message to the panel window (if it exists and isn't destroyed).
 * @param {string} channel
 * @param  {...any} args
 */
function sendToPanel(channel, ...args) {
  if (_panelWindow && !_panelWindow.isDestroyed()) {
    _panelWindow.webContents.send(channel, ...args);
  }
}

/**
 * Broadcast an IPC message to both overlay and panel windows.
 * @param {string} channel
 * @param  {...any} args
 */
function broadcast(channel, ...args) {
  sendToOverlay(channel, ...args);
  sendToPanel(channel, ...args);
}

module.exports = { setWindows, getOverlayWindow, getPanelWindow, sendToOverlay, sendToPanel, broadcast };
