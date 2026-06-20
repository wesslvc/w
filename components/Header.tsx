import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg text-blue-600 hover:text-blue-700">
          자료 통합 검색
        </Link>
        <nav className="flex gap-6 text-sm text-gray-600">
          <Link href="/browse" className="hover:text-blue-600">
            폴더 탐색
          </Link>
          <Link href="/updates" className="hover:text-blue-600">
            업데이트 내역
          </Link>
        </nav>
      </div>
    </header>
  );
}
