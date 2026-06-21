"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  url: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const INIT_SCALE = 1.2;

// ─── Single-page renderer ──────────────────────────────────────────────────
function PdfPage({
  pdf,
  pageNum,
  scale,
  onVisible,
}: {
  pdf: any;
  pageNum: number;
  scale: number;
  onVisible?: (n: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Render whenever pdf doc or scale changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport } as any).promise;
      } catch (e) {
        if (!cancelled) console.error(`[PdfViewer] page ${pageNum} error:`, e);
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, pageNum, scale]);

  // Report current visible page to parent
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !onVisible) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible(pageNum); },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [pageNum, onVisible]);

  return (
    <div ref={wrapRef} style={{ lineHeight: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", background: "#fff", maxWidth: "100%" }}
      />
    </div>
  );
}

// ─── Main viewer ──────────────────────────────────────────────────────────
export default function PdfViewer({ url }: Props) {
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(INIT_SCALE);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const scaleRef = useRef(INIT_SCALE);
  const pdfRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ── Load PDF ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setNumPages(0);
    setCurrentPage(1);
    setLoading(true);
    setError(null);
    if (pdfRef.current) {
      try { pdfRef.current.destroy(); } catch {}
      pdfRef.current = null;
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
        pdfRef.current = doc;
        setPdf(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[PdfViewer] load error:", err);
        setError(err?.message ?? String(err));
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  // ── Scale ────────────────────────────────────────────────────────────────
  const changeScale = useCallback((next: number) => {
    const c = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    scaleRef.current = c;
    setScale(c);
  }, []);

  // Ctrl+wheel zoom (desktop)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      changeScale(scaleRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [changeScale]);

  // Pinch-to-zoom (mobile)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startDist = 0, startScale = INIT_SCALE;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) { startDist = dist(e.touches); startScale = scaleRef.current; }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !startDist) return;
      e.preventDefault();
      changeScale(startScale * dist(e.touches) / startDist);
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

  // ── Page navigation ───────────────────────────────────────────────────────
  const scrollToPage = useCallback((n: number) => {
    const el = pageRefs.current.get(n);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onVisible = useCallback((n: number) => setCurrentPage(n), []);

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = useCallback(async () => {
    const doc = pdfRef.current;
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
        await (page.render({ canvasContext: ctx, viewport } as any)).promise;
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
      container.remove();
      setPrinting(false);
    }
  }, [printing]);

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "60vh", height: "100%" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 flex-wrap gap-y-1">
        {/* Zoom */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => changeScale(scale / 1.2)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40"
            disabled={!pdf}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={() => changeScale(INIT_SCALE)}
            className="text-xs text-gray-500 dark:text-gray-400 w-11 text-center tabular-nums hover:text-blue-600 dark:hover:text-blue-400 select-none"
            disabled={!pdf}
            title="기본 크기"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={() => changeScale(scale * 1.2)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40"
            disabled={!pdf}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* Page navigation */}
        {numPages > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-30"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums select-none whitespace-nowrap">
              {currentPage} / {numPages}
            </span>
            <button
              onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
              disabled={currentPage >= numPages}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-30"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* Print */}
        <button
          onClick={handlePrint}
          disabled={!pdf || printing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 whitespace-nowrap"
        >
          {printing ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          )}
          {printing ? "준비 중…" : "인쇄"}
        </button>
      </div>

      {/* Scroll area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          minHeight: 0,
          background: "#9ca3af",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 text-gray-200 py-20">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">PDF 불러오는 중…</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20">
            <svg className="w-10 h-10 text-red-300 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm text-red-200 text-center max-w-xs">{error}</p>
          </div>
        )}

        {pdf && numPages > 0 && (
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 8px", gap: 8 }}
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                ref={(el) => {
                  if (el) pageRefs.current.set(n, el);
                  else pageRefs.current.delete(n);
                }}
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
              >
                <PdfPage pdf={pdf} pageNum={n} scale={scale} onVisible={onVisible} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile bottom nav */}
      {numPages > 1 && !loading && !error && (
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex-shrink-0 sm:hidden">
          <button
            onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 disabled:opacity-30 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            이전
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 disabled:opacity-30 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            다음
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
