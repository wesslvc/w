"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface SearchBarProps {
  defaultQuery?: string;
  defaultMode?: "filename" | "fulltext";
  autoFocus?: boolean;
  large?: boolean;
}

export default function SearchBar({
  defaultQuery = "",
  defaultMode = "filename",
  autoFocus = false,
  large = false,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const [mode, setMode] = useState<"filename" | "fulltext">(defaultMode);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", query.trim());
    params.set("mode", mode);
    params.delete("page");
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`flex items-center gap-2 bg-white border-2 border-gray-200 rounded-xl shadow-sm focus-within:border-blue-500 transition-colors ${large ? "px-5 py-4" : "px-4 py-2.5"}`}
      >
        <svg
          className={`text-gray-400 flex-shrink-0 ${large ? "w-6 h-6" : "w-5 h-5"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="파일명 또는 내용으로 검색…"
          className={`flex-1 outline-none bg-transparent text-gray-800 placeholder-gray-400 ${large ? "text-lg" : "text-sm"}`}
        />
        <button
          type="submit"
          className={`bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex-shrink-0 ${large ? "px-5 py-2 text-base" : "px-4 py-1.5 text-sm"}`}
        >
          검색
        </button>
      </div>

      {/* Search mode toggle */}
      <div className="mt-2 flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
          <input
            type="radio"
            name="mode"
            value="filename"
            checked={mode === "filename"}
            onChange={() => setMode("filename")}
            className="accent-blue-600"
          />
          파일명 검색 <span className="text-gray-400">(빠름)</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
          <input
            type="radio"
            name="mode"
            value="fulltext"
            checked={mode === "fulltext"}
            onChange={() => setMode("fulltext")}
            className="accent-blue-600"
          />
          본문 검색
        </label>
        {mode === "fulltext" && (
          <span className="text-amber-600 text-xs flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            본문 검색은 처리 시간이 다소 걸릴 수 있습니다
          </span>
        )}
      </div>
    </form>
  );
}
