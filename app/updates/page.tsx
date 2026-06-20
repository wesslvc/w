import { format, parseISO, isAfter, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import { getCachedIndex, deriveUpdates } from "@/lib/fetchIndex";
import type { UpdateLog } from "@/lib/types";

export default async function UpdatesPage() {
  const index = await getCachedIndex();
  const history = deriveUpdates(index);
  const twoWeeksAgo = subDays(new Date(), 14);

  const grouped: Record<string, UpdateLog[]> = {};
  for (const u of history.updates) {
    const day = format(parseISO(u.detectedAt), "yyyy-MM-dd");
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(u);
  }
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">업데이트 내역</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          마지막 동기화:{" "}
          {history.lastCheckedAt
            ? format(parseISO(history.lastCheckedAt), "yyyy년 M월 d일 HH:mm", { locale: ko })
            : "정보 없음"}
        </p>
      </div>

      {sortedDays.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p>업데이트 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-800" />

          <div className="space-y-7">
            {sortedDays.map((day) => {
              const date = parseISO(day);
              const isRecent = isAfter(date, twoWeeksAgo);
              return (
                <div key={day} className="relative pl-8">
                  <div
                    className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-950 ${
                      isRecent ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-700"
                    }`}
                  />
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                      {format(date, "yyyy년 M월 d일 (eee)", { locale: ko })}
                    </h2>
                    {isRecent && (
                      <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">최근</span>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {grouped[day].map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                      >
                        <span className="flex-shrink-0 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400">
                          신규
                        </span>
                        <div className="flex-1 min-w-0">
                          <a
                            href={item.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 truncate block transition-colors"
                          >
                            {item.fileName}
                          </a>
                          <p className="text-xs text-gray-400 dark:text-gray-600 truncate mt-0.5">
                            {item.folderPath || "루트"}
                          </p>
                        </div>
                        <time className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-600 tabular-nums mt-0.5">
                          {format(parseISO(item.detectedAt), "HH:mm")}
                        </time>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
