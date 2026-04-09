/**
 * Chat Panel
 *
 * Self-contained chat interface for CursorBuddy. Streams AI responses,
 * renders markdown-ish text, shows tool use blocks, and drives the
 * cursor overlay via the event bus.
 *
 * Driven entirely by events — works in both Electron and web embed.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { eventBus } from "../events/event-bus";
import { parsePointingCoordinates } from "../lib/point-tag-parser";
import { DS } from "../lib/design-tokens";

// ── Types ─────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

// ── Styles (derived from design tokens) ───────────────────

const COLORS = {
  bg: DS.colors.background,
  surface: DS.colors.surface1,
  border: `rgba(59, 130, 246, 0.1)`,
  text: DS.colors.textPrimary,
  dim: DS.colors.textSecondary,
  muted: DS.colors.textTertiary,
  blue: DS.colors.cursorBlue,
  userBubble: "rgba(59, 130, 246, 0.15)",
  assistantBubble: "rgba(255, 255, 255, 0.04)",
  mono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;

/** Blink keyframe for streaming cursor — injected once, not per render */
const BLINK_STYLE_ID = "cursor-buddy-blink";
if (typeof document !== "undefined" && !document.getElementById(BLINK_STYLE_ID)) {
  const style = document.createElement("style");
  style.id = BLINK_STYLE_ID;
  style.textContent = "@keyframes blink { 0%,50% { opacity:1 } 51%,100% { opacity:0 } }";
  document.head.appendChild(style);
}

// ── Component ─────────────────────────────────────────────

export const ChatPanel: React.FC<{ height?: number }> = ({ height }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingTextRef = useRef("");

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  // ── Listen for inference chunks ───────────────────────────
  useEffect(() => {
    if (!window.electronAPI?.onInferenceChunk) return;

    const unsubscribe = window.electronAPI.onInferenceChunk((chunk) => {
      if (chunk.type === "text" && chunk.text) {
        streamingTextRef.current = chunk.text;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: chunk.text! },
            ];
          }
          return prev;
        });
      } else if (chunk.type === "done") {
        const finalText = streamingTextRef.current;
        setIsStreaming(false);

        // Parse POINT tags and trigger cursor flight
        const parsed = parsePointingCoordinates(finalText);
        if (parsed.coordinate) {
          eventBus.emit("cursor:fly-to", {
            x: parsed.coordinate.x,
            y: parsed.coordinate.y,
            label: parsed.elementLabel || "element",
          });
        }

        // Update the last message to not be streaming, with POINT tag stripped
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: parsed.spokenText, isStreaming: false },
            ];
          }
          return prev;
        });

        // TTS
        if (window.electronAPI?.speak && parsed.spokenText.trim()) {
          eventBus.emit("cursor:set-voice-state", { state: "responding" });
          window.electronAPI.speak(parsed.spokenText).then((result) => {
            if (result.ok && result.audioBase64) {
              playAudioBase64(result.audioBase64, result.mimeType || "audio/mpeg");
            }
            eventBus.emit("cursor:set-voice-state", { state: "idle" });
          });
        }

        streamingTextRef.current = "";
      } else if (chunk.type === "error") {
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: `Error: ${chunk.error}`,
            timestamp: Date.now(),
          },
        ]);
      }
    });

    return unsubscribe;
  }, []);

  // ── Listen for STT transcripts ────────────────────────────
  useEffect(() => {
    if (!window.electronAPI?.onTranscript) return;

    const unsubscribe = window.electronAPI.onTranscript((data) => {
      if (data.isFinal && data.text.trim()) {
        sendMessage(data.text.trim());
      }
    });

    return unsubscribe;
  }, []);

  // ── Send message ──────────────────────────────────────────
  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsStreaming(true);
      streamingTextRef.current = "";

      // Set cursor to processing
      eventBus.emit("cursor:set-voice-state", { state: "processing" });

      // Trigger inference via Electron IPC (panel preload exposes runInference)
      window.electronAPI?.runInference?.({ transcript: text.trim() });
    },
    [isStreaming]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: height || "100%",
        fontFamily: COLORS.sans,
        color: COLORS.text,
        fontSize: 13,
      }}
    >
      {/* Message list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: COLORS.muted,
              fontSize: 12,
              textAlign: "center",
              padding: "40px 20px",
              lineHeight: 1.6,
            }}
          >
            Type a message or use push-to-talk
            <br />
            (Ctrl+Alt+Space)
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: "8px 12px 12px",
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            background: COLORS.assistantBubble,
            borderRadius: 12,
            padding: "8px 12px",
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask CursorBuddy..."
            disabled={isStreaming}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: COLORS.text,
              fontFamily: COLORS.sans,
              fontSize: 13,
              lineHeight: 1.5,
              resize: "none",
              minHeight: 20,
              maxHeight: 120,
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim()}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "none",
              background:
                isStreaming || !input.trim()
                  ? COLORS.muted
                  : COLORS.blue,
              color: "#fff",
              cursor:
                isStreaming || !input.trim()
                  ? "default"
                  : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flexShrink: 0,
              transition: "background 0.15s",
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Message Bubble ────────────────────────────────────────

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        width: "100%",
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "8px 12px",
          borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          background: isSystem
            ? "rgba(239, 68, 68, 0.1)"
            : isUser
            ? COLORS.userBubble
            : COLORS.assistantBubble,
          border: isSystem
            ? "1px solid rgba(239, 68, 68, 0.2)"
            : `1px solid ${COLORS.border}`,
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: isSystem ? "#fca5a5" : COLORS.text,
        }}
      >
        {/* Render content with basic code block support */}
        <MessageContent content={message.content} />

        {message.isStreaming && (
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 14,
              background: COLORS.blue,
              borderRadius: 1,
              marginLeft: 2,
              animation: "blink 1s infinite",
              verticalAlign: "text-bottom",
            }}
          />
        )}
      </div>
    </div>
  );
};

// ── Message Content (basic markdown) ──────────────────────

const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const lines = part.slice(3, -3).split("\n");
          const lang = lines[0]?.trim() || "";
          const code = (lang ? lines.slice(1) : lines).join("\n").trim();
          return (
            <pre
              key={i}
              style={{
                background: "rgba(0,0,0,0.3)",
                borderRadius: 6,
                padding: "8px 10px",
                margin: "6px 0",
                fontSize: 11,
                fontFamily: COLORS.mono,
                lineHeight: 1.45,
                overflowX: "auto",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {lang && (
                <div
                  style={{
                    fontSize: 9,
                    color: COLORS.dim,
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {lang}
                </div>
              )}
              <code>{code}</code>
            </pre>
          );
        }

        // Inline code
        return (
          <span key={i}>
            {part.split(/(`[^`]+`)/g).map((seg, j) => {
              if (seg.startsWith("`") && seg.endsWith("`")) {
                return (
                  <code
                    key={j}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      padding: "1px 5px",
                      borderRadius: 3,
                      fontSize: 12,
                      fontFamily: COLORS.mono,
                    }}
                  >
                    {seg.slice(1, -1)}
                  </code>
                );
              }
              // Bold
              return (
                <span key={j}>
                  {seg.split(/(\*\*[^*]+\*\*)/g).map((s, k) => {
                    if (s.startsWith("**") && s.endsWith("**")) {
                      return <strong key={k}>{s.slice(2, -2)}</strong>;
                    }
                    return s;
                  })}
                </span>
              );
            })}
          </span>
        );
      })}

    </>
  );
};

// ── Audio Playback Helper ─────────────────────────────────

function playAudioBase64(base64: string, mimeType: string): void {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(() => {});
  } catch (_) {}
}
