/**
 * SuggestionChips
 *
 * Compact row of action pill buttons that appears below the buddy triangle
 * when text selection is detected. Subscribes to the event bus for
 * suggestion data and emits action-chosen / dismissed events.
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { DS } from "../lib/design-tokens";
import { eventBus, type SelectionSuggestion } from "../events/event-bus";
import { useCursorStore } from "../stores/cursor-store";

// ── Action icon map ─────────────────────────────────────────
const ACTION_ICONS: Record<string, string> = {
  explain: "💡",
  fix: "🔧",
  translate: "🌐",
  summarize: "📝",
  rewrite: "✏️",
  debug: "🐛",
  search: "🔍",
  reply: "↩️",
  define: "📖",
  improve: "✨",
  convert: "🔄",
  continue: "→",
};

const AUTO_DISMISS_MS = 8000;

export const SuggestionChips: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<SelectionSuggestion[]>([]);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    useCursorStore.getState().setSelectionChipsVisible(false);
    eventBus.emit("selection:dismissed", {});
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  // Subscribe to suggestions-ready events
  useEffect(() => {
    const handleReady = (payload: {
      text: string;
      suggestions: SelectionSuggestion[];
    }) => {
      setText(payload.text);
      setSuggestions(payload.suggestions);
      setVisible(true);
      useCursorStore.getState().setSelectionChipsVisible(true);

      // Auto-dismiss timer
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    };

    eventBus.on("selection:suggestions-ready", handleReady);
    return () => {
      eventBus.off("selection:suggestions-ready", handleReady);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [dismiss]);

  // Dismiss on significant cursor move
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!visible) {
      startPosRef.current = null;
      return;
    }

    startPosRef.current = { ...useCursorStore.getState().systemCursorPosition };
    const MOVE_THRESHOLD_SQ = 60 * 60; // 60px squared, avoid sqrt

    // Check position at a low frequency instead of subscribing to every store update
    const intervalId = setInterval(() => {
      if (!startPosRef.current) return;
      const pos = useCursorStore.getState().systemCursorPosition;
      const dx = pos.x - startPosRef.current.x;
      const dy = pos.y - startPosRef.current.y;
      if (dx * dx + dy * dy > MOVE_THRESHOLD_SQ) {
        dismiss();
      }
    }, 200); // check 5x/sec, not 60x/sec

    return () => clearInterval(intervalId);
  }, [visible, dismiss]);

  const handleChipClick = useCallback(
    (suggestion: SelectionSuggestion) => {
      eventBus.emit("selection:action-chosen", {
        action: suggestion.action,
        prompt: suggestion.prompt,
        text,
      });
      dismiss();
    },
    [text, dismiss]
  );

  if (!visible || suggestions.length === 0) return null;

  const truncated =
    text.length > 30 ? text.slice(0, 30) + "…" : text;

  return (
    <div
      style={{
        position: "absolute",
        top: DS.viewport.localBuddyY + 35,
        left: DS.viewport.localBuddyX - 20,
        pointerEvents: "auto",
        zIndex: 100,
        animation: "chipPopIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}
    >
      <style>{`
        @keyframes chipPopIn {
          0% { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        style={{
          background: "rgba(16, 18, 17, 0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: 12,
          border: "1px solid rgba(59, 130, 246, 0.25)",
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 200,
          maxWidth: 340,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: DS.colors.textSecondary,
              fontFamily: "system-ui, -apple-system, sans-serif",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            Selected: &ldquo;{truncated}&rdquo;
          </span>
          <button
            onClick={dismiss}
            style={{
              background: "none",
              border: "none",
              color: DS.colors.textTertiary,
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: "0 2px",
              flexShrink: 0,
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>

        {/* Chips row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
          }}
        >
          {suggestions.map((s) => (
            <button
              key={s.action}
              onClick={() => handleChipClick(s)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 16,
                border: "1px solid rgba(59, 130, 246, 0.3)",
                background: "rgba(59, 130, 246, 0.12)",
                color: DS.colors.textPrimary,
                fontSize: 12,
                fontFamily: "system-ui, -apple-system, sans-serif",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(59, 130, 246, 0.25)";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(59, 130, 246, 0.5)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(59, 130, 246, 0.12)";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(59, 130, 246, 0.3)";
              }}
            >
              <span style={{ fontSize: 13 }}>
                {ACTION_ICONS[s.action] ?? "⚡"}
              </span>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
