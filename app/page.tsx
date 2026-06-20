import { Suspense } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import UpdateFeed from "@/components/UpdateFeed";
import { getCachedIndex, deriveUpdates } from "@/lib/fetchIndex";

export default async function HomePage() {
  const index = await getCachedIndex();
  const history = deriveUpdates(index);

  const topFolders = Array.from(
    new Set(index.files.map((f) => f.folderPath.split("/")[0]).filter(Boolean))
  ).sort();

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="text-center py-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-50 mb-2 tracking-tight">
          은성아카이브 자료찾기
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base mb-8">
          구글드라이브에서 자료를 한 번에 검색하세요
          <br />
          <span className="text-xs text-gray-400 dark:text-gray-600">
            총 <strong className="text-gray-600 dark:text-gray-400">{index.totalFiles}</strong>개 파일 &middot; 마지막 동기화{" "}
            {index.syncedAt
              ? new Date(index.syncedAt).toLocaleString("ko-KR", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
        </p>
        <div className="max-w-2xl mx-auto">
          <Suspense>
            <SearchBar large autoFocus />
          </Suspense>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Updates */}
        <section className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">최근 업로드</h2>
            <Link
              href="/updates"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              전체 보기 →
            </Link>
          </div>
          <UpdateFeed updates={history.updates} limit={6} />
        </section>

        {/* Folder Quick Access */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">폴더 바로가기</h2>
            <Link
              href="/browse"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              전체 보기 →
            </Link>
          </div>
          <ul className="space-y-0.5">
            {topFolders.map((folder) => {
              const count = index.files.filter(
                (f) => f.folderPath === folder || f.folderPath.startsWith(folder + "/")
              ).length;
              return (
                <li key={folder}>
                  <Link
                    href={`/browse?path=${encodeURIComponent(folder)}`}
                    className="flex items-center justify-between text-sm px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 group transition-colors"
                  >
                    <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate transition-colors">
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L11 7h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                      </svg>
                      <span className="truncate">{folder}</span>
                    </span>
                    <span className="text-gray-400 dark:text-gray-600 text-xs tabular-nums flex-shrink-0 ml-2">{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
