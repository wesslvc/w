"use client";
import { useEffect, useState } from "react";
import { getMimeLabel, formatFileSize } from "@/lib/search";
import type { DriveFile } from "@/lib/types";

interface Props {
  file: DriveFile;
  onClose: () => void;
}

function getFileId(webViewLink: string): string | null {
  return webViewLink.match(/\/d\/([^/?]+)/)?.[1] ?? null;
}

const PREVIEWABLE = [
  "application/pdf",
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

export default function FilePreviewModal({ file, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const fileId = getFileId(file.webViewLink);
  const canPreview = PREVIEWABLE.includes(file.mimeType) && !!fileId;
  const previewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;
  const downloadUrl = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : file.webViewLink;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full sm:max-w-4xl sm:max-h-[90vh] max-h-[95vh] flex flex-col bg-white dark:bg-gray-900 sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {file.name}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
              {file.folderPath || "루트"} &middot; {getMimeLabel(file.mimeType)} &middot; {formatFileSize(file.size)}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
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
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium transition-colors"
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

        {/* Preview area */}
        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-950 min-h-0">
          {canPreview ? (
            <div className="relative w-full h-full min-h-[60vh]">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-600">
                  <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">파일을 불러오는 중…</span>
                  <span className="text-xs">대용량 파일은 시간이 걸릴 수 있습니다</span>
                </div>
              )}
              <iframe
                src={previewUrl!}
                className="w-full h-full min-h-[60vh]"
                onLoad={() => setLoading(false)}
                allow="autoplay"
                title={file.name}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400 dark:text-gray-600">
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
          )}
        </div>
      </div>
    </div>
  );
}
