"use client";
import { useFavorites } from "@/hooks/useFavorites";
import FileCard from "./FileCard";
import type { DriveFile } from "@/lib/types";

interface Props {
  allFiles: DriveFile[];
}

export default function FavoritesList({ allFiles }: Props) {
  const { ids } = useFavorites();

  const favorites = ids
    .map((id) => allFiles.find((f) => f.id === id))
    .filter((f): f is DriveFile => !!f);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">즐겨찾기</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          파일 카드의 별표를 눌러 즐겨찾기에 추가하세요. 브라우저에 저장됩니다.
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <p className="font-medium text-gray-600 dark:text-gray-400 mb-1">즐겨찾기가 없습니다</p>
          <p className="text-sm">파일 카드 우측 상단의 ☆ 를 눌러 추가하세요</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 dark:text-gray-600 mb-4 tabular-nums">
            {favorites.length}개 저장됨
          </p>
          <ul className="space-y-2.5">
            {favorites.map((file) => (
              <li key={file.id}>
                <FileCard file={file} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
