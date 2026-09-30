import { useCallback, useEffect, useRef, useState } from "react";

const DRAG_THRESHOLD = 5;

// Free-drag for fixed-position floating widgets (chat launcher, getting-started
// card) — no drag library in the project fits free-form panel dragging, so this
// is a small hand-rolled pointer-event hook shared by both. Position is tracked
// as right/bottom offsets (matching how these widgets were already positioned)
// and clamped to stay inside the viewport.
//
// Consumers call `startDrag` from a handle's onPointerDown. For handles that
// are also click targets (a launcher button, a collapsed pill), guard the
// onClick with `consumeDragFlag()` so a drag gesture doesn't also fire the
// click. For handles inside a panel that has its own buttons (a header bar),
// skip starting a drag when the pointerdown targets one of those buttons.
export default function useDraggable({ right, bottom }) {
  const [pos, setPos] = useState({ right, bottom });
  const containerRef = useRef(null);
  const gesture = useRef(null);
  const listeners = useRef(null);

  const clamp = useCallback((nextRight, nextBottom) => {
    const el = containerRef.current;
    const width = el ? el.offsetWidth : 0;
    const height = el ? el.offsetHeight : 0;
    const maxRight = Math.max(window.innerWidth - width, 0);
    const maxBottom = Math.max(window.innerHeight - height, 0);
    return {
      right: Math.min(Math.max(nextRight, 0), maxRight),
      bottom: Math.min(Math.max(nextBottom, 0), maxBottom),
    };
  }, []);

  const onPointerMove = useCallback((e) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    g.dragged = true;
    setPos(clamp(g.startRight - dx, g.startBottom - dy));
  }, [clamp]);

  const stopDrag = useCallback(() => {
    if (!listeners.current) return;
    window.removeEventListener("pointermove", listeners.current.move);
    window.removeEventListener("pointerup", listeners.current.up);
    listeners.current = null;
  }, []);

  const startDrag = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return;
    gesture.current = {
      startX: e.clientX, startY: e.clientY,
      startRight: pos.right, startBottom: pos.bottom,
      dragged: false,
    };
    stopDrag();
    const up = () => stopDrag();
    listeners.current = { move: onPointerMove, up };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", up);
  }, [pos, onPointerMove, stopDrag]);

  const consumeDragFlag = useCallback(() => {
    const dragged = !!gesture.current?.dragged;
    if (gesture.current) gesture.current.dragged = false;
    return dragged;
  }, []);

  const reclamp = useCallback(() => {
    setPos((p) => clamp(p.right, p.bottom));
  }, [clamp]);

  useEffect(() => {
    window.addEventListener("resize", reclamp);
    return () => {
      window.removeEventListener("resize", reclamp);
      stopDrag();
    };
  }, [reclamp, stopDrag]);

  return { pos, containerRef, startDrag, consumeDragFlag, reclamp };
}
