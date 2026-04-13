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
import { isElectronEnvironment } from "../lib/is-electron";

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

export const SuggestionChips: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
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

  useEffect(() => {
    const handlePanelState = (payload?: { open?: boolean }) => {
      const isOpen = Boolean(payload?.open);
      setSuppressed(isOpen);
      if (isOpen) dismiss();
    };
    eventBus.onDynamic("selection:panel-chat-state", handlePanelState as (...args: unknown[]) => void);
    return () => {
      eventBus.offDynamic("selection:panel-chat-state", handlePanelState as (...args: unknown[]) => void);
    };
  }, [dismiss]);

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
    };

    eventBus.on("selection:suggestions-ready", handleReady);
    return () => {
      eventBus.off("selection:suggestions-ready", handleReady);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [dismiss]);

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

  // Unmount-only cleanup for overlay interactivity
  useEffect(() => {
    return () => {
      window.electronAPI?.setOverlayInteractive?.(false);
    };
  }, []);

  // Sync overlay interactivity with chip visibility
  useEffect(() => {
    if (!isElectronEnvironment() || !window.electronAPI?.setOverlayInteractive) return;
    window.electronAPI.setOverlayInteractive(!suppressed && visible && suggestions.length > 0);
  }, [suppressed, visible, suggestions.length]);

  if (suppressed || !visible || suggestions.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 6,
        left: DS.viewport.localBuddyX + 14,
        pointerEvents: "auto",
        zIndex: 100,
        animation: "chipPopIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
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
          background: "rgba(16, 18, 17, 0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: 12,
          border: "1px solid rgba(59, 130, 246, 0.22)",
          padding: "6px 8px",
          display: "flex",
          flexWrap: "wrap",
          gap: 5,
          maxWidth: 258,
          boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
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
              padding: "4px 9px",
              borderRadius: 16,
              border: "1px solid rgba(59, 130, 246, 0.28)",
              background: "rgba(59, 130, 246, 0.12)",
              color: DS.colors.textPrimary,
              fontSize: 11,
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
                "rgba(59, 130, 246, 0.28)";
            }}
            title={s.label}
          >
            <span style={{ fontSize: 12 }}>
              {ACTION_ICONS[s.action] ?? "⚡"}
            </span>
            {s.label}
          </button>
        ))}

        <button
          onClick={dismiss}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 999,
            border: "1px solid rgba(148, 163, 184, 0.2)",
            background: "rgba(255,255,255,0.04)",
            color: DS.colors.textTertiary,
            cursor: "pointer",
            flexShrink: 0,
          }}
          title="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
};
