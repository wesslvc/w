import Link from "next/link";
import FileCard from "@/components/FileCard";
import { getCachedIndex } from "@/lib/fetchIndex";
import { isAfter, subDays, parseISO } from "date-fns";

interface BrowsePageProps {
  searchParams: Promise<{ path?: string }>;
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams;
  const currentPath = params.path ?? "";

  const index = await getCachedIndex();
  const twoWeeksAgo = subDays(new Date(), 14);

  const filesHere = index.files.filter((f) =>
    currentPath ? f.folderPath === currentPath : f.folderPath === ""
  );

  const subFolders = Array.from(
    new Set(
      index.files
        .filter((f) => {
          if (!currentPath) return f.folderPath !== "";
          return (
            f.folderPath.startsWith(currentPath + "/") &&
            !f.folderPath.slice(currentPath.length + 1).includes("/")
          );
        })
        .map((f) => {
          if (!currentPath) return f.folderPath.split("/")[0];
          return f.folderPath.slice(currentPath.length + 1).split("/")[0];
        })
        .filter(Boolean)
    )
  ).sort();

  const topFolders = Array.from(
    new Set(index.files.map((f) => f.folderPath.split("/")[0]).filter(Boolean))
  ).sort();

  const breadcrumbs = currentPath
    ? currentPath.split("/").map((seg, i, arr) => ({
        label: seg,
        path: arr.slice(0, i + 1).join("/"),
      }))
    : [];

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-500 mb-5 flex-wrap">
        <Link href="/browse" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          전체 자료
        </Link>
        {breadcrumbs.map((b) => (
          <span key={b.path} className="flex items-center gap-1">
            <span className="text-gray-300 dark:text-gray-700">/</span>
            <Link
              href={`/browse?path=${encodeURIComponent(b.path)}`}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {b.label}
            </Link>
          </span>
        ))}
      </nav>

      <div className="flex gap-5">
        {/* Sidebar */}
        <aside className="hidden md:block w-52 flex-shrink-0">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sticky top-20">
            <h3 className="font-semibold text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-3">폴더</h3>
            <ul className="space-y-0.5 text-sm">
              <li>
                <Link
                  href="/browse"
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors truncate ${!currentPath ? "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/50" : "text-gray-600 dark:text-gray-400"}`}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L11 7h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                  전체 자료
                </Link>
              </li>
              {topFolders.map((folder) => (
                <li key={folder}>
                  <Link
                    href={`/browse?path=${encodeURIComponent(folder)}`}
                    className={`flex items-center gap-2 pl-5 pr-2.5 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 truncate transition-colors ${
                      currentPath === folder || currentPath.startsWith(folder + "/")
                        ? "text-blue-600 dark:text-blue-400 font-medium"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L11 7h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                    <span className="truncate">{folder}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Folder grid */}
          {(!currentPath ? topFolders : subFolders).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {(!currentPath ? topFolders : subFolders).map((folder) => {
                const fullPath = !currentPath ? folder : `${currentPath}/${folder}`;
                const count = index.files.filter(
                  (f) => f.folderPath === fullPath || f.folderPath.startsWith(fullPath + "/")
                ).length;
                return (
                  <Link
                    key={folder}
                    href={`/browse?path=${encodeURIComponent(fullPath)}`}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm transition-all flex items-center gap-3 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-950 transition-colors">
                      <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L11 7h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{folder}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-600 tabular-nums">{count}개</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Files */}
          {filesHere.length > 0 ? (
            <ul className="space-y-2.5">
              {filesHere.map((file) => (
                <li key={file.id}>
                  <FileCard
                    file={file}
                    isNew={isAfter(parseISO(file.modifiedTime), twoWeeksAgo)}
                  />
                </li>
              ))}
            </ul>
          ) : currentPath && subFolders.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600 text-sm py-10 text-center">
              이 폴더에 파일이 없습니다.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
