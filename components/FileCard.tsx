"use client";
import { useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { getMimeLabel, formatFileSize } from "@/lib/search";
import { useFavorites } from "@/hooks/useFavorites";
import FilePreviewModal from "./FilePreviewModal";
import type { DriveFile } from "@/lib/types";

const MIME_COLORS: Record<string, string> = {
  "application/pdf": "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400",
  "application/vnd.google-apps.document": "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400",
  "application/vnd.google-apps.spreadsheet": "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400",
  "application/vnd.google-apps.presentation": "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400",
};

const MIME_ICONS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.google-apps.document": "DOC",
  "application/vnd.google-apps.spreadsheet": "XLS",
  "application/vnd.google-apps.presentation": "PPT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOC",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLS",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPT",
};

interface FileCardProps {
  file: DriveFile;
  snippet?: string;
  isNew?: boolean;
}

export default function FileCard({ file, snippet, isNew }: FileCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const { isFavorite, toggle } = useFavorites();
  const favorited = isFavorite(file.id);

  const iconText = MIME_ICONS[file.mimeType] ?? "FILE";
  const iconColor = MIME_COLORS[file.mimeType] ?? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400";
  const label = getMimeLabel(file.mimeType);
  const size = formatFileSize(file.size);

  let timeAgo = "";
  try {
    timeAgo = formatDistanceToNow(parseISO(file.modifiedTime), {
      addSuffix: true,
      locale: ko,
    });
  } catch {}

  return (
    <>
      <div
        onClick={() => setShowPreview(true)}
        className="group cursor-pointer bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md dark:hover:shadow-blue-900/20 transition-all"
      >
        <div className="flex items-start gap-3">
          {/* File type badge */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold ${iconColor}`}>
            {iconText}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate text-sm sm:text-base transition-colors">
                    {file.name}
                  </h3>
                  {isNew && (
                    <span className="flex-shrink-0 text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 truncate">
                  {file.folderPath || "루트"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Favorite button */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggle(file.id); }}
                  aria-label={favorited ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    favorited
                      ? "text-yellow-500 hover:text-yellow-400"
                      : "text-gray-300 dark:text-gray-700 hover:text-yellow-400 dark:hover:text-yellow-500"
                  }`}
                >
                  <svg className="w-4 h-4" fill={favorited ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>

                {/* Open in Drive */}
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="구글 드라이브에서 열기"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 dark:text-gray-700 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Snippet */}
            {snippet && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2 bg-yellow-50 dark:bg-yellow-950/30 border-l-2 border-yellow-300 dark:border-yellow-700 pl-2 py-0.5 rounded-r">
                {snippet}
              </p>
            )}

            {/* Meta */}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-600">
              <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500">
                {label}
              </span>
              <span>{size}</span>
              {timeAgo && <span className="truncate">수정 {timeAgo}</span>}
            </div>
          </div>
        </div>
      </div>

      {showPreview && (
        <FilePreviewModal file={file} onClose={() => setShowPreview(false)} />
      )}
    </>
  );
}
