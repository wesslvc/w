import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "자료 통합 검색",
  description: "구글드라이브 아카이브 통합 검색 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        <footer className="border-t border-gray-200 mt-16 py-6 text-center text-sm text-gray-400">
          자료 통합 검색 &mdash; 구글드라이브 아카이브
        </footer>
      </body>
    </html>
  );
}
