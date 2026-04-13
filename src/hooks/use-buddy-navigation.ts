/**
 * Buddy Navigation Hook
 *
 * Orchestrates the full flight sequence:
 *   1. Listen for "cursor:fly-to" events
 *   2. Fly the buddy along a bezier arc to the target
 *   3. Show a speech bubble with character streaming
 *   4. Hold for 3 seconds
 *   5. Fly back to the cursor
 *   6. Resume cursor following
 *
 * Ported from OverlayWindow.swift's startNavigatingToElement,
 * animateBezierFlightArc, startPointingAtElement, startFlyingBackToCursor.
 */

import { useEffect, useRef, useCallback } from "react";
import { useCursorStore, type FlyToTarget } from "../stores/cursor-store";
import { eventBus } from "../events/event-bus";
import { startBezierFlight } from "../lib/bezier-flight";
import { moveOverlayWindow, setFollowingCursor } from "../lib/move-overlay-window";
import { DS } from "../lib/design-tokens";

export function useBuddyNavigation() {
  const cancelFlightRef = useRef<(() => void) | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startReturnFlightRef = useRef<() => void>(() => {});

  /** Cancel any in-progress animation and clean up timers */
  const cancelEverything = useCallback(() => {
    cancelFlightRef.current?.();
    cancelFlightRef.current = null;
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    holdTimeoutRef.current = null;
    streamTimeoutRef.current = null;
  }, []);

  /** Stream text into the speech bubble character by character */
  const streamBubbleText = useCallback(
    (phrase: string, charIndex: number, onComplete: () => void) => {
      if (charIndex >= phrase.length) {
        onComplete();
        return;
      }

      useCursorStore.getState().setNavigationBubbleText(phrase.slice(0, charIndex + 1));

      // Trigger scale-bounce on first character
      if (charIndex === 0) {
        useCursorStore.getState().setNavigationBubbleScale(1.0);
      }

      const delay =
        DS.bubbleStreamDelayRange.min +
        Math.random() *
          (DS.bubbleStreamDelayRange.max - DS.bubbleStreamDelayRange.min);

      streamTimeoutRef.current = setTimeout(() => {
        streamBubbleText(phrase, charIndex + 1, onComplete);
      }, delay);
    },
    []
  );

  /** Phase 3: Start pointing — show bubble, then schedule return flight */
  const startPointing = useCallback(
    (bubbleText?: string) => {
      const store = useCursorStore.getState();
      store.setNavigationMode("pointing-at-target");
      store.setTriangleRotationDegrees(DS.defaultTriangleRotation);

      // Reset bubble for scale-bounce entrance
      store.setNavigationBubbleText("");
      store.setNavigationBubbleOpacity(1.0);
      store.setNavigationBubbleScale(0.5);

      const phrase =
        bubbleText ??
        DS.pointerPhrases[Math.floor(Math.random() * DS.pointerPhrases.length)];

      streamBubbleText(phrase, 0, () => {
        const MAX_WAIT_MS = 30000;
        const waitStart = Date.now();
        const scheduleReturn = () => {
          holdTimeoutRef.current = setTimeout(() => {
            const currentState = useCursorStore.getState();
            if (currentState.navigationMode !== "pointing-at-target") return;
            if (currentState.selectionChipsVisible && Date.now() - waitStart < MAX_WAIT_MS) {
              scheduleReturn();
              return;
            }

            useCursorStore.getState().setNavigationBubbleOpacity(0);

            // Wait for fade out, then start return flight
            holdTimeoutRef.current = setTimeout(() => {
              const stillPointing =
                useCursorStore.getState().navigationMode === "pointing-at-target";
              if (!stillPointing) return;
              startReturnFlightRef.current();
            }, 500);
          }, DS.pointingHoldDurationMs);
        };

        scheduleReturn();
      });

      eventBus.emit("cursor:arrived");
    },
    [streamBubbleText]
  );

  /** Phase 4: Fly back to cursor position */
  const startReturnFlight = useCallback(() => {
    const state = useCursorStore.getState();
    const currentCursorPos = state.systemCursorPosition;
    const currentBuddyPos = state.buddyPosition;

    const destination = {
      x: currentCursorPos.x + DS.cursorOffset.x,
      y: currentCursorPos.y + DS.cursorOffset.y,
    };

    state.setNavigationMode("navigating-to-target");
    state.setIsReturningToCursor(true);
    state.setCursorPositionAtNavigationStart({ ...currentCursorPos });

    // Renderer keeps control of window position for return flight
    setFollowingCursor(false);

    cancelFlightRef.current = startBezierFlight({
      from: currentBuddyPos,
      to: destination,
      onFrame: (frame) => {
        useCursorStore.getState().setFlightFrame(frame.position, frame.rotationDegrees, frame.scale);
        // Move the overlay window along the return flight arc
        moveOverlayWindow(frame.position.x, frame.position.y);
      },
      onComplete: () => {
        // Main process resumes cursor-following
        setFollowingCursor(true);
        useCursorStore.getState().resetToFollowingCursor();
        eventBus.emit("cursor:returned");
      },
    });
  }, []);

  // Keep the ref in sync so startPointing always calls the latest version
  startReturnFlightRef.current = startReturnFlight;

  /** Phase 1: Fly to target element */
  const flyToElement = useCallback(
    (target: FlyToTarget) => {
      cancelEverything();

      const state = useCursorStore.getState();
      const currentBuddyPos = state.buddyPosition;
      const currentCursorPos = state.systemCursorPosition;

      // Offset target so buddy sits beside the element, not on top
      const destination = {
        x: target.x + 8,
        y: target.y + 12,
      };

      state.setCursorPositionAtNavigationStart({ ...currentCursorPos });
      state.setNavigationMode("navigating-to-target");
      state.setIsReturningToCursor(false);

      // Renderer takes control of window position during flight
      setFollowingCursor(false);

      cancelFlightRef.current = startBezierFlight({
        from: currentBuddyPos,
        to: destination,
        onFrame: (frame) => {
          useCursorStore.getState().setFlightFrame(frame.position, frame.rotationDegrees, frame.scale);
          // Move the overlay window along the flight arc (no-op in browser)
          moveOverlayWindow(frame.position.x, frame.position.y);
        },
        onComplete: () => {
          const currentMode = useCursorStore.getState().navigationMode;
          if (currentMode !== "navigating-to-target") return;
          startPointing(target.bubbleText);
        },
      });
    },
    [cancelEverything, startPointing]
  );

  // ── Wire up event bus ───────────────────────────────────────
  useEffect(() => {
    const handleFlyTo = (payload: {
      x: number;
      y: number;
      label: string;
      bubbleText?: string;
    }) => {
      flyToElement({
        x: payload.x,
        y: payload.y,
        label: payload.label,
        bubbleText: payload.bubbleText,
      });
    };

    eventBus.on("cursor:fly-to", handleFlyTo);

    return () => {
      eventBus.off("cursor:fly-to", handleFlyTo);
      cancelEverything();
      setFollowingCursor(true);
    };
  }, [flyToElement, cancelEverything]);
}
