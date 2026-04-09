/**
 * Runtime Config
 *
 * Mutable design tokens that can be changed via the settings panel.
 * The panel sends config:update events through the event bus.
 * Components read from here instead of the static DS tokens for
 * values that the user can customize.
 */

import { eventBus } from "../events/event-bus";

export const runtimeConfig = {
  cursorColor: "#3b82f6",
  cursorSize: 16,
  glowIntensity: 8,
  springResponse: 0.2,
  springDamping: 0.6,
  bubbleHoldMs: 3000,
};

/** Listeners notified when config changes */
const listeners = new Set<() => void>();

export function onConfigChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

// Listen for config:update from the panel
eventBus.on("config:update", (payload) => {
  let changed = false;
  if (payload.cursorColor && typeof payload.cursorColor === "string") {
    runtimeConfig.cursorColor = payload.cursorColor;
    changed = true;
  }
  if (typeof payload.cursorSize === "number") {
    runtimeConfig.cursorSize = payload.cursorSize;
    changed = true;
  }
  if (typeof payload.glowIntensity === "number") {
    runtimeConfig.glowIntensity = payload.glowIntensity;
    changed = true;
  }
  if (typeof payload.springResponse === "number") {
    runtimeConfig.springResponse = payload.springResponse;
    changed = true;
  }
  if (typeof payload.springDamping === "number") {
    runtimeConfig.springDamping = payload.springDamping;
    changed = true;
  }
  if (typeof payload.bubbleHold === "number") {
    runtimeConfig.bubbleHoldMs = payload.bubbleHold * 1000;
    changed = true;
  }
  if (changed) notifyListeners();
});
