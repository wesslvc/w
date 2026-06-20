import { format, parseISO, isAfter, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import { loadUpdates } from "@/lib/data";
import type { UpdateLog } from "@/lib/types";

export default function UpdatesPage() {
  const history = loadUpdates();
  const twoWeeksAgo = subDays(new Date(), 14);

  // Group updates by date
  const grouped: Record<string, UpdateLog[]> = {};
  for (const update of history.updates) {
    const day = format(parseISO(update.detectedAt), "yyyy-MM-dd");
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(update);
  }

  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">업데이트 내역</h1>
        <p className="text-sm text-gray-500 mt-1">
          마지막 동기화:{" "}
          {history.lastCheckedAt
            ? format(parseISO(history.lastCheckedAt), "yyyy년 M월 d일 HH:mm", { locale: ko })
            : "정보 없음"}
        </p>
      </div>

      {sortedDays.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p>업데이트 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-8">
            {sortedDays.map((day) => {
              const date = parseISO(day);
              const isRecent = isAfter(date, twoWeeksAgo);

              return (
                <div key={day} className="relative pl-8">
                  {/* Dot */}
                  <div
                    className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${isRecent ? "bg-blue-500" : "bg-gray-300"}`}
                  />

                  {/* Date header */}
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="font-semibold text-gray-700">
                      {format(date, "yyyy년 M월 d일 (eee)", { locale: ko })}
                    </h2>
                    {isRecent && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                        최근
                      </span>
                    )}
                  </div>

                  {/* Items */}
                  <ul className="space-y-2">
                    {grouped[day].map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-300 transition-colors"
                      >
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
                            className="font-medium text-sm text-gray-800 hover:text-blue-600 truncate block"
                          >
                            {item.fileName}
                          </a>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {item.folderPath}
                          </p>
                        </div>
                        <time className="flex-shrink-0 text-xs text-gray-400 mt-0.5">
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
