"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { getMimeLabel, formatFileSize } from "@/lib/search";
import type { DriveFile } from "@/lib/types";
import ZoomPanViewer from "./ZoomPanViewer";

interface Props {
  file: DriveFile;
  onClose: () => void;
}

function getFileId(webViewLink: string): string | null {
  return webViewLink.match(/\/d\/([^/?]+)/)?.[1] ?? null;
}

// Types that can use PDF.js self-hosted viewer (via our proxy)
const PDF_TYPES = ["application/pdf"];

// Types rendered via Google Drive iframe (no size issue for these)
const IFRAME_TYPES = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

function getPrintUrl(fileId: string, mimeType: string): string {
  if (mimeType === "application/vnd.google-apps.document")
    return `https://docs.google.com/document/d/${fileId}/print`;
  if (mimeType === "application/vnd.google-apps.spreadsheet")
    return `https://docs.google.com/spreadsheets/d/${fileId}/print`;
  if (mimeType === "application/vnd.google-apps.presentation")
    return `https://docs.google.com/presentation/d/${fileId}/print`;
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function getSnippet(text: string, index: number, query: string, radius = 80): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const lq = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(lq);
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-yellow-300 dark:bg-yellow-600 text-gray-900 dark:text-gray-100 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

export default function FilePreviewModal({ file, onClose }: Props) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIdx, setMatchIdx] = useState(0);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pdfIframeRef = useRef<HTMLIFrameElement>(null);

  const fileId = getFileId(file.webViewLink);
  const isPdf = PDF_TYPES.includes(file.mimeType);
  const isIframeType = IFRAME_TYPES.includes(file.mimeType);
  const canPreview = (isPdf || isIframeType) && !!fileId;

  // PDF.js uses our proxy to avoid CORS & size limits
  const pdfProxyUrl = fileId ? `/api/file/${fileId}` : null;
  const iframePreviewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;
  const downloadUrl = fileId
    ? `https://drive.google.com/uc?export=download&id=${fileId}`
    : file.webViewLink;
  const hasFullText = !!file.fullText;

  // fullText search (for files with extracted text)
  const matchPositions = useMemo(() => {
    if (!searchQuery.trim() || !file.fullText) return [];
    const lower = file.fullText.toLowerCase();
    const q = searchQuery.toLowerCase();
    const results: number[] = [];
    let i = 0;
    while ((i = lower.indexOf(q, i)) !== -1) {
      results.push(i);
      i += q.length;
    }
    return results;
  }, [searchQuery, file.fullText]);

  useEffect(() => { setMatchIdx(0); }, [searchQuery]);

  useEffect(() => {
    if (mobileSearchOpen) searchInputRef.current?.focus();
  }, [mobileSearchOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.activeElement === searchInputRef.current) {
          setSearchQuery("");
          setMobileSearchOpen(false);
          searchInputRef.current?.blur();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handlePrint() {
    if (!fileId) return;

    if (isPdf) {
      // Open PDF in new tab — browser's native PDF viewer has a reliable print button
      // contentWindow.print() is unreliable for sandboxed PDF viewers across browsers
      window.open(`/api/file/${fileId}`, "_blank");
    } else {
      window.open(getPrintUrl(fileId, file.mimeType), "_blank");
    }
  }

  const currentSnippet =
    matchPositions.length > 0 && file.fullText
      ? getSnippet(file.fullText, matchPositions[matchIdx], searchQuery)
      : null;

  // Search bar for fullText-indexed files (shown in non-PDF path)
  const fullTextSearchBar = (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="문서 내 검색…"
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 placeholder-gray-400"
        />
      </div>
      {searchQuery && (
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {matchPositions.length > 0 ? `${matchIdx + 1} / ${matchPositions.length}개` : "결과 없음"}
        </span>
      )}
      {matchPositions.length > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMatchIdx((i) => (i - 1 + matchPositions.length) % matchPositions.length)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => setMatchIdx((i) => (i + 1) % matchPositions.length)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full sm:max-w-5xl sm:max-h-[92vh] max-h-[95vh] flex flex-col bg-white dark:bg-gray-900 sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{file.name}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
              {file.folderPath || "루트"} &middot; {getMimeLabel(file.mimeType)} &middot;{" "}
              {formatFileSize(file.size)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Mobile search toggle */}
            {canPreview && (
              <button
                onClick={() => setMobileSearchOpen((v) => !v)}
                aria-label="문서 내 검색"
                className={`sm:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                  mobileSearchOpen
                    ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </button>
            )}

            {/* Print */}
            {canPreview && fileId && (
              <button
                onClick={handlePrint}
                aria-label="인쇄"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
                title="인쇄"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </button>
            )}

            {/* Download */}
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              다운로드
            </a>
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Drive
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search bar — PDF gets Ctrl+F hint; other previews get fullText search or hint */}
        {canPreview && (
          <>
            {/* Mobile toggle panel */}
            {mobileSearchOpen && (
              <div className="sm:hidden px-5 py-2.5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 bg-gray-50 dark:bg-gray-950">
                {!isPdf && hasFullText ? fullTextSearchBar : (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    미리보기 클릭 후{" "}
                    <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">Ctrl+F</kbd>{" "}
                    로 검색
                  </p>
                )}
              </div>
            )}
            {/* Desktop always-visible strip */}
            <div className="hidden sm:block px-5 py-2.5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 bg-gray-50 dark:bg-gray-950">
              {!isPdf && hasFullText ? fullTextSearchBar : (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  <svg className="inline w-3.5 h-3.5 mr-1 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  미리보기 클릭 후{" "}
                  <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">Ctrl+F</kbd>{" "}
                  로 문서 내 검색
                </p>
              )}
            </div>
          </>
        )}

        {/* fullText snippet result */}
        {currentSnippet && (
          <div className="px-5 py-2.5 bg-yellow-50 dark:bg-yellow-950/30 border-b border-yellow-200 dark:border-yellow-800 flex-shrink-0">
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              <HighlightedSnippet text={currentSnippet} query={searchQuery} />
            </p>
          </div>
        )}

        {/* Preview area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {!canPreview ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400 dark:text-gray-600 h-full">
              <span className="text-6xl">📦</span>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                이 형식은 미리보기를 지원하지 않습니다
              </p>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                파일 다운로드
              </a>
            </div>
          ) : isPdf && pdfProxyUrl ? (
            /* PDF → native browser viewer via same-origin proxy, wrapped in zoom/pan controller */
            <ZoomPanViewer>
              <div className="relative w-full h-full min-h-[60vh]">
                {pdfLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-600 bg-white dark:bg-gray-900 z-10">
                    <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm">PDF 불러오는 중…</span>
                    <span className="text-xs text-gray-400 dark:text-gray-600">대용량 파일은 잠시 기다려주세요</span>
                  </div>
                )}
                <iframe
                  ref={pdfIframeRef}
                  src={pdfProxyUrl}
                  className="w-full h-full min-h-[60vh]"
                  onLoad={() => setPdfLoading(false)}
                  title={file.name}
                />
              </div>
            </ZoomPanViewer>
          ) : (
            /* Google Workspace / images → Drive iframe */
            <div className="relative w-full h-full min-h-[60vh]">
              {iframeLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-600">
                  <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">불러오는 중…</span>
                </div>
              )}
              <iframe
                src={iframePreviewUrl!}
                className="w-full h-full min-h-[60vh]"
                onLoad={() => setIframeLoading(false)}
                allow="autoplay"
                title={file.name}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
