"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from "react";
import "pdfjs-dist/web/pdf_viewer.css";

interface Props {
  url: string;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 5;

export default function PdfViewer({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerElRef = useRef<HTMLDivElement>(null);

  const pdfjsRef = useRef<any>(null);
  const pdfViewerRef = useRef<any>(null);
  const eventBusRef = useRef<any>(null);
  const docRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scalePct, setScalePct] = useState(100);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [searching, setSearching] = useState(false);
  const [printing, setPrinting] = useState(false);

  // ---- Initialize Mozilla's PDFViewer component ----
  useEffect(() => {
    let cancelled = false;
    let loadingTask: any = null;
    setLoading(true);
    setError(null);
    setMatches({ current: 0, total: 0 });

    (async () => {
      try {
        const [pdfjsLib, viewerMod] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/web/pdf_viewer.mjs"),
        ]);
        // Worker served locally (avoids CDN/CORS failures)
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        pdfjsRef.current = pdfjsLib;

        if (cancelled || !containerRef.current || !viewerElRef.current) return;

        const { EventBus, PDFViewer, PDFFindController, PDFLinkService } = viewerMod as any;

        const eventBus = new EventBus();
        const linkService = new PDFLinkService({ eventBus });
        const findController = new PDFFindController({ eventBus, linkService });

        const pdfViewer = new PDFViewer({
          container: containerRef.current,
          viewer: viewerElRef.current,
          eventBus,
          linkService,
          findController,
          textLayerMode: 2, // enable text layer (needed for search highlight + selection)
        });
        linkService.setViewer(pdfViewer);

        eventBusRef.current = eventBus;
        pdfViewerRef.current = pdfViewer;

        eventBus.on("pagesinit", () => {
          // Fit page to width on first load
          pdfViewer.currentScaleValue = "page-width";
          setScalePct(Math.round(pdfViewer.currentScale * 100));
          setLoading(false);
        });

        const onMatches = (e: any) => {
          const c = e?.matchesCount;
          if (c) setMatches({ current: c.current ?? 0, total: c.total ?? 0 });
          else setMatches({ current: 0, total: 0 });
          setSearching(false);
        };
        eventBus.on("updatefindmatchescount", onMatches);
        eventBus.on("updatefindcontrolstate", onMatches);

        loadingTask = pdfjsLib.getDocument({
          url,
          cMapUrl: "/cmaps/",
          cMapPacked: true,
        });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        docRef.current = doc;
        pdfViewer.setDocument(doc);
        linkService.setDocument(doc, null);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[PdfViewer] error:", err);
        setError(`PDF를 불러오지 못했습니다: ${err?.message ?? String(err)}`);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try { loadingTask?.destroy?.(); } catch {}
      try { docRef.current?.destroy?.(); } catch {}
      docRef.current = null;
      pdfViewerRef.current = null;
      eventBusRef.current = null;
    };
  }, [url]);

  // ---- Zoom ----
  const applyScale = useCallback((next: number) => {
    const v = pdfViewerRef.current;
    if (!v) return;
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    v.currentScaleValue = String(clamped);
    setScalePct(Math.round(v.currentScale * 100));
  }, []);

  const zoomIn = useCallback(() => {
    const v = pdfViewerRef.current;
    if (v) applyScale(v.currentScale * 1.15);
  }, [applyScale]);
  const zoomOut = useCallback(() => {
    const v = pdfViewerRef.current;
    if (v) applyScale(v.currentScale / 1.15);
  }, [applyScale]);
  const fitWidth = useCallback(() => {
    const v = pdfViewerRef.current;
    if (!v) return;
    v.currentScaleValue = "page-width";
    setScalePct(Math.round(v.currentScale * 100));
  }, []);

  // Ctrl/Cmd + wheel zoom on desktop
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const v = pdfViewerRef.current;
      if (!v) return;
      applyScale(v.currentScale * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyScale]);

  // Pinch-to-zoom on mobile
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startDist = 0;
    let startScale = 1;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startScale = pdfViewerRef.current?.currentScale ?? 1;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        applyScale(startScale * (dist(e.touches) / startDist));
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
  }, [applyScale]);

  // ---- Search (highlights matches on the page via PDFFindController) ----
  const runFind = useCallback((again: boolean, findPrevious: boolean) => {
    const bus = eventBusRef.current;
    if (!bus) return;
    const q = query.trim();
    if (!q) {
      bus.dispatch("findbarclose", { source: null });
      setMatches({ current: 0, total: 0 });
      return;
    }
    setSearching(true);
    bus.dispatch("find", {
      type: again ? "again" : "",
      query: q,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious,
    });
  }, [query]);

  const onSearchSubmit = useCallback(() => runFind(false, false), [runFind]);
  const findNext = useCallback(() => runFind(true, false), [runFind]);
  const findPrev = useCallback(() => runFind(true, true), [runFind]);

  // ---- Print: render every page to canvas, print without downloading ----
  const handlePrint = useCallback(async () => {
    const doc = docRef.current;
    if (!doc || printing) return;
    setPrinting(true);
    const container = document.createElement("div");
    container.id = "pdfjs-print-container";
    try {
      const PRINT_SCALE = 2; // ~150–200 DPI for crisp print
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: PRINT_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport, intent: "print" } as any).promise;
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
      // Safety cleanup if afterprint never fires
      setTimeout(() => { if (document.body.contains(container)) cleanup(); }, 120_000);
    } catch (e) {
      console.error("[PdfViewer] print error:", e);
      if (container.parentNode) container.remove();
      setPrinting(false);
    }
  }, [printing]);

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 flex-wrap gap-y-1.5">
        {/* Search */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) findPrev();
                  else if (matches.total > 0) findNext();
                  else onSearchSubmit();
                }
              }}
              placeholder="문서 내 검색…"
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 placeholder-gray-400"
            />
          </div>
          <button
            onClick={onSearchSubmit}
            className="px-2.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            {searching ? "검색…" : "검색"}
          </button>
          {query.trim() && (
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
              {matches.total > 0 ? `${matches.current}/${matches.total}` : "0"}
            </span>
          )}
          {matches.total > 0 && (
            <div className="flex items-center gap-0.5">
              <button onClick={findPrev} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" title="이전">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
              </button>
              <button onClick={findNext} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" title="다음">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>
          )}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300" title="축소">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
          </button>
          <button onClick={fitWidth} className="text-xs text-gray-500 dark:text-gray-400 w-12 text-center tabular-nums hover:text-blue-600 dark:hover:text-blue-400" title="너비 맞춤">
            {scalePct}%
          </button>
          <button onClick={zoomIn} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300" title="확대">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

        {/* Print */}
        <button
          onClick={handlePrint}
          disabled={printing || loading || !!error}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 transition-colors whitespace-nowrap"
          title="인쇄 (다운로드 없이)"
        >
          {printing ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          )}
          {printing ? "준비 중…" : "인쇄"}
        </button>
      </div>

      {/* Viewer surface */}
      <div className="relative flex-1 min-h-0">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">PDF 불러오는 중…</span>
            <span className="text-xs text-gray-400 dark:text-gray-600">대용량 파일은 잠시 기다려주세요</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 bg-gray-100 dark:bg-gray-800">
            <svg className="w-10 h-10 text-red-400 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm text-red-500 dark:text-red-300 text-center max-w-xs">{error}</p>
          </div>
        )}
        {/* PDFViewer needs an absolutely-positioned scroll container */}
        <div ref={containerRef} className="pdfViewerContainer absolute inset-0 overflow-auto">
          <div ref={viewerElRef} className="pdfViewer" />
        </div>
      </div>
    </div>
  );
}
