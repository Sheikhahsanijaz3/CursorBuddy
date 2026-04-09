/**
 * Settings Cache
 *
 * Wraps settings read/write with a simple in-memory cache.
 * Avoids re-reading the JSON file from disk on every inference,
 * STT, and TTS call (was called 4+ times per voice interaction).
 *
 * Cache is invalidated on save and stale after 5 seconds.
 */

const fs = require("fs");
const path = require("path");

const SETTINGS_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".cursorbuddy"
);
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

/** @type {object | null} */
let cached = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000;

function loadSettings() {
  const now = Date.now();
  if (cached && now - cacheTimestamp < CACHE_TTL_MS) {
    return cached;
  }
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      cached = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      cacheTimestamp = now;
      return cached;
    }
  } catch (err) {
    console.warn("[Settings] Failed to parse settings file:", err.message);
  }
  return {};
}

function saveSettings(settings) {
  try {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    // Invalidate cache so next read picks up the new values
    cached = settings;
    cacheTimestamp = Date.now();
  } catch (err) {
    console.error("[Settings] Save failed:", err.message);
  }
}

/** Force-invalidate the cache (e.g. after external edit) */
function invalidateCache() {
  cached = null;
  cacheTimestamp = 0;
}

module.exports = { loadSettings, saveSettings, invalidateCache, SETTINGS_DIR, SETTINGS_FILE };
