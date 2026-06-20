"use client";
import { useRef, useState, useCallback, useEffect, ReactNode } from "react";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const WHEEL_STEP = 0.12;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// Keep content from drifting completely off-screen.
// With transform: scale(z) translate(tx,ty) + origin:center,
// net screen offset of center = (tx*z, ty*z), so max tx = W*(z-1)/(2z).
function clampPan(tx: number, ty: number, z: number, el: HTMLElement | null) {
  if (!el || z <= 1) return { x: 0, y: 0 };
  const maxX = (el.offsetWidth * (z - 1)) / (2 * z);
  const maxY = (el.offsetHeight * (z - 1)) / (2 * z);
  return { x: clamp(tx, -maxX, maxX), y: clamp(ty, -maxY, maxY) };
}

interface Props {
  children: ReactNode;
}

export default function ZoomPanViewer({ children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);
  const lastTouchMid = useRef({ x: 0, y: 0 });
  // Keep pan/zoom accessible in event handlers without stale closures
  const stateRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  stateRef.current = { zoom, pan };

  // Re-clamp pan whenever zoom changes
  useEffect(() => {
    if (zoom <= 1) {
      setPan({ x: 0, y: 0 });
    } else {
      setPan((p) => clampPan(p.x, p.y, zoom, containerRef.current));
    }
  }, [zoom]);

  // Wheel zoom — must be non-passive to call preventDefault
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP;
    setZoom((z) => clamp(parseFloat((z + delta).toFixed(3)), MIN_ZOOM, MAX_ZOOM));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Mouse pan
  function onMouseDown(e: React.MouseEvent) {
    if (stateRef.current.zoom <= 1) return;
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return;
    const z = stateRef.current.zoom;
    const dx = (e.clientX - lastMouse.current.x) / z;
    const dy = (e.clientY - lastMouse.current.y) / z;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan((p) => clampPan(p.x + dx, p.y + dy, z, containerRef.current));
  }
  function onMouseUp() { dragging.current = false; }

  // Touch pinch + pan
  function onTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      lastPinchDist.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      lastTouchMid.current = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    } else if (e.touches.length === 1) {
      lastTouchMid.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    const z = stateRef.current.zoom;
    if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const scale = dist / lastPinchDist.current;
      lastPinchDist.current = dist;
      setZoom((cur) => clamp(parseFloat((cur * scale).toFixed(4)), MIN_ZOOM, MAX_ZOOM));
      // Also handle pan from pinch mid-point movement
      const mid = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      const dx = (mid.x - lastTouchMid.current.x) / z;
      const dy = (mid.y - lastTouchMid.current.y) / z;
      lastTouchMid.current = mid;
      setPan((p) => clampPan(p.x + dx, p.y + dy, z, containerRef.current));
    } else if (e.touches.length === 1) {
      if (z <= 1) return;
      const dx = (e.touches[0].clientX - lastTouchMid.current.x) / z;
      const dy = (e.touches[0].clientY - lastTouchMid.current.y) / z;
      lastTouchMid.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setPan((p) => clampPan(p.x + dx, p.y + dy, z, containerRef.current));
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) lastPinchDist.current = null;
    if (e.touches.length === 1) {
      lastTouchMid.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }
  function zoomBy(delta: number) {
    setZoom((z) => clamp(parseFloat((z + delta).toFixed(3)), MIN_ZOOM, MAX_ZOOM));
  }

  const cursor = zoom > 1 ? (dragging.current ? "grabbing" : "grab") : "default";

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none touch-none"
    >
      {/* Scaled+panned content */}
      <div
        className="w-full h-full"
        style={{
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        {children}
      </div>

      {/* Overlay: captures pointer events so the iframe doesn't swallow them */}
      <div
        className="absolute inset-0 z-10"
        style={{ cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />

      {/* Floating zoom controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-black/55 backdrop-blur-sm rounded-lg px-1.5 py-1 text-white shadow-lg">
        <button
          onClick={() => zoomBy(-WHEEL_STEP * 2)}
          className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded text-lg font-light"
          title="축소"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="min-w-[3rem] text-xs text-center tabular-nums hover:bg-white/20 rounded px-1 py-0.5"
          title="배율 초기화"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => zoomBy(WHEEL_STEP * 2)}
          className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded text-lg font-light"
          title="확대"
        >
          +
        </button>
      </div>
    </div>
  );
}
