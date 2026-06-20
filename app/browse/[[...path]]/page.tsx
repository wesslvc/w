import Link from "next/link";
import FileCard from "@/components/FileCard";
import { loadIndex } from "@/lib/data";
import { isAfter, subDays, parseISO } from "date-fns";

interface BrowsePageProps {
  searchParams: Promise<{ path?: string }>;
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams;
  const currentPath = params.path ?? "";

  const index = loadIndex();
  const twoWeeksAgo = subDays(new Date(), 14);

  // Files directly under currentPath (root: folderPath === "")
  const filesHere = index.files.filter((f) =>
    currentPath ? f.folderPath === currentPath : f.folderPath === ""
  );

  // Subdirectories under currentPath
  const subFolders = Array.from(
    new Set(
      index.files
        .filter((f) => {
          if (!currentPath) {
            // Top-level: any file with a non-empty folderPath
            return f.folderPath !== "";
          }
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

  // Top-level folders for the root view
  const topFolders = Array.from(
    new Set(index.files.map((f) => f.folderPath.split("/")[0]))
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
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/browse" className="hover:text-blue-600">
          전체 자료
        </Link>
        {breadcrumbs.map((b) => (
          <span key={b.path} className="flex items-center gap-1">
            <span>/</span>
            <Link
              href={`/browse?path=${encodeURIComponent(b.path)}`}
              className="hover:text-blue-600"
            >
              {b.label}
            </Link>
          </span>
        ))}
      </nav>

      <div className="flex gap-6">
        {/* Sidebar: folder tree */}
        <aside className="hidden md:block w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-20">
            <h3 className="font-semibold text-sm text-gray-700 mb-3">폴더</h3>
            <ul className="space-y-0.5 text-sm">
              <li>
                <Link
                  href="/browse"
                  className={`block px-2 py-1.5 rounded hover:bg-gray-50 ${!currentPath ? "text-blue-600 font-medium bg-blue-50" : "text-gray-600"}`}
                >
                  📁 전체 자료
                </Link>
              </li>
              {topFolders.map((folder) => (
                <li key={folder}>
                  <Link
                    href={`/browse?path=${encodeURIComponent(folder)}`}
                    className={`block px-2 py-1.5 pl-5 rounded hover:bg-gray-50 truncate ${currentPath === folder || currentPath.startsWith(folder + "/") ? "text-blue-600 font-medium" : "text-gray-600"}`}
                  >
                    📁 {folder}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Subfolders */}
          {!currentPath && topFolders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {topFolders.map((folder) => {
                const count = index.files.filter((f) =>
                  f.folderPath === folder || f.folderPath.startsWith(folder + "/")
                ).length;
                return (
                  <Link
                    key={folder}
                    href={`/browse?path=${encodeURIComponent(folder)}`}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-sm transition-all flex items-center gap-3"
                  >
                    <span className="text-2xl">📁</span>
                    <div>
                      <p className="font-medium text-sm text-gray-800">{folder}</p>
                      <p className="text-xs text-gray-400">{count}개 파일</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {currentPath && subFolders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {subFolders.map((sub) => {
                const fullPath = currentPath ? `${currentPath}/${sub}` : sub;
                const count = index.files.filter((f) =>
                  f.folderPath.startsWith(fullPath)
                ).length;
                return (
                  <Link
                    key={sub}
                    href={`/browse?path=${encodeURIComponent(fullPath)}`}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-sm transition-all flex items-center gap-3"
                  >
                    <span className="text-2xl">📁</span>
                    <div>
                      <p className="font-medium text-sm text-gray-800">{sub}</p>
                      <p className="text-xs text-gray-400">{count}개 파일</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Files */}
          {filesHere.length > 0 ? (
            <ul className="space-y-3">
              {filesHere.map((file) => {
                const isNew = isAfter(parseISO(file.modifiedTime), twoWeeksAgo);
                return (
                  <li key={file.id}>
                    <FileCard file={file} isNew={isNew} />
                  </li>
                );
              })}
            </ul>
          ) : !currentPath ? null : (
            <p className="text-gray-400 text-sm py-8 text-center">
              이 폴더에 파일이 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
