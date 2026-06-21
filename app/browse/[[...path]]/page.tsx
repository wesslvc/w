"use client";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import FileCard from "@/components/FileCard";
import SortSelect from "@/components/SortSelect";
import { isAfter, subDays, parseISO } from "date-fns";
import type { DriveIndex } from "@/lib/types";
import { sortFiles, parseSortKey } from "@/lib/sort";

function FolderSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        ))}
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      ))}
    </div>
  );
}

export default function BrowsePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentPath = (searchParams.get("path") ?? "").normalize("NFC");
  const sort = parseSortKey(searchParams.get("sort"));

  const [index, setIndex] = useState<DriveIndex | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Fetch index once — subsequent folder navigations are instant (client-side filter)
  useEffect(() => {
    fetch("/api/index")
      .then((r) => r.json())
      .then(setIndex)
      .catch(console.error);
  }, []);

  const twoWeeksAgo = subDays(new Date(), 14);

  const { filesHere, subFolders, topFolders, allFilesHere } = useMemo(() => {
    if (!index) return { filesHere: [], subFolders: [], topFolders: [], allFilesHere: [] };

    // Direct files only (exact path match)
    const filesHere = sortFiles(
      index.files.filter((f) =>
        currentPath ? f.folderPath === currentPath : f.folderPath === ""
      ),
      sort
    );

    // Include all files that are anywhere under currentPath — not just
    // those exactly one level deep — so folders that only contain
    // sub-subfolders (no direct files) are still shown.
    const subFolders = Array.from(
      new Set(
        index.files
          .filter((f) => {
            if (!currentPath) return f.folderPath !== "";
            return f.folderPath.startsWith(currentPath + "/");
          })
          .map((f) =>
            !currentPath
              ? f.folderPath.split("/")[0]
              : f.folderPath.slice(currentPath.length + 1).split("/")[0]
          )
          .filter(Boolean)
      )
    ).sort();

    const topFolders = Array.from(
      new Set(index.files.map((f) => f.folderPath.split("/")[0]).filter(Boolean))
    ).sort();

    // All files under currentPath (including sub-subfolders) for "하위 포함" mode
    const allFilesHere = sortFiles(
      index.files.filter((f) => {
        if (!currentPath) return true;
        return f.folderPath === currentPath || f.folderPath.startsWith(currentPath + "/");
      }),
      sort
    );

    return { filesHere, subFolders, topFolders, allFilesHere };
  }, [index, currentPath, sort]);

  const breadcrumbs = currentPath
    ? currentPath.split("/").map((seg, i, arr) => ({
        label: seg,
        path: arr.slice(0, i + 1).join("/"),
      }))
    : [];

  const displayFolders = currentPath ? subFolders : topFolders;

  function navigate(path: string) {
    if (path) {
      router.push(`/browse?path=${encodeURIComponent(path)}`);
    } else {
      router.push("/browse");
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-500 mb-5 flex-wrap">
        <button
          onClick={() => navigate("")}
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          전체 자료
        </button>
        {breadcrumbs.map((b) => (
          <span key={b.path} className="flex items-center gap-1">
            <span className="text-gray-300 dark:text-gray-700">/</span>
            <button
              onClick={() => navigate(b.path)}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {b.label}
            </button>
          </span>
        ))}
      </nav>

      <div className="flex gap-5">
        {/* Sidebar */}
        <aside className="hidden md:block w-52 flex-shrink-0">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sticky top-20">
            <h3 className="font-semibold text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-3">
              폴더
            </h3>
            <ul className="space-y-0.5 text-sm">
              <li>
                <button
                  onClick={() => navigate("")}
                  className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors truncate ${
                    !currentPath
                      ? "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/50"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L11 7h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                  전체 자료
                </button>
              </li>
              {topFolders.map((folder) => (
                <li key={folder}>
                  <button
                    onClick={() => navigate(folder)}
                    className={`w-full text-left flex items-center gap-2 pl-5 pr-2.5 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 truncate transition-colors ${
                      currentPath === folder || currentPath.startsWith(folder + "/")
                        ? "text-blue-600 dark:text-blue-400 font-medium"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L11 7h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                    <span className="truncate">{folder}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {!index ? (
            <FolderSkeleton />
          ) : (
            <>
              {/* Folder grid */}
              {displayFolders.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                  {displayFolders.map((folder) => {
                    const fullPath = currentPath ? `${currentPath}/${folder}` : folder;
                    const count = index.files.filter(
                      (f) =>
                        f.folderPath === fullPath ||
                        f.folderPath.startsWith(fullPath + "/")
                    ).length;
                    return (
                      <button
                        key={folder}
                        onClick={() => navigate(fullPath)}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm transition-all flex items-center gap-3 group text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-950 transition-colors">
                          <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L11 7h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {folder}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-600 tabular-nums">
                            {count}개
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Files */}
              {(() => {
                const displayFiles = showAll ? allFilesHere : filesHere;
                const hasSubFiles = subFolders.length > 0 && allFilesHere.length > filesHere.length;
                return displayFiles.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400 dark:text-gray-600 tabular-nums">
                          파일 {displayFiles.length}개{showAll && allFilesHere.length !== filesHere.length && " (하위 포함)"}
                        </p>
                        {hasSubFiles && (
                          <button
                            onClick={() => setShowAll((v) => !v)}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                              showAll
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
                            }`}
                          >
                            하위 폴더 포함
                          </button>
                        )}
                      </div>
                      <SortSelect value={sort} />
                    </div>
                    <ul className="space-y-2.5">
                      {displayFiles.map((file) => (
                        <li key={file.id}>
                          <FileCard
                            file={file}
                            isNew={isAfter(parseISO(file.modifiedTime), twoWeeksAgo)}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                ) : displayFolders.length > 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400 dark:text-gray-600 mb-2">
                      이 폴더에 직접 있는 파일이 없습니다
                    </p>
                    {allFilesHere.length > 0 && (
                      <button
                        onClick={() => setShowAll(true)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        하위 폴더 파일 {allFilesHere.length}개 모두 보기 →
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 dark:text-gray-600 text-sm py-10 text-center">
                    이 폴더에 파일이 없습니다.
                  </p>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
