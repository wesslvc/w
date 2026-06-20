"use client";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";

export default function Header() {
  const { theme, toggle } = useTheme();

  return (
    <header className="bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-base text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 tracking-tight"
        >
          은성아카이브 자료찾기
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          {[
            { href: "/", label: "홈" },
            { href: "/browse", label: "폴더 탐색" },
            { href: "/updates", label: "업데이트" },
            { href: "/favorites", label: "즐겨찾기" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          onClick={toggle}
          aria-label="다크모드 전환"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
        >
          {theme === "dark" ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
