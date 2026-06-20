import { Suspense } from "react";
import SearchBar from "@/components/SearchBar";
import FileCard from "@/components/FileCard";
import { getCachedIndex } from "@/lib/fetchIndex";
import { searchFiles } from "@/lib/search";
import { isAfter, subDays, parseISO } from "date-fns";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; mode?: string; type?: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.google-apps.document": "Google 문서",
  "application/vnd.google-apps.spreadsheet": "Google 시트",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q ?? "";
  const mode = params.mode === "fulltext" ? "fulltext" : "filename";
  const typeFilter = params.type;

  const index = await getCachedIndex();
  const twoWeeksAgo = subDays(new Date(), 14);

  const results = query
    ? searchFiles(index.files, { query, mode, mimeTypeFilter: typeFilter })
    : [];

  const allTypes = Array.from(new Set(index.files.map((f) => f.mimeType)));

  return (
    <div>
      <div className="mb-6">
        <Suspense>
          <SearchBar defaultQuery={query} defaultMode={mode} />
        </Suspense>
      </div>

      <div className="flex gap-5">
        {/* Sidebar */}
        <aside className="hidden md:block w-44 flex-shrink-0">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sticky top-20">
            <h3 className="font-semibold text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-3">파일 형식</h3>
            <ul className="space-y-0.5 text-sm">
              <li>
                <a
                  href={`/search?q=${encodeURIComponent(query)}&mode=${mode}`}
                  className={`block px-2.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!typeFilter ? "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/50" : "text-gray-600 dark:text-gray-400"}`}
                >
                  전체
                </a>
              </li>
              {allTypes.map((t) => {
                const label = TYPE_LABELS[t] ?? "기타";
                return (
                  <li key={t}>
                    <a
                      href={`/search?q=${encodeURIComponent(query)}&mode=${mode}&type=${encodeURIComponent(t)}`}
                      className={`block px-2.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 truncate transition-colors ${typeFilter === t ? "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/50" : "text-gray-600 dark:text-gray-400"}`}
                    >
                      {label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {query ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                <span className="font-medium text-gray-900 dark:text-gray-100">&ldquo;{query}&rdquo;</span>{" "}
                검색 결과{" "}
                <strong>{results.length}</strong>건
                {mode === "fulltext" && (
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-500">본문 검색</span>
                )}
              </p>

              {results.length === 0 ? (
                <div className="text-center py-20 text-gray-400 dark:text-gray-600">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <p className="font-medium text-gray-600 dark:text-gray-400">일치하는 자료를 찾지 못했습니다</p>
                  <p className="text-sm mt-1">
                    {mode === "filename" ? "본문 검색으로 전환하거나 다른 키워드를 시도해 보세요." : "검색어를 바꿔 다시 시도해 보세요."}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {results.map(({ file, snippet }) => (
                    <li key={file.id}>
                      <FileCard
                        file={file}
                        snippet={snippet}
                        isNew={isAfter(parseISO(file.modifiedTime), twoWeeksAgo)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-gray-400 dark:text-gray-600">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <p className="text-sm">검색어를 입력하면 결과가 표시됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
