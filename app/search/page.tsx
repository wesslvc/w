import { Suspense } from "react";
import SearchBar from "@/components/SearchBar";
import FileCard from "@/components/FileCard";
import { getCachedIndex } from "@/lib/fetchIndex";
import { searchFiles } from "@/lib/search";
import { isAfter, subDays, parseISO } from "date-fns";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; mode?: string; type?: string; folder?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q ?? "";
  const mode = params.mode === "fulltext" ? "fulltext" : "filename";
  const typeFilter = params.type;
  const folderFilter = params.folder;

  const index = await getCachedIndex();
  const twoWeeksAgo = subDays(new Date(), 14);

  const results = query
    ? searchFiles(index.files, { query, mode, mimeTypeFilter: typeFilter, folderFilter })
    : [];

  const allTypes = Array.from(new Set(index.files.map((f) => f.mimeType)));

  return (
    <div>
      <div className="mb-6">
        <Suspense>
          <SearchBar defaultQuery={query} defaultMode={mode} />
        </Suspense>
      </div>

      <div className="flex gap-6">
        {/* Sidebar filters */}
        <aside className="hidden md:block w-48 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-20">
            <h3 className="font-semibold text-sm text-gray-700 mb-3">파일 형식</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <a
                  href={`/search?q=${encodeURIComponent(query)}&mode=${mode}`}
                  className={`block px-2 py-1 rounded hover:bg-gray-50 ${!typeFilter ? "text-blue-600 font-medium" : "text-gray-600"}`}
                >
                  전체
                </a>
              </li>
              {allTypes.map((t) => {
                const label =
                  t === "application/pdf"
                    ? "PDF"
                    : t.includes("word") || t.includes("document")
                    ? "Word / 문서"
                    : t.includes("sheet") || t.includes("spreadsheet")
                    ? "Excel / 시트"
                    : t.includes("presentation")
                    ? "PPT / 슬라이드"
                    : "기타";
                return (
                  <li key={t}>
                    <a
                      href={`/search?q=${encodeURIComponent(query)}&mode=${mode}&type=${encodeURIComponent(t)}`}
                      className={`block px-2 py-1 rounded hover:bg-gray-50 truncate ${typeFilter === t ? "text-blue-600 font-medium" : "text-gray-600"}`}
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
              <p className="text-sm text-gray-500 mb-4">
                &ldquo;<strong>{query}</strong>&rdquo; 검색 결과{" "}
                <strong>{results.length}</strong>건
                {mode === "fulltext" && (
                  <span className="ml-2 text-amber-600 text-xs">(본문 검색)</span>
                )}
              </p>

              {results.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-4xl mb-3">🔍</p>
                  <p>일치하는 자료를 찾지 못했습니다.</p>
                  <p className="text-sm mt-1">
                    {mode === "filename"
                      ? "본문 검색으로 전환하거나 다른 키워드를 시도해 보세요."
                      : "검색어를 바꿔 다시 시도해 보세요."}
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {results.map(({ file, snippet }) => {
                    const isNew = isAfter(parseISO(file.modifiedTime), twoWeeksAgo);
                    return (
                      <li key={file.id}>
                        <FileCard file={file} snippet={snippet} isNew={isNew} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🔎</p>
              <p>검색어를 입력하면 결과가 표시됩니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
