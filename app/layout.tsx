import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "은성아카이브 자료찾기",
  description: "은성아카이브 자료 통합 검색 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Header />
          <main className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-8">
            {children}
          </main>
          <footer className="hidden md:block border-t border-gray-200 dark:border-gray-800 mt-16 py-6 text-center text-sm text-gray-400 dark:text-gray-600">
            은성아카이브 자료찾기
          </footer>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
