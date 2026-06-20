import { formatDistanceToNow, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { getMimeLabel, formatFileSize } from "@/lib/search";
import type { DriveFile } from "@/lib/types";

interface FileCardProps {
  file: DriveFile;
  snippet?: string;
  matchedIn?: "filename" | "folderPath" | "fullText";
  isNew?: boolean;
}

const MIME_ICONS: Record<string, string> = {
  "application/pdf": "📄",
  "application/vnd.google-apps.document": "📝",
  "application/vnd.google-apps.spreadsheet": "📊",
  "application/vnd.google-apps.presentation": "📑",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "📑",
};

export default function FileCard({ file, snippet, isNew }: FileCardProps) {
  const icon = MIME_ICONS[file.mimeType] ?? "📁";
  const label = getMimeLabel(file.mimeType);
  const size = formatFileSize(file.size);

  let timeAgo = "";
  try {
    timeAgo = formatDistanceToNow(parseISO(file.modifiedTime), {
      addSuffix: true,
      locale: ko,
    });
  } catch {
    timeAgo = "";
  }

  return (
    <a
      href={file.webViewLink}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5 flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-gray-900 group-hover:text-blue-600 truncate">
              {file.name}
            </h3>
            {isNew && (
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                NEW
              </span>
            )}
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex-shrink-0">
              {label}
            </span>
          </div>

          <p className="text-xs text-gray-400 mt-1 truncate">
            {file.folderPath}
          </p>

          {snippet && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2 bg-yellow-50 border-l-2 border-yellow-300 pl-2 py-0.5 rounded-r">
              {snippet}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>{size}</span>
            {timeAgo && <span>수정 {timeAgo}</span>}
          </div>
        </div>
      </div>
    </a>
  );
}
