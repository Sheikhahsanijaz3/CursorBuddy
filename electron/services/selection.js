/**
 * Selection Detection Service
 * 
 * Monitors for text selection via:
 * - Clipboard text changes (cross-platform, triggered on Cmd+C/Ctrl+C)
 * - macOS Accessibility API (live selection without copy, requires ax-selection-helper)
 * - Manual hotkey trigger (sends current clipboard text)
 *
 * Emits detected text to the renderer via IPC for AI-powered suggestions.
 */

const { clipboard, globalShortcut, systemPreferences } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const log = require('../lib/session-logger.js');
const { loadSettings } = require('../lib/settings-cache.js');

let lastClipboardText = '';
let clipboardInterval = null;
let axProcess = null;
let broadcastFn = null; // set by init()
let isEnabled = false;
let hotkey = null;

const CLIPBOARD_POLL_MS = 500;
const DEBOUNCE_MS = 600;
let debounceTimer = null;

function init(broadcast) {
  broadcastFn = broadcast;
  const settings = loadSettings();
  // Default ON unless the user explicitly disabled it.
  isEnabled = settings.selectionDetectionEnabled !== false;

  if (isEnabled) start();
}

function start() {
  // Initialize clipboard with current text so we don't trigger on startup
  lastClipboardText = clipboard.readText() || '';
  startClipboardWatch();
  startAccessibilityHelper();
  registerHotkey();
  log.event('selection:started');
}

function stop() {
  stopClipboardWatch();
  stopAccessibilityHelper();
  unregisterHotkey();
  log.event('selection:stopped');
}

function setEnabled(enabled) {
  const nextEnabled = !!enabled;
  if (!nextEnabled) {
    isEnabled = false;
    stop();
    return;
  }

  // Restart so clipboard watcher, AX helper, and hotkey all pick up latest settings.
  if (isEnabled) stop();
  isEnabled = true;
  start();
}

// ── Clipboard Watching ──────────────────────────────────────

function startClipboardWatch() {
  if (clipboardInterval) return;
  clipboardInterval = setInterval(() => {
    const text = clipboard.readText() || '';
    if (text && text !== lastClipboardText && text.trim().length >= 3) {
      lastClipboardText = text;
      debouncedEmit(text.trim(), 'clipboard');
    }
  }, CLIPBOARD_POLL_MS);
}

function stopClipboardWatch() {
  if (clipboardInterval) {
    clearInterval(clipboardInterval);
    clipboardInterval = null;
  }
}

// ── Accessibility Helper (macOS) ────────────────────────────

/** Check if Accessibility permission is granted (macOS only) */
function checkAccessibilityPermission() {
  if (process.platform !== 'darwin') return true;
  try {
    return systemPreferences.isTrustedAccessibilityClient(false);
  } catch (_) {
    return false;
  }
}

/** Prompt for Accessibility permission (macOS only) */
function requestAccessibilityPermission() {
  if (process.platform !== 'darwin') return;
  try {
    systemPreferences.isTrustedAccessibilityClient(true); // shows prompt
  } catch (_) {}
}

function startAccessibilityHelper() {
  if (process.platform !== 'darwin') return;
  
  if (axProcess) return;

  const settings = loadSettings();
  if (settings.selectionAccessibilityEnabled === false) return;

  if (!checkAccessibilityPermission()) {
    log.event('selection:ax-needs-permission');
    requestAccessibilityPermission();
    return;
  }
  
  const helperPath = path.join(__dirname, '..', 'helpers', 'ax-selection-helper');
  try {
    // Check if helper exists
    const fs = require('fs');
    if (!fs.existsSync(helperPath)) {
      log.event('selection:ax-helper-missing', { path: helperPath });
      return;
    }
    
    axProcess = spawn(helperPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    
    let buffer = '';
    axProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line
      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            if (event.cleared) {
              // Selection was cleared — could dismiss chips
              if (broadcastFn) broadcastFn('selection:cleared', {});
            } else if (event.text && event.text.trim().length >= 3) {
              debouncedEmit(event.text.trim(), 'accessibility', {
                bounds: event.bounds || null,
                app: event.app || null,
              });
            }
          } catch (_) {}
        }
      }
    });
    
    axProcess.on('exit', (code) => {
      log.event('selection:ax-helper-exit', { code });
      axProcess = null;
    });
    
    axProcess.stderr.on('data', (data) => {
      log.event('selection:ax-helper-error', { error: data.toString() });
    });
    
    log.event('selection:ax-helper-started');
  } catch (err) {
    log.event('selection:ax-helper-failed', { error: err.message });
  }
}

function stopAccessibilityHelper() {
  if (axProcess) {
    axProcess.kill();
    axProcess = null;
  }
}

// ── Hotkey Trigger ──────────────────────────────────────────

function registerHotkey() {
  const settings = loadSettings();
  const shortcut = settings.selectionHotkey || 'CommandOrControl+Shift+E';
  try {
    // Unregister old if exists
    if (hotkey) globalShortcut.unregister(hotkey);
    hotkey = shortcut;
    globalShortcut.register(shortcut, () => {
      const text = clipboard.readText() || '';
      if (text.trim().length >= 3) {
        emit(text.trim(), 'hotkey');
      }
    });
  } catch (err) {
    log.event('selection:hotkey-failed', { error: err.message });
  }
}

function unregisterHotkey() {
  if (hotkey) {
    try { globalShortcut.unregister(hotkey); } catch (_) {}
    hotkey = null;
  }
}

// ── Debounce + Emit ─────────────────────────────────────────

function debouncedEmit(text, source, meta = {}) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => emit(text, source, meta), DEBOUNCE_MS);
}

function emit(text, source, meta = {}) {
  if (!broadcastFn || !isEnabled) return;
  log.event('selection:detected', { source, length: text.length });
  broadcastFn('selection:text-detected', { text, source, ...meta });
}

// ── Manual trigger from renderer ────────────────────────────

function triggerFromRenderer(text) {
  if (text && text.trim().length >= 3) {
    emit(text.trim(), 'manual');
  }
}

module.exports = { init, start, stop, setEnabled, triggerFromRenderer, checkAccessibilityPermission, requestAccessibilityPermission };
