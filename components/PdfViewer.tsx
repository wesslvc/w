"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  url: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const DEFAULT_SCALE = 1.2;

export default function PdfViewer({ url }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const pdfDocRef = useRef<any>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(DEFAULT_SCALE);

  // ── Load PDF ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNumPages(0);
    canvasRefs.current.clear();
    if (pdfDocRef.current) {
      try { pdfDocRef.current.destroy(); } catch {}
      pdfDocRef.current = null;
    }

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjsLib.getDocument({
          url,
          cMapUrl: "/cmaps/",
          cMapPacked: true,
        }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[PdfViewer] load error:", err);
        setError(`PDF를 불러오지 못했습니다: ${err?.message ?? String(err)}`);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  // ── Render one page onto its canvas ─────────────────────────
  const renderPage = useCallback(async (pageNum: number, targetScale: number) => {
    const doc = pdfDocRef.current;
    const canvas = canvasRefs.current.get(pageNum);
    if (!doc || !canvas) return;
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: targetScale });
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      await page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      } as any).promise;
    } catch (err) {
      console.error(`[PdfViewer] page ${pageNum} render error:`, err);
    }
  }, []);

  // When canvas mounts, render immediately (no timeout needed)
  const handleCanvasRef = useCallback((el: HTMLCanvasElement | null, pageNum: number) => {
    if (el) {
      canvasRefs.current.set(pageNum, el);
      renderPage(pageNum, scaleRef.current);
    } else {
      canvasRefs.current.delete(pageNum);
    }
  }, [renderPage]);

  // Re-render all pages when scale changes
  const changeScale = useCallback((next: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    scaleRef.current = clamped;
    setScale(clamped);
    const doc = pdfDocRef.current;
    if (!doc) return;
    for (let i = 1; i <= doc.numPages; i++) {
      renderPage(i, clamped);
    }
  }, [renderPage]);

  // ── Ctrl+wheel zoom (desktop) ────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      changeScale(scaleRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [changeScale]);

  // ── Pinch-to-zoom (mobile) ───────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startDist = 0;
    let startScale = DEFAULT_SCALE;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) { startDist = dist(e.touches); startScale = scaleRef.current; }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startDist === 0) return;
      e.preventDefault();
      changeScale(startScale * (dist(e.touches) / startDist));
    };
    const onEnd = () => { startDist = 0; };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [changeScale]);

  // ── Print ────────────────────────────────────────────────────
  const handlePrint = useCallback(async () => {
    const doc = pdfDocRef.current;
    if (!doc || printing) return;
    setPrinting(true);
    const container = document.createElement("div");
    container.id = "pdfjs-print-container";
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport } as any).promise;
        const wrap = document.createElement("div");
        wrap.className = "pdfjs-print-page";
        canvas.style.cssText = "width:100%;display:block;";
        wrap.appendChild(canvas);
        container.appendChild(wrap);
      }
      document.body.appendChild(container);
      const cleanup = () => {
        container.remove();
        setPrinting(false);
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      window.print();
      setTimeout(cleanup, 120_000);
    } catch (e) {
      console.error("[PdfViewer] print error:", e);
      container.remove();
      setPrinting(false);
    }
  }, [printing]);

  // ── UI ───────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <button
          onClick={() => changeScale(scale / 1.15)}
          disabled={loading || !!error}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <button
          onClick={() => changeScale(DEFAULT_SCALE)}
          className="text-xs text-gray-500 dark:text-gray-400 w-12 text-center tabular-nums hover:text-blue-600 dark:hover:text-blue-400 select-none"
          title="기본 크기로"
        >
          {Math.round(scale * 100)}%
        </button>

        <button
          onClick={() => changeScale(scale * 1.15)}
          disabled={loading || !!error}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {numPages > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-600 tabular-nums ml-1 select-none">
            {numPages}p
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={handlePrint}
          disabled={loading || !!error || printing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 whitespace-nowrap"
        >
          {printing ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          )}
          {printing ? "준비 중…" : "인쇄"}
        </button>
      </div>

      {/* Scroll area */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflow: "auto", minHeight: 0, background: "#d1d5db" }}
      >
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12, color: "#6b7280" }}>
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span style={{ fontSize: 14 }}>PDF 불러오는 중…</span>
          </div>
        )}

        {error && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12, padding: "0 24px" }}>
            <p style={{ fontSize: 14, color: "#ef4444", textAlign: "center", maxWidth: 300 }}>{error}</p>
          </div>
        )}

        {!loading && !error && numPages > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 8px", gap: 12 }}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <canvas
                key={pageNum}
                ref={(el) => handleCanvasRef(el, pageNum)}
                style={{
                  display: "block",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  background: "#fff",
                  maxWidth: "100%",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
