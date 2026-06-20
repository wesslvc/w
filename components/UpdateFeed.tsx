import { format, parseISO, isAfter, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import type { UpdateLog } from "@/lib/types";

interface UpdateFeedProps {
  updates: UpdateLog[];
  limit?: number;
  showAll?: boolean;
}

export default function UpdateFeed({ updates, limit = 5, showAll = false }: UpdateFeedProps) {
  const now = new Date();
  const twoWeeksAgo = subDays(now, 14);

  const displayed = showAll ? updates : updates.slice(0, limit);

  if (displayed.length === 0) {
    return (
      <p className="text-gray-400 text-sm py-4 text-center">
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
          <li key={item.id} className="flex items-start gap-3 text-sm">
            <span
              className={`flex-shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                item.type === "new"
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {item.type === "new" ? "신규" : "수정"}
            </span>

            <div className="flex-1 min-w-0">
              <a
                href={item.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-800 hover:text-blue-600 truncate block"
              >
                {item.fileName}
                {isNew && (
                  <span className="ml-1.5 text-[10px] font-bold bg-blue-100 text-blue-700 px-1 py-0.5 rounded-full align-middle">
                    NEW
                  </span>
                )}
              </a>
              <p className="text-gray-400 text-xs truncate">
                {item.folderPath}
              </p>
            </div>

            <time className="flex-shrink-0 text-xs text-gray-400">
              {format(date, "MM/dd", { locale: ko })}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
