// src/hooks/useKeyboardShortcuts.js
import { useEffect } from "react";

/**
 * Keyboard shortcuts for the PlanRunner active session.
 *
 * Bindings:
 *   Space       — toggle lap (Record / Stop)
 *   1-9         — click ZUPT by visible index
 *   Ctrl+Z      — undo last stamp
 *   M           — manual stamp
 *   F           — finish session
 *
 * All bindings are ignored when focus is inside an INPUT, TEXTAREA, or SELECT.
 */
export default function useKeyboardShortcuts({
  enabled,
  onToggleLap,
  onClickZuptByIndex,
  onUndoLast,
  onManual,
  onFinish,
}) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      // Ignore when typing in form fields
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key;

      if (key === " ") {
        e.preventDefault();
        onToggleLap?.();
        return;
      }

      if (e.ctrlKey && (key === "z" || key === "Z")) {
        e.preventDefault();
        onUndoLast?.();
        return;
      }

      // Number keys 1-9 — ZUPT by index (not on numpad with ctrl/alt)
      if (!e.ctrlKey && !e.altKey && !e.metaKey && key >= "1" && key <= "9") {
        e.preventDefault();
        onClickZuptByIndex?.(parseInt(key, 10) - 1);
        return;
      }

      if ((key === "m" || key === "M") && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onManual?.();
        return;
      }

      if ((key === "f" || key === "F") && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onFinish?.();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onToggleLap, onClickZuptByIndex, onUndoLast, onManual, onFinish]);
}
