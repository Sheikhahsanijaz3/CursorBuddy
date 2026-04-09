/**
 * Overlay Viewport
 *
 * A compact container (320×80) that follows the buddy around the screen.
 * Child components render at FIXED LOCAL positions within it — the
 * viewport itself moves to place them at the correct screen location.
 *
 * - Electron mode: the viewport IS the window. moveOverlayWindow() sets
 *   the Electron window.setPosition() imperatively at ~60fps (no React in the loop).
 * - Browser mode: a CSS-transformed div mimics the moving window.
 *   Position updates bypass React entirely via store subscription + ref.
 */

import React, { useRef, useEffect } from "react";
import { useCursorStore } from "../stores/cursor-store";
import { DS } from "../lib/design-tokens";
import { isElectronEnvironment } from "../lib/is-electron";

export const OverlayViewport: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // In Electron, the window is positioned by the main process — no need
  // to subscribe to buddyPosition at all.
  const isElectron = isElectronEnvironment();

  // Browser mode: subscribe to buddyPosition and update CSS transform
  // directly on the DOM node, bypassing React re-renders entirely.
  useEffect(() => {
    if (isElectron) return;
    const unsub = useCursorStore.subscribe((state) => {
      if (containerRef.current) {
        const x = state.buddyPosition.x - DS.viewport.localBuddyX;
        const y = state.buddyPosition.y - DS.viewport.localBuddyY;
        containerRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    });
    // Set initial position
    const { buddyPosition } = useCursorStore.getState();
    if (containerRef.current) {
      const x = buddyPosition.x - DS.viewport.localBuddyX;
      const y = buddyPosition.y - DS.viewport.localBuddyY;
      containerRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
    return unsub;
  }, [isElectron]);

  if (isElectron) {
    return (
      <div
        style={{
          position: "relative",
          width: DS.viewport.width,
          height: DS.viewport.height,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: DS.viewport.width,
        height: DS.viewport.height,
        willChange: "transform",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {children}
    </div>
  );
};
