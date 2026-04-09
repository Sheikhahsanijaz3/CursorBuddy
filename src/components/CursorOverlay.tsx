/**
 * Cursor Overlay
 *
 * Root component for the compact buddy overlay. Wraps all visuals
 * in an OverlayViewport that moves to follow the cursor.
 *
 * The viewport is a small transparent popover (320×80). Child
 * components render at fixed local positions within it. The viewport
 * itself moves via Tauri window.setPosition() or CSS transforms.
 *
 * External systems drive it through the event bus:
 *   - "cursor:fly-to" → flight to a screen element
 *   - "cursor:set-voice-state" → triangle/waveform/spinner
 *   - "voice:audio-level" → waveform reactivity
 *   - "cursor:show" / "cursor:hide" → visibility
 */

import React, { useEffect } from "react";
import { useCursorTracking } from "../hooks/use-cursor-tracking";
import { useBuddyNavigation } from "../hooks/use-buddy-navigation";
import { useCursorStore } from "../stores/cursor-store";
import { eventBus } from "../events/event-bus";
import { OverlayViewport } from "./OverlayViewport";
import { BlueCursorTriangle } from "./BlueCursorTriangle";
import { BlueCursorWaveform } from "./BlueCursorWaveform";
import { BlueCursorSpinner } from "./BlueCursorSpinner";
import { NavigationBubble } from "./NavigationBubble";
import { setScreenBounds } from "../lib/viewport-bounds";

export const CursorOverlay: React.FC = () => {
  useCursorTracking();
  useBuddyNavigation();

  const isOverlayVisible = useCursorStore((s) => s.isOverlayVisible);
  const setVoiceState = useCursorStore((s) => s.setVoiceState);
  const setAudioLevel = useCursorStore((s) => s.setAudioLevel);
  const setIsOverlayVisible = useCursorStore((s) => s.setIsOverlayVisible);
  const setNavigationBubbleText = useCursorStore((s) => s.setNavigationBubbleText);
  const setNavigationBubbleOpacity = useCursorStore((s) => s.setNavigationBubbleOpacity);
  const setNavigationBubbleScale = useCursorStore((s) => s.setNavigationBubbleScale);

  // ── Wire event bus to store ─────────────────────────────────
  useEffect(() => {
    const handleVoiceState = (payload: {
      state: "idle" | "listening" | "processing" | "responding";
    }) => {
      setVoiceState(payload.state);
    };

    const handleAudioLevel = (payload: { level: number }) => {
      setAudioLevel(payload.level);
    };

    const handleShow = () => setIsOverlayVisible(true);
    const handleHide = () => setIsOverlayVisible(false);

    const handleBubbleText = (payload: { text: string }) => {
      if (payload.text) {
        setNavigationBubbleText(payload.text);
        setNavigationBubbleOpacity(1.0);
        setNavigationBubbleScale(1.0);
      } else {
        setNavigationBubbleOpacity(0);
        setNavigationBubbleScale(0.5);
        setTimeout(() => setNavigationBubbleText(""), 200);
      }
    };

    eventBus.on("cursor:set-voice-state", handleVoiceState);
    eventBus.on("voice:audio-level", handleAudioLevel);
    eventBus.on("cursor:show", handleShow);
    eventBus.on("cursor:hide", handleHide);
    eventBus.on("cursor:set-bubble-text", handleBubbleText);

    return () => {
      eventBus.off("cursor:set-voice-state", handleVoiceState);
      eventBus.off("voice:audio-level", handleAudioLevel);
      eventBus.off("cursor:show", handleShow);
      eventBus.off("cursor:hide", handleHide);
      eventBus.off("cursor:set-bubble-text", handleBubbleText);
    };
  }, [setVoiceState, setAudioLevel, setIsOverlayVisible, setNavigationBubbleText, setNavigationBubbleOpacity, setNavigationBubbleScale]);

  // ── Relay panel commands to event bus (Electron only) ───────
  useEffect(() => {
    if (!window.electronAPI?.onOverlayCommand) return;

    const unsubscribe = window.electronAPI.onOverlayCommand(
      (command: string, payload: Record<string, unknown>) => {
        eventBus.emit(command as any, payload);
      }
    );

    return unsubscribe;
  }, []);

  // ── Sync screen bounds from Electron main process ──────────
  useEffect(() => {
    if (!window.electronAPI) return;

    // Get initial bounds
    window.electronAPI.getScreenBounds().then(setScreenBounds);

    // Listen for display changes
    const unsubscribe = window.electronAPI.onScreenBounds(setScreenBounds);
    return unsubscribe;
  }, []);

  // ── Push-to-Talk mic capture (overlay is always alive) ────
  // When PTT starts, capture mic audio and send PCM16 to main
  // process for STT. This works even when the panel is closed.
  useEffect(() => {
    if (!window.electronAPI?.onPushToTalk) return;

    let audioContext: AudioContext | null = null;
    let mediaStream: MediaStream | null = null;
    let scriptProcessor: ScriptProcessorNode | null = null;

    const startMicCapture = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: 16000 },
        });
        audioContext = new AudioContext({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(mediaStream);
        // ScriptProcessorNode for PCM16 extraction + audio level
        scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        scriptProcessor.onaudioprocess = (event) => {
          const float32 = event.inputBuffer.getChannelData(0);
          // Convert Float32 → Int16 PCM
          const pcm16 = new Int16Array(float32.length);
          let sum = 0;
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            sum += float32[i] * float32[i];
          }
          window.electronAPI!.sendAudio(pcm16.buffer);
          // Drive the waveform visualization directly via event bus
          const rms = Math.sqrt(sum / float32.length);
          const level = Math.min(Math.max(rms * 10, 0), 1);
          eventBus.emit("voice:audio-level", { level });
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
      } catch (err) {
        console.error("[PTT Overlay] Mic capture failed:", err);
      }
    };

    const stopMicCapture = () => {
      if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor = null;
      }
      if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
        mediaStream = null;
      }
      eventBus.emit("voice:audio-level", { level: 0 });
    };

    const unsubscribe = window.electronAPI.onPushToTalk((action: string) => {
      if (action === "start") {
        startMicCapture();
      } else if (action === "stop") {
        stopMicCapture();
      }
    });

    return () => {
      unsubscribe();
      stopMicCapture();
    };
  }, []);

  if (!isOverlayVisible) return null;

  return (
    <OverlayViewport>
      {/* All three visual states stay mounted and cross-fade via opacity
          so React doesn't unmount/remount them (which causes a visible pop) */}
      <BlueCursorTriangle />
      <BlueCursorWaveform />
      <BlueCursorSpinner />
      <NavigationBubble />
    </OverlayViewport>
  );
};
