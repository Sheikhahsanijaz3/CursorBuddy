/**
 * Electron Environment Detection
 *
 * Single source of truth for checking whether we're running
 * inside the Electron renderer. Avoids duplicating this check
 * across hooks and utilities.
 */

export function isElectronEnvironment(): boolean {
  return typeof window !== "undefined" && window.electronAPI !== undefined;
}
