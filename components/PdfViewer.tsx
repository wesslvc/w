"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  url: string;
}

const SCALE_STEP = 0.15;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const DEFAULT_SCALE = 1.4;

export default function PdfViewer({ url }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [rendered, setRendered] = useState(0);

  const pdfDocRef = useRef<any>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(DEFAULT_SCALE);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNumPages(0);
    setRendered(0);
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

        if (cancelled) { (doc as any).destroy?.(); return; }

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

  // Render a single page onto its canvas
  const renderPage = useCallback(async (pageNum: number, targetScale: number) => {
    const doc = pdfDocRef.current;
    const canvas = canvasRefs.current.get(pageNum);
    if (!doc || !canvas) return;

    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: targetScale });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await page.render({ canvasContext: ctx, viewport }).promise;
      setRendered((n) => n + 1);
    } catch (err) {
      console.error(`[PdfViewer] render page ${pageNum} error:`, err);
    }
  }, []);

  const renderAll = useCallback((targetScale: number) => {
    setRendered(0);
    const doc = pdfDocRef.current;
    if (!doc) return;
    for (let i = 1; i <= doc.numPages; i++) {
      renderPage(i, targetScale);
    }
  }, [renderPage]);

  // Render pages once canvases are mounted (after numPages is set)
  useEffect(() => {
    if (numPages > 0) {
      const id = setTimeout(() => renderAll(scaleRef.current), 80);
      return () => clearTimeout(id);
    }
  }, [numPages, renderAll]);

  const changeScale = useCallback((next: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    scaleRef.current = clamped;
    setScale(clamped);
    renderAll(clamped);
  }, [renderAll]);

  // Ctrl+wheel zoom (desktop)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      changeScale(scaleRef.current + (e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [changeScale]);

  // Pinch-to-zoom (mobile)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startDist = 0;
    let startScale = DEFAULT_SCALE;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startScale = scaleRef.current;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        changeScale(startScale * (dist(e.touches) / startDist));
      }
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

  // Print: render all pages at high DPI and send to printer
  const handlePrint = useCallback(async () => {
    const doc = pdfDocRef.current;
    if (!doc || printing) return;
    setPrinting(true);
    const container = document.createElement("div");
    container.id = "pdfjs-print-container";
    try {
      const PRINT_SCALE = 2;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: PRINT_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const wrap = document.createElement("div");
        wrap.className = "pdfjs-print-page";
        canvas.style.width = "100%";
        canvas.style.display = "block";
        wrap.appendChild(canvas);
        container.appendChild(wrap);
      }
      document.body.appendChild(container);
      const cleanup = () => {
        if (container.parentNode) container.remove();
        setPrinting(false);
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      window.print();
      setTimeout(() => { if (document.body.contains(container)) cleanup(); }, 120_000);
    } catch (e) {
      console.error("[PdfViewer] print error:", e);
      if (container.parentNode) container.remove();
      setPrinting(false);
    }
  }, [printing]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 flex-wrap gap-y-1.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => changeScale(scale - SCALE_STEP)}
            disabled={loading || !!error}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40"
            title="축소"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-center tabular-nums select-none">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => changeScale(scale + SCALE_STEP)}
            disabled={loading || !!error}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40"
            title="확대"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

        {numPages > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-600 tabular-nums select-none">
            {numPages}페이지
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={handlePrint}
          disabled={loading || !!error || printing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 transition-colors whitespace-nowrap"
          title="인쇄 (다운로드 없이)"
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

      {/* Pages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto bg-gray-300 dark:bg-gray-700"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-gray-500 dark:text-gray-400">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">PDF 불러오는 중…</span>
            <span className="text-xs opacity-60">대용량 파일은 잠시 기다려주세요</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 px-6">
            <svg className="w-10 h-10 text-red-400 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm text-red-500 dark:text-red-300 text-center max-w-xs">{error}</p>
          </div>
        )}

        {!loading && !error && numPages > 0 && (
          <div className="flex flex-col items-center py-4 gap-3">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                className="shadow-lg bg-white"
                style={{ lineHeight: 0 }}
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(pageNum, el);
                    else canvasRefs.current.delete(pageNum);
                  }}
                  style={{ display: "block" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
