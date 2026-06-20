import { format, parseISO, isAfter, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import type { UpdateLog } from "@/lib/types";

interface UpdateFeedProps {
  updates: UpdateLog[];
  limit?: number;
}

export default function UpdateFeed({ updates, limit = 5 }: UpdateFeedProps) {
  const now = new Date();
  const twoWeeksAgo = subDays(now, 14);
  const displayed = updates.slice(0, limit);

  if (displayed.length === 0) {
    return (
      <p className="text-gray-400 dark:text-gray-600 text-sm py-4 text-center">
        최근 업데이트 내역이 없습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {displayed.map((item) => {
        const date = parseISO(item.detectedAt);
        const isNew = isAfter(date, twoWeeksAgo);

        return (
          <li
            key={item.id}
            className="flex items-start gap-3 text-sm p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <span className="flex-shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400">
              신규
            </span>
            <div className="flex-1 min-w-0">
              <a
                href={item.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 truncate block transition-colors"
              >
                {item.fileName}
                {isNew && (
                  <span className="ml-1.5 text-[9px] font-bold bg-blue-500 text-white px-1 py-0.5 rounded-full align-middle">
                    NEW
                  </span>
                )}
              </a>
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
  );
}
