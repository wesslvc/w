"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Props {
  url: string;
  /** File size in bytes, when known. Decides the fetch strategy for big files. */
  size?: number;
}

/** Above this size, fetch only the byte ranges needed rather than streaming the
 *  whole document. Range-only costs extra round trips, so smaller files — which
 *  is nearly all of them — still stream straight through. */
const RANGE_ONLY_THRESHOLD = 20 * 1024 * 1024; // 20MB

/** Intrinsic page size at scale 1 (CSS px). */
interface PageMeta {
  w: number;
  h: number;
}

/** Extracted text of one page plus the char range each text item covers.
 *  Only the three fields highlighting needs are kept from each pdf.js text
 *  item — retaining the full item objects cost ~185MB of heap on a 1200-page
 *  document. */
interface PageText {
  lower: string;
  spans: { start: number; end: number; t: number[]; w: number; len: number }[];
}

interface Match {
  page: number; // 1-based
  start: number;
  end: number;
}

const GAP = 12; // px between pages
const BUFFER = 1; // pages kept rendered beyond the viewport, each direction
const MIN_SCALE = 0.25;
const MAX_SCALE = 6;
const MAX_DPR = 2; // cap retina cost — 3x costs 2.25x the pixels for no visible gain
/** Search-index ceiling. ~6M chars is thousands of pages of text and keeps the
 *  index well under ~100MB of heap; past it we stop indexing rather than risk
 *  an out-of-memory tab on a very large document. */
const MAX_INDEX_CHARS = 6_000_000;
/** Above this page count, sample sizes instead of measuring every page. */
const SIZE_SAMPLE = 30;
/** Documents up to this many pages are indexed as soon as they open, so search
 *  is instant. Larger ones wait until the user actually searches — walking every
 *  page to build an index would otherwise force the whole file to download,
 *  which is exactly what we avoid with range requests. */
const EAGER_INDEX_MAX_PAGES = 300;

/** Highlight boxes for one page, in CSS px at the current scale. */
function buildHighlights(
  pageText: PageText | undefined,
  ranges: { start: number; end: number; current: boolean }[],
  viewport: any,
  Util: any
) {
  if (!pageText || ranges.length === 0) return [];
  const out: { left: number; top: number; width: number; height: number; current: boolean }[] = [];

  for (const range of ranges) {
    for (const span of pageText.spans) {
      // Skip items that don't overlap the match at all
      if (span.end <= range.start || span.start >= range.end) continue;

      const len = span.len;
      if (!len) continue;

      // Map the item's PDF-space transform into viewport (screen) space
      const tx = Util.transform(viewport.transform, span.t);
      const fontHeight = Math.hypot(tx[2], tx[3]);
      const fullWidth = span.w * viewport.scale;

      // Which slice of this item does the match cover?
      const from = Math.max(0, range.start - span.start);
      const to = Math.min(len, range.end - span.start);
      const left = tx[4] + (from / len) * fullWidth;
      const width = ((to - from) / len) * fullWidth;

      out.push({
        left,
        top: tx[5] - fontHeight,
        width: Math.max(width, 2),
        height: fontHeight,
        current: range.current,
      });
    }
  }
  return out;
}

function PdfPageView({
  doc,
  pdfjs,
  pageNum,
  scale,
  meta,
  active,
  pageText,
  ranges,
}: {
  doc: any;
  pdfjs: any;
  pageNum: number;
  scale: number;
  meta: PageMeta;
  active: boolean;
  pageText: PageText | undefined;
  ranges: { start: number; end: number; current: boolean }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [painted, setPainted] = useState(false);
  const [viewport, setViewport] = useState<any>(null);

  const width = Math.round(meta.w * scale);
  const height = Math.round(meta.h * scale);

  useEffect(() => {
    if (!active) {
      // Free the bitmap when the page scrolls far out of view. Keeping every
      // page's canvas alive is what makes naive viewers crawl on long PDFs.
      const c = canvasRef.current;
      if (c) {
        c.width = 0;
        c.height = 0;
      }
      textLayerRef.current?.replaceChildren();
      setPainted(false);
      return;
    }

    let cancelled = false;
    let renderTask: any = null;

    (async () => {
      const page = await doc.getPage(pageNum);
      if (cancelled) return;

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      // Render at device resolution, display at CSS resolution.
      const renderViewport = page.getViewport({ scale: scale * dpr });
      const cssViewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(renderViewport.width);
      canvas.height = Math.floor(renderViewport.height);
      canvas.style.width = `${Math.floor(cssViewport.width)}px`;
      canvas.style.height = `${Math.floor(cssViewport.height)}px`;

      renderTask = page.render({ canvas, viewport: renderViewport });
      await renderTask.promise;
      if (cancelled) return;

      setViewport(cssViewport);
      setPainted(true);

      // Selectable text layer — lets the user select and copy text
      const layer = textLayerRef.current;
      if (layer) {
        layer.replaceChildren();
        layer.style.setProperty("--scale-factor", String(scale));
        layer.style.setProperty("--total-scale-factor", String(scale));
        try {
          const textContent = await page.getTextContent();
          if (cancelled) return;
          const textLayer = new pdfjs.TextLayer({
            textContentSource: textContent,
            container: layer,
            viewport: cssViewport,
          });
          await textLayer.render();
        } catch {
          /* the text layer is a nicety — never let it break the page render */
        }
      }
    })().catch((e: any) => {
      if (cancelled) return;
      if (e?.name === "RenderingCancelledException") return;
      console.error(`[PdfViewer] page ${pageNum} render failed:`, e);
    });

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        /* already settled */
      }
    };
  }, [active, doc, pdfjs, pageNum, scale]);

  const highlights = useMemo(
    () => (viewport ? buildHighlights(pageText, ranges, viewport, pdfjs.Util) : []),
    [viewport, pageText, ranges, pdfjs]
  );

  return (
    <div data-page={pageNum} className="relative mx-auto bg-white shadow-sm" style={{ width, height }}>
      <canvas ref={canvasRef} className="block" style={{ width, height }} />

      {!painted && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <span className="text-xs text-gray-300 tabular-nums">{pageNum}</span>
        </div>
      )}

      <div ref={textLayerRef} className="textLayer" />

      {highlights.map((h, i) => (
        <div
          key={i}
          className={`pointer-events-none absolute rounded-[1px] ${
            h.current ? "bg-orange-400/50" : "bg-yellow-300/40"
          }`}
          style={{ left: h.left, top: h.top, width: h.width, height: h.height }}
        />
      ))}
    </div>
  );
}

export default function PdfViewer({ url, size }: Props) {
  const rangeOnly = !!size && size > RANGE_ONLY_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [pdfjs, setPdfjs] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [metas, setMetas] = useState<PageMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [scale, setScale] = useState(1);
  const [fitWidthMode, setFitWidthMode] = useState(true);
  const [range, setRange] = useState<[number, number]>([1, 3]);
  const [currentPage, setCurrentPage] = useState(1);

  const [pageTexts, setPageTexts] = useState<(PageText | undefined)[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [indexedPages, setIndexedPages] = useState(0);
  const [indexRequested, setIndexRequested] = useState(false);
  const [query, setQuery] = useState("");
  const [matchIdx, setMatchIdx] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState(0);

  // ---------- Load document ----------
  useEffect(() => {
    let cancelled = false;
    let task: any = null;

    setLoading(true);
    setError(null);
    setProgress(0);
    setMetas([]);
    setPageTexts([]);
    setQuery("");
    setIndexedPages(0);
    setIndexRequested(false);

    (async () => {
      // The *legacy* build is required, not just preferable: the modern build
      // calls Map.prototype.getOrInsertComputed, a TC39 proposal no shipping
      // browser implements yet, so every page render throws and the viewer
      // paints nothing. The legacy build polyfills it.
      const lib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (cancelled) return;
      // Worker is served from /public (also the legacy build — it must match)
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      setPdfjs(lib);

      task = lib.getDocument({
        url,
        // Never prefetch the remainder of a document we haven't displayed.
        disableAutoFetch: true,
        // For a big file, refuse the whole-file stream too, so opening it costs
        // the pages actually viewed rather than its full size. Our /api/file
        // proxy forwards Range headers, which is what makes this work.
        disableStream: rangeOnly,
        rangeChunkSize: 262144, // 256KB
        // All fetched lazily, only when a document actually needs them:
        cMapUrl: "/cmaps/", // CJK encodings — required for many Korean PDFs
        cMapPacked: true,
        standardFontDataUrl: "/standard_fonts/", // PDFs that don't embed fonts
        wasmUrl: "/wasm/", // JBIG2 / JPEG2000 decoders — common in scanned PDFs
        iccUrl: "/iccs/", // ICC color profiles
      });
      task.onProgress = ({ loaded, total }: any) => {
        if (total) setProgress(Math.round((loaded / total) * 100));
      };

      const pdf = await task.promise;
      if (cancelled) {
        pdf.destroy?.();
        return;
      }
      docRef.current = pdf;

      // Measure pages up front (cheap — no rendering) so the scrollbar is
      // correct immediately and scrolling never reflows. Nearly every document
      // has uniform page sizes, so sample the first few and, if they agree,
      // reuse that size instead of walking thousands of pages.
      const sizes: PageMeta[] = [];
      const sampleCount = Math.min(pdf.numPages, SIZE_SAMPLE);
      for (let i = 1; i <= sampleCount; i++) {
        const p = await pdf.getPage(i);
        if (cancelled) return;
        const v = p.getViewport({ scale: 1 });
        sizes.push({ w: v.width, h: v.height });
      }

      const uniform = sizes.every((s) => s.w === sizes[0].w && s.h === sizes[0].h);
      if (uniform) {
        for (let i = sampleCount; i < pdf.numPages; i++) sizes.push({ ...sizes[0] });
      } else {
        for (let i = sampleCount + 1; i <= pdf.numPages; i++) {
          const p = await pdf.getPage(i);
          if (cancelled) return;
          const v = p.getViewport({ scale: 1 });
          sizes.push({ w: v.width, h: v.height });
        }
      }
      if (cancelled) return;

      setDoc(pdf);
      setMetas(sizes);
      setPageTexts(new Array(pdf.numPages).fill(undefined));
      setLoading(false);
    })().catch((e: any) => {
      if (cancelled) return;
      console.error("[PdfViewer] load failed:", e);
      setError(e?.message ? String(e.message) : String(e));
      setLoading(false);
    });

    return () => {
      cancelled = true;
      try {
        task?.destroy?.();
      } catch {
        /* noop */
      }
      try {
        docRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      docRef.current = null;
    };
  }, [url, rangeOnly]);

  // ---------- Background full-text extraction (powers instant search) ----------
  // Small documents index on open; large ones only once the user searches.
  // A big file is excluded even when its page count is small: indexing walks
  // every page, which pulls the whole document over the network.
  const eagerOk = metas.length <= EAGER_INDEX_MAX_PAGES && !rangeOnly;
  const shouldIndex = !!doc && metas.length > 0 && (eagerOk || indexRequested);

  useEffect(() => {
    if (!shouldIndex || !doc) return;
    let cancelled = false;
    setIndexing(true);

    (async () => {
      let budget = MAX_INDEX_CHARS;

      for (let i = 1; i <= doc.numPages; i++) {
        if (cancelled) return;
        if (budget <= 0) {
          // Stop before a very large document exhausts the tab's memory.
          // Search then covers the pages indexed so far, and the toolbar says so.
          setIndexedPages(i - 1);
          break;
        }
        try {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          if (cancelled) return;

          let text = "";
          const spans: PageText["spans"] = [];
          for (const item of content.items) {
            if (typeof item?.str !== "string") continue;
            // NFC-normalize per item so span offsets stay aligned with `text`
            const str = item.str.normalize("NFC");
            spans.push({
              start: text.length,
              end: text.length + str.length,
              t: item.transform,
              w: item.width,
              len: str.length,
            });
            text += str;
            if (item.hasEOL) text += "\n";
          }
          budget -= text.length;

          setPageTexts((prev) => {
            const next = prev.slice();
            // Only the lowercased copy is kept — the original is never read back
            next[i - 1] = { lower: text.toLowerCase(), spans };
            return next;
          });
          setIndexedPages(i);

          // Release the page's parsed resources. Without this pdf.js keeps
          // every page it has touched alive, which dominates heap on long docs.
          if (i < range[0] || i > range[1]) page.cleanup();
        } catch {
          /* a page without extractable text just isn't searchable */
        }
        // Yield so extraction never blocks painting or scrolling
        await new Promise((r) => setTimeout(r, 0));
      }
      if (!cancelled) setIndexing(false);
    })();

    return () => {
      cancelled = true;
    };
    // `range` is deliberately excluded — it changes on every scroll and would
    // restart indexing; it is only read to avoid cleaning up a visible page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldIndex, doc]);

  // ---------- Layout ----------
  const layout = useMemo(() => {
    const tops: number[] = [];
    let y = 0;
    for (const m of metas) {
      tops.push(y);
      y += Math.round(m.h * scale) + GAP;
    }
    return { tops, totalHeight: Math.max(0, y - GAP) };
  }, [metas, scale]);

  // Fit-to-width: recompute whenever the container resizes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || metas.length === 0 || !fitWidthMode) return;

    const apply = () => {
      const avail = el.clientWidth - 32; // page margin
      const widest = Math.max(...metas.map((m) => m.w));
      if (widest > 0 && avail > 0) {
        setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, avail / widest)));
      }
    };
    apply();

    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [metas, fitWidthMode]);

  // ---------- Visible-range tracking (the virtualization) ----------
  const recomputeRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el || layout.tops.length === 0) return;

    const top = el.scrollTop;
    const bottom = top + el.clientHeight;

    let first = 0;
    for (let i = 0; i < layout.tops.length; i++) {
      const h = Math.round(metas[i].h * scale);
      if (layout.tops[i] + h >= top) {
        first = i;
        break;
      }
    }
    let last = first;
    for (let i = first; i < layout.tops.length; i++) {
      if (layout.tops[i] > bottom) break;
      last = i;
    }

    setRange([Math.max(1, first + 1 - BUFFER), Math.min(layout.tops.length, last + 1 + BUFFER)]);
    setCurrentPage(first + 1);
  }, [layout, metas, scale]);

  useEffect(() => {
    recomputeRange();
  }, [recomputeRange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        recomputeRange();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [recomputeRange]);

  // ---------- Search ----------
  const matches: Match[] = useMemo(() => {
    const q = query.trim().normalize("NFC").toLowerCase();
    if (!q) return [];
    const out: Match[] = [];
    for (let i = 0; i < pageTexts.length; i++) {
      const pt = pageTexts[i];
      if (!pt) continue;
      let from = 0;
      let at: number;
      while ((at = pt.lower.indexOf(q, from)) !== -1) {
        out.push({ page: i + 1, start: at, end: at + q.length });
        from = at + q.length;
        if (out.length > 5000) return out; // sanity cap on pathological queries
      }
    }
    return out;
  }, [query, pageTexts]);

  useEffect(() => {
    setMatchIdx(0);
  }, [query]);

  const scrollToPage = useCallback(
    (pageNum: number) => {
      const el = scrollRef.current;
      const top = layout.tops[pageNum - 1];
      if (!el || top === undefined) return;
      el.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
    },
    [layout]
  );

  const gotoMatch = useCallback(
    (idx: number) => {
      if (matches.length === 0) return;
      const next = (idx + matches.length) % matches.length;
      setMatchIdx(next);
      scrollToPage(matches[next].page);
    },
    [matches, scrollToPage]
  );

  // Jump to the first hit as soon as a query produces results
  const firstHitPage = matches.length > 0 ? matches[0].page : 0;
  const lastJumpedQuery = useRef("");
  useEffect(() => {
    if (firstHitPage && lastJumpedQuery.current !== query) {
      lastJumpedQuery.current = query;
      scrollToPage(firstHitPage);
    }
    if (!query) lastJumpedQuery.current = "";
  }, [firstHitPage, query, scrollToPage]);

  const rangesByPage = useMemo(() => {
    const map = new Map<number, { start: number; end: number; current: boolean }[]>();
    matches.forEach((m, i) => {
      const arr = map.get(m.page) ?? [];
      arr.push({ start: m.start, end: m.end, current: i === matchIdx });
      map.set(m.page, arr);
    });
    return map;
  }, [matches, matchIdx]);

  // ---------- Zoom ----------
  const applyScale = useCallback((next: number) => {
    setFitWidthMode(false);
    setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, next)));
  }, []);

  const zoomIn = useCallback(() => applyScale(scale * 1.2), [applyScale, scale]);
  const zoomOut = useCallback(() => applyScale(scale / 1.2), [applyScale, scale]);
  const fitWidth = useCallback(() => setFitWidthMode(true), []);

  // Ctrl/⌘ + wheel zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      applyScale(scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyScale, scale]);

  // Pinch-to-zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startDist = 0;
    let startScale = 1;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startScale = scale;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        applyScale(startScale * (dist(e.touches) / startDist));
      }
    };
    const onEnd = () => {
      startDist = 0;
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [applyScale, scale]);

  // ---------- Keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (document.activeElement === searchRef.current) return;
      if (e.key === "PageDown") {
        e.preventDefault();
        scrollToPage(Math.min(metas.length, currentPage + 1));
      } else if (e.key === "PageUp") {
        e.preventDefault();
        scrollToPage(Math.max(1, currentPage - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPage, metas.length, scrollToPage]);

  // ---------- Print (no download) ----------
  const handlePrint = useCallback(async () => {
    const pdf = docRef.current;
    if (!pdf || printing) return;

    // Printing renders every page into memory. On a very long document that
    // takes minutes and can exhaust the tab, so make it a deliberate choice.
    if (
      pdf.numPages > 300 &&
      !window.confirm(
        `${pdf.numPages}페이지 전체를 인쇄용으로 변환합니다. 시간이 오래 걸리고 기기가 느려질 수 있어요. 계속할까요?`
      )
    ) {
      return;
    }

    setPrinting(true);
    setPrintProgress(0);

    const container = document.createElement("div");
    container.id = "pdfjs-print-container";

    try {
      // Scale down for very long documents so we don't exhaust memory
      const printScale = pdf.numPages > 100 ? 1.2 : pdf.numPages > 30 ? 1.6 : 2;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: printScale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport, intent: "print" }).promise;

        // Convert to an <img> and release the canvas — keeping N live canvases
        // alive is what makes printing a long PDF crash the tab.
        const img = document.createElement("img");
        img.src = canvas.toDataURL("image/jpeg", 0.85);
        canvas.width = 0;
        canvas.height = 0;

        const wrap = document.createElement("div");
        wrap.className = "pdfjs-print-page";
        wrap.appendChild(img);
        container.appendChild(wrap);

        setPrintProgress(Math.round((i / pdf.numPages) * 100));
      }

      document.body.appendChild(container);

      const cleanup = () => {
        container.remove();
        setPrinting(false);
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      window.print();
      setTimeout(() => {
        if (document.body.contains(container)) cleanup();
      }, 120_000);
    } catch (e) {
      console.error("[PdfViewer] print failed:", e);
      container.remove();
      setPrinting(false);
    }
  }, [printing]);

  const scalePct = Math.round(scale * 100);

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 flex-wrap gap-y-1.5">
        {/* Search */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
          <div className="relative flex-1 min-w-0">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // A long document isn't indexed until it's actually searched
                if (e.target.value.trim()) setIndexRequested(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  gotoMatch(e.shiftKey ? matchIdx - 1 : matchIdx + 1);
                }
              }}
              placeholder="문서 내 검색…"
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 placeholder-gray-400"
            />
          </div>

          {query.trim() && (
            <span
              className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums"
              title={
                !indexing && indexedPages < metas.length
                  ? `문서가 커서 앞 ${indexedPages}페이지까지만 검색됩니다`
                  : undefined
              }
            >
              {matches.length > 0 ? `${matchIdx + 1}/${matches.length}` : indexing ? "색인 중…" : "0"}
              {!indexing && indexedPages < metas.length && (
                <span className="ml-1 text-amber-600 dark:text-amber-500">
                  (앞 {indexedPages}p)
                </span>
              )}
            </span>
          )}

          {matches.length > 0 && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => gotoMatch(matchIdx - 1)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                title="이전 (Shift+Enter)"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={() => gotoMatch(matchIdx + 1)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                title="다음 (Enter)"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Page indicator */}
        {metas.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
            <input
              type="number"
              value={currentPage}
              min={1}
              max={metas.length}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 1 && n <= metas.length) scrollToPage(n);
              }}
              className="w-11 px-1 py-0.5 text-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded outline-none focus:border-blue-400"
            />
            <span>/ {metas.length}</span>
          </div>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            title="축소"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={fitWidth}
            className={`text-xs w-12 text-center tabular-nums hover:text-blue-600 dark:hover:text-blue-400 ${
              fitWidthMode ? "text-blue-600 dark:text-blue-400 font-medium" : "text-gray-500 dark:text-gray-400"
            }`}
            title="너비 맞춤"
          >
            {scalePct}%
          </button>
          <button
            onClick={zoomIn}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            title="확대"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
          )}
          {printing ? `${printProgress}%` : "인쇄"}
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
            <span className="text-sm">PDF 불러오는 중… {progress > 0 ? `${progress}%` : ""}</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 bg-gray-100 dark:bg-gray-800">
            <svg className="w-10 h-10 text-red-400 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            <p className="text-sm text-red-500 dark:text-red-300 text-center max-w-xs">
              PDF를 불러오지 못했습니다: {error}
            </p>
          </div>
        )}

        <div ref={scrollRef} className="absolute inset-0 overflow-auto px-4 py-4">
          {/* The spacer establishes full scroll height up front, so the scrollbar
              is accurate immediately and scrolling never triggers reflow. */}
          <div className="relative mx-auto" style={{ height: layout.totalHeight }}>
            {doc &&
              pdfjs &&
              metas.map((meta, i) => {
                const pageNum = i + 1;
                const active = pageNum >= range[0] && pageNum <= range[1];
                return (
                  <div key={pageNum} className="absolute left-0 right-0" style={{ top: layout.tops[i] }}>
                    <PdfPageView
                      doc={doc}
                      pdfjs={pdfjs}
                      pageNum={pageNum}
                      scale={scale}
                      meta={meta}
                      active={active}
                      pageText={pageTexts[i]}
                      ranges={rangesByPage.get(pageNum) ?? []}
                    />
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
