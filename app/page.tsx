import { Suspense } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import UpdateFeed from "@/components/UpdateFeed";
import { loadIndex, loadUpdates } from "@/lib/data";

export default function HomePage() {
  const index = loadIndex();
  const history = loadUpdates();

  // Collect unique top-level folder names
  const topFolders = Array.from(
    new Set(index.files.map((f) => f.folderPath.split("/")[0]))
  ).sort();

  return (
    <div>
      {/* Hero search */}
      <section className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">자료 통합 검색</h1>
        <p className="text-gray-500 mb-8">
          구글드라이브 아카이브에서 문서를 빠르게 찾아보세요.
          <br />
          <span className="text-sm">
            총 <strong>{index.totalFiles}</strong>개 파일 인덱싱됨 &middot; 마지막 동기화:{" "}
            {index.syncedAt
              ? new Date(index.syncedAt).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "정보 없음"}
          </span>
        </p>
        <div className="max-w-2xl mx-auto">
          <Suspense>
            <SearchBar large autoFocus />
          </Suspense>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recent Updates */}
        <section className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">최근 업데이트</h2>
            <Link
              href="/updates"
              className="text-sm text-blue-600 hover:underline"
            >
              전체 보기 →
            </Link>
          </div>
          <UpdateFeed updates={history.updates} limit={6} />
        </section>

        {/* Folder Quick Access */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">폴더 바로가기</h2>
            <Link
              href="/browse"
              className="text-sm text-blue-600 hover:underline"
            >
              전체 보기 →
            </Link>
          </div>
          <ul className="space-y-1.5">
            {topFolders.map((folder) => {
              const count = index.files.filter((f) =>
                f.folderPath.startsWith(folder)
              ).length;
              return (
                <li key={folder}>
                  <Link
                    href={`/browse?path=${encodeURIComponent(folder)}`}
                    className="flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-gray-50 group"
                  >
                    <span className="flex items-center gap-2 text-gray-700 group-hover:text-blue-600">
                      <span>📁</span>
                      {folder}
                    </span>
                    <span className="text-gray-400 text-xs">{count}</span>
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
