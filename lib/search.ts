import Fuse from "fuse.js";
import type { DriveFile } from "./types";

export interface SearchOptions {
  mode: "filename" | "fulltext";
  query: string;
  mimeTypeFilter?: string;
  folderFilter?: string;
  limit?: number;
}

export interface SearchResult {
  file: DriveFile;
  score: number;
  matchedIn: "filename" | "folderPath" | "fullText";
  snippet?: string; // short excerpt for full-text match
}

function extractSnippet(text: string, query: string, contextChars = 100): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, contextChars * 2) + "…";
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + query.length + contextChars);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export function searchFiles(files: DriveFile[], options: SearchOptions): SearchResult[] {
  const { query, mode, mimeTypeFilter, folderFilter, limit = 50 } = options;

  if (!query.trim()) return [];

  let pool = files;

  if (mimeTypeFilter) {
    pool = pool.filter((f) => f.mimeType === mimeTypeFilter);
  }
  if (folderFilter) {
    pool = pool.filter((f) => f.folderPath.startsWith(folderFilter));
  }

  if (mode === "filename") {
    const fuse = new Fuse(pool, {
      keys: [
        { name: "name", weight: 0.7 },
        { name: "folderPath", weight: 0.3 },
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
    });

    return fuse
      .search(query, { limit })
      .map((r) => ({
        file: r.item,
        score: r.score ?? 1,
        matchedIn: "filename" as const,
      }));
  }

  // Full-text search
  const fuseFullText = new Fuse(pool, {
    keys: [
      { name: "name", weight: 0.4 },
      { name: "folderPath", weight: 0.1 },
      { name: "fullText", weight: 0.5 },
    ],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
  });

  return fuseFullText
    .search(query, { limit })
    .map((r) => {
      const matchedIn =
        r.item.fullText?.toLowerCase().includes(query.toLowerCase())
          ? ("fullText" as const)
          : ("filename" as const);
      return {
        file: r.item,
        score: r.score ?? 1,
        matchedIn,
        snippet:
          matchedIn === "fullText" && r.item.fullText
            ? extractSnippet(r.item.fullText, query)
            : undefined,
      };
    });
}

export function getMimeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.google-apps.document": "Google 문서",
    "application/vnd.google-apps.spreadsheet": "Google 스프레드시트",
    "application/vnd.google-apps.presentation": "Google 프레젠테이션",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
    "image/jpeg": "이미지",
    "image/png": "이미지",
  };
  return map[mimeType] ?? "파일";
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
