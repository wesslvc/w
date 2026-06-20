"use client";
import { useState } from "react";
import { format, parseISO, isAfter, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import FilePreviewModal from "./FilePreviewModal";
import type { UpdateLog } from "@/lib/types";
import type { DriveFile } from "@/lib/types";

interface UpdateFeedProps {
  updates: UpdateLog[];
  files: DriveFile[];
  limit?: number;
}

export default function UpdateFeed({ updates, files, limit = 5 }: UpdateFeedProps) {
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const now = new Date();
  const twoWeeksAgo = subDays(now, 14);
  const displayed = updates.slice(0, limit);

  const fileMap = new Map(files.map((f) => [f.id, f]));

  if (displayed.length === 0) {
    return (
      <p className="text-gray-400 dark:text-gray-600 text-sm py-4 text-center">
        최근 업데이트 내역이 없습니다.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {displayed.map((item) => {
          const date = parseISO(item.detectedAt);
          const isNew = isAfter(date, twoWeeksAgo);
          const driveFile = fileMap.get(item.fileId);

          return (
            <li
              key={item.id}
              onClick={() => driveFile && setPreviewFile(driveFile)}
              className={`flex items-start gap-3 text-sm p-2 rounded-lg transition-colors ${
                driveFile
                  ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  : ""
              }`}
            >
              <span className="flex-shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400">
                신규
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {item.fileName}
                  {isNew && (
                    <span className="ml-1.5 text-[9px] font-bold bg-blue-500 text-white px-1 py-0.5 rounded-full align-middle">
                      NEW
                    </span>
                  )}
                </p>
                <p className="text-gray-400 dark:text-gray-600 text-xs truncate mt-0.5">
                  {item.folderPath || "루트"}
                </p>
              </div>
              <time className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-600 tabular-nums">
                {format(date, "MM/dd", { locale: ko })}
              </time>
            </li>
          );
        })}
      </ul>

      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </>
  );
}
