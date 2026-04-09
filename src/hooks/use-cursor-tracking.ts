/**
 * Cursor Tracking Hook
 *
 * Tracks the system cursor and applies spring physics to the buddy's
 * position — matching SwiftUI's .spring(response: 0.2, dampingFraction: 0.6).
 *
 * - Electron: main process pushes raw cursor position via IPC.
 *   We apply the spring HERE in the renderer, then send the smoothed
 *   position back to main to move the window.
 *
 * - Browser: mousemove events → spring simulation → CSS transform.
 *
 * The spring runs on requestAnimationFrame so it's frame-perfect.
 * During flight, the spring is bypassed (bezier engine drives position).
 */

import { useEffect, useRef } from "react";
import { useCursorStore } from "../stores/cursor-store";
import { moveOverlayWindow } from "../lib/move-overlay-window";
import {
  createSpringState,
  springStep,
  CURSOR_SPRING_CONFIG,
  type SpringState,
} from "../lib/spring-physics";
import { DS } from "../lib/design-tokens";
import { isElectronEnvironment } from "../lib/is-electron";

export function useCursorTracking() {
  // Spring state for X and Y — persists across frames
  const springXRef = useRef<SpringState>(createSpringState(0));
  const springYRef = useRef<SpringState>(createSpringState(0));
  const targetXRef = useRef(0);
  const targetYRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    // ── Spring animation loop (runs in both Electron and browser) ──
    function springTick(timestamp: number) {
      if (!mounted) return;

      const store = useCursorStore.getState();

      // Only apply spring when following cursor
      if (store.navigationMode === "following-cursor" && isInitializedRef.current) {
        const dt =
          lastFrameTimeRef.current !== null
            ? Math.min((timestamp - lastFrameTimeRef.current) / 1000, 0.033) // cap at ~30fps min
            : 1 / 60;
        lastFrameTimeRef.current = timestamp;

        const smoothedX = springStep(
          springXRef.current,
          targetXRef.current,
          CURSOR_SPRING_CONFIG,
          dt
        );
        const smoothedY = springStep(
          springYRef.current,
          targetYRef.current,
          CURSOR_SPRING_CONFIG,
          dt
        );

        store.setBuddyPosition({ x: smoothedX, y: smoothedY });

        // In Electron, also move the window with the spring-smoothed position
        moveOverlayWindow(smoothedX, smoothedY);
      } else {
        lastFrameTimeRef.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(springTick);
    }

    animationFrameRef.current = requestAnimationFrame(springTick);

    // ── Electron: raw cursor position from main process ───────
    let unsubscribeElectron: (() => void) | undefined;

    if (isElectronEnvironment()) {
      // Tell main process to stop moving the window directly —
      // we handle it here with spring physics
      window.electronAPI!.setFollowingCursor(false);

      unsubscribeElectron = window.electronAPI!.onCursorPosition((position) => {
        const store = useCursorStore.getState();
        store.setSystemCursorPosition({ x: position.x, y: position.y });

        // Set spring target (the spring loop will smooth toward it)
        const buddyTargetX = position.x + DS.cursorOffset.x;
        const buddyTargetY = position.y + DS.cursorOffset.y;
        targetXRef.current = buddyTargetX;
        targetYRef.current = buddyTargetY;

        // Seed the spring on first cursor event so it doesn't animate from (0,0)
        if (!isInitializedRef.current) {
          springXRef.current = createSpringState(buddyTargetX);
          springYRef.current = createSpringState(buddyTargetY);
          isInitializedRef.current = true;
        }

        // During return flight, check if user moved cursor enough to cancel
        if (
          store.navigationMode === "navigating-to-target" &&
          store.isReturningToCursor &&
          store.cursorPositionAtNavigationStart
        ) {
          const distanceFromStart = Math.hypot(
            position.x - store.cursorPositionAtNavigationStart.x,
            position.y - store.cursorPositionAtNavigationStart.y
          );
          if (distanceFromStart > DS.returnFlightCancelThresholdPx) {
            store.resetToFollowingCursor();
          }
        }
      });
    }

    // ── Browser: mousemove → spring target ────────────────────
    function onMouseMove(event: MouseEvent) {
      const store = useCursorStore.getState();
      store.setSystemCursorPosition({ x: event.clientX, y: event.clientY });

      const buddyTargetX = event.clientX + DS.cursorOffset.x;
      const buddyTargetY = event.clientY + DS.cursorOffset.y;
      targetXRef.current = buddyTargetX;
      targetYRef.current = buddyTargetY;

      // Seed the spring on first move
      if (!isInitializedRef.current) {
        springXRef.current = createSpringState(buddyTargetX);
        springYRef.current = createSpringState(buddyTargetY);
        isInitializedRef.current = true;
      }
    }

    if (!isElectronEnvironment()) {
      window.addEventListener("mousemove", onMouseMove);
    }

    return () => {
      mounted = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      unsubscribeElectron?.();
      if (!isElectronEnvironment()) {
        window.removeEventListener("mousemove", onMouseMove);
      }
    };
  }, []);
}
