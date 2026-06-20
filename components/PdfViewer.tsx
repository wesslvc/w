"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

let pdfLibCache: typeof import("pdfjs-dist") | null = null;
async function loadPdfLib() {
  if (pdfLibCache) return pdfLibCache;
  const lib = await import("pdfjs-dist");
  // Serve worker locally — avoids CDN failures and CORS issues
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  pdfLibCache = lib;
  return lib;
}

interface SearchMatch {
  page: number;
  snippet: string;
}

interface Props {
  url: string;
}

export default function PdfViewer({ url }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState("1");

  const [pendingQuery, setPendingQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [matchIdx, setMatchIdx] = useState(0);
  const [searching, setSearching] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    pdfRef.current = null;

    loadPdfLib()
      .then((lib) =>
        lib.getDocument({
          url,
          cMapUrl: "/cmaps/",
          cMapPacked: true,
        }).promise
      )
      .then((doc) => {
        if (cancelled) return;
        pdfRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[PdfViewer] load error:", err);
        setError(`PDF 로드 실패: ${err?.message ?? String(err)}`);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url]);

  // Render page
  const renderPage = useCallback(async (pageNum: number, pageScale: number) => {
    const doc = pdfRef.current;
    if (!doc || !canvasRef.current) return;

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
      renderTaskRef.current = null;
    }

    let page: PDFPageProxy;
    try { page = await doc.getPage(pageNum); }
    catch { return; }

    const viewport = page.getViewport({ scale: pageScale });
    const canvas = canvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const task = page.render({ canvas, viewport });
    renderTaskRef.current = task;
    try { await task.promise; }
    catch (e: unknown) {
      if ((e as { name?: string })?.name === "RenderingCancelledException") return;
      console.error("[PdfViewer] render error:", e);
    }
  }, []);

  useEffect(() => {
    if (!loading && !error) {
      renderPage(currentPage, scale);
      setPageInput(String(currentPage));
    }
  }, [loading, error, currentPage, scale, renderPage]);

  // Navigate to match page when matchIdx changes
  useEffect(() => {
    if (matches.length > 0) setCurrentPage(matches[matchIdx].page);
  }, [matchIdx, matches]);

  // Text search through all pages
  const handleSearch = useCallback(async () => {
    const doc = pdfRef.current;
    const q = pendingQuery.trim();
    if (!doc || !q) { setMatches([]); setSearchQuery(""); return; }

    setSearching(true);
    setSearchQuery(q);
    const found: SearchMatch[] = [];
    const lower = q.toLowerCase();

    for (let i = 1; i <= doc.numPages; i++) {
      try {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        if (text.toLowerCase().includes(lower)) {
          const idx = text.toLowerCase().indexOf(lower);
          const start = Math.max(0, idx - 50);
          const end = Math.min(text.length, idx + lower.length + 50);
          found.push({
            page: i,
            snippet:
              (start > 0 ? "…" : "") +
              text.slice(start, end) +
              (end < text.length ? "…" : ""),
          });
        }
      } catch {}
    }

    setMatches(found);
    setMatchIdx(0);
    if (found.length > 0) setCurrentPage(found[0].page);
    setSearching(false);
  }, [pendingQuery]);

  function goTo(page: number) {
    setCurrentPage(Math.max(1, Math.min(numPages, page)));
  }

  return (
    <div className="flex flex-col h-full bg-gray-800 text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 flex-shrink-0 flex-wrap gap-y-1.5">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            type="number"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") goTo(parseInt(pageInput) || 1); }}
            onBlur={() => goTo(parseInt(pageInput) || 1)}
            className="w-10 text-center text-xs bg-gray-700 rounded px-1 py-1 outline-none focus:ring-1 ring-blue-500"
          />
          <span className="text-xs text-gray-400">/ {numPages}</span>
          <button
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="w-px h-4 bg-gray-700" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, parseFloat((s - 0.2).toFixed(1))))}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs text-gray-400 w-10 text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(3.0, parseFloat((s + 0.2).toFixed(1))))}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="w-px h-4 bg-gray-700" />

        {/* Search */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <input
            type="text"
            value={pendingQuery}
            onChange={(e) => setPendingQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            placeholder="문서 내 검색…"
            className="flex-1 min-w-0 px-2 py-1 text-xs bg-gray-700 rounded outline-none focus:ring-1 ring-blue-500 placeholder-gray-500"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !pendingQuery.trim()}
            className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors whitespace-nowrap"
          >
            {searching ? "검색 중…" : "검색"}
          </button>
          {matches.length > 0 && (
            <>
              <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
                {matchIdx + 1}/{matches.length}
              </span>
              <button
                onClick={() => setMatchIdx((i) => (i - 1 + matches.length) % matches.length)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={() => setMatchIdx((i) => (i + 1) % matches.length)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </>
          )}
          {searchQuery && matches.length === 0 && !searching && (
            <span className="text-xs text-gray-500 whitespace-nowrap">결과 없음</span>
          )}
        </div>
      </div>

      {/* Match snippet */}
      {matches.length > 0 && matches[matchIdx] && (
        <div className="px-4 py-1.5 bg-yellow-900/40 border-b border-yellow-700/30 text-xs text-yellow-200 flex-shrink-0 truncate">
          <span className="text-yellow-400 font-medium mr-1.5">
            p.{matches[matchIdx].page}
          </span>
          {matches[matchIdx].snippet}
        </div>
      )}

      {/* Canvas area */}
      <div className="flex-1 overflow-auto bg-gray-700 flex items-start justify-center p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-gray-400">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">PDF 불러오는 중…</span>
            <span className="text-xs text-gray-500">대용량 파일은 잠시 기다려주세요</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
            <svg className="w-10 h-10 text-red-400 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm text-red-300 text-center max-w-xs">{error}</p>
            <p className="text-xs text-gray-500 text-center max-w-xs">
              파일이 공개 공유되어 있는지, Vercel에 GOOGLE_API_KEY 환경변수가 설정됐는지 확인하세요.
            </p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="block shadow-2xl" />
        )}
      </div>
    </div>
  );
}
