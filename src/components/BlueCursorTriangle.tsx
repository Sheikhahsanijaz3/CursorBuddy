/**
 * Blue Cursor Triangle
 *
 * The buddy's signature blue triangle. Shape matches the Swift
 * Triangle exactly — equilateral using sqrt(3)/2 height.
 *
 * Rotation, scale, and glow animate via ref-based store subscription
 * to avoid React re-renders on every animation frame.
 */

import React, { useRef, useEffect, useMemo } from "react";
import { useCursorStore } from "../stores/cursor-store";
import { DS } from "../lib/design-tokens";
import { runtimeConfig } from "../lib/runtime-config";
import { useRuntimeConfig } from "../hooks/use-runtime-config";

export const BlueCursorTriangle: React.FC = () => {
  const voiceState = useCursorStore((s) => s.voiceState);
  const cursorOpacity = useCursorStore((s) => s.cursorOpacity);

  // Re-render when runtime config changes (color, size, glow)
  useRuntimeConfig();

  const color = runtimeConfig.cursorColor;
  const size = runtimeConfig.cursorSize;
  const isVisible = voiceState === "idle" || voiceState === "responding";

  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize triangle point computation keyed on cursorSize
  const pts = useMemo(() => {
    const half = size / 2;
    const triH = size * Math.sqrt(3) / 2;
    const topY = half - triH / 1.5;
    const botY = half + triH / 3;
    return `${half},${topY.toFixed(1)} 0,${botY.toFixed(1)} ${size},${botY.toFixed(1)}`;
  }, [size]);

  // Subscribe to rotation + scale and update via ref (no React re-renders)
  useEffect(() => {
    const unsub = useCursorStore.subscribe((state) => {
      if (!containerRef.current) return;
      const rot = state.triangleRotationDegrees;
      const scale = state.buddyFlightScale;
      containerRef.current.style.transform = `rotate(${rot}deg) scale(${scale})`;
      const glowRadius = runtimeConfig.glowIntensity + (scale - 1.0) * 20;
      containerRef.current.style.filter = `drop-shadow(0 0 ${glowRadius}px ${runtimeConfig.cursorColor})`;
    });
    // Set initial values
    const { triangleRotationDegrees: rot, buddyFlightScale: scale } = useCursorStore.getState();
    if (containerRef.current) {
      containerRef.current.style.transform = `rotate(${rot}deg) scale(${scale})`;
      const glowRadius = runtimeConfig.glowIntensity + (scale - 1.0) * 20;
      containerRef.current.style.filter = `drop-shadow(0 0 ${glowRadius}px ${runtimeConfig.cursorColor})`;
    }
    return unsub;
  }, []);

  const localX = DS.viewport.localBuddyX;
  const localY = DS.viewport.localBuddyY;
  const half = size / 2;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        left: localX - half,
        top: localY - half,
        opacity: isVisible ? cursorOpacity : 0,
        transition: "opacity 0.25s ease-in",
        willChange: "transform, opacity",
        pointerEvents: "none",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <polygon points={pts} fill={color} />
      </svg>
    </div>
  );
};
