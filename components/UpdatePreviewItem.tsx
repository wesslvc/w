"use client";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import FilePreviewModal from "./FilePreviewModal";
import type { DriveFile, UpdateLog } from "@/lib/types";

interface Props {
  item: UpdateLog;
  file: DriveFile | null;
}

export default function UpdatePreviewItem({ item, file }: Props) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <li
        onClick={() => file && setShowPreview(true)}
        className={`flex items-start gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 transition-colors ${
          file
            ? "cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm"
            : ""
        }`}
      >
        <span
          className={`flex-shrink-0 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
            item.type === "modified"
              ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
              : "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
          }`}
        >
          {item.type === "modified" ? "수정" : "신규"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600">
            {item.fileName}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600 truncate mt-0.5">
            {item.folderPath || "루트"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          <time className="text-xs text-gray-400 dark:text-gray-600 tabular-nums">
            {format(parseISO(item.detectedAt), "HH:mm")}
          </time>
          {file && (
            <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </div>
      </li>
      {showPreview && file && (
        <FilePreviewModal file={file} onClose={() => setShowPreview(false)} />
      )}
    </>
  );
}
