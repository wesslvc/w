import { unstable_cache } from "next/cache";
import { listFilesRecursive } from "./drive";
import type { DriveIndex, DriveFile, UpdateHistory } from "./types";

async function fetchDriveIndex(): Promise<DriveIndex> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const folderId = process.env.DRIVE_FOLDER_ID;

  if (!apiKey || !folderId) {
    return { syncedAt: "", totalFiles: 0, files: [] };
  }

  const now = new Date().toISOString();
  const rawFiles = await listFilesRecursive(folderId, apiKey);

  const files: DriveFile[] = rawFiles.map(({ file, folderPath }) => ({
    id: file.id,
    // Normalize Korean text to NFC. macOS/Drive can store names as NFD, which
    // looks identical but compares unequal — that made some files appear in
    // search yet vanish from their folder (folderPath !== currentPath).
    name: file.name.normalize("NFC"),
    mimeType: file.mimeType,
    folderId: file.parents?.[0] ?? "",
    folderPath: folderPath.normalize("NFC"),
    createdTime: file.createdTime ?? now,
    modifiedTime: file.modifiedTime ?? now,
    size: file.size ? parseInt(file.size) : undefined,
    webViewLink: file.webViewLink ?? "",
    thumbnailLink: file.thumbnailLink,
  }));

  return { syncedAt: now, totalFiles: files.length, files };
}

// Cache for 5 minutes — reduces Drive API traversal frequency
export const getCachedIndex = unstable_cache(fetchDriveIndex, ["drive-index"], {
  revalidate: 300,
});

// Updates feed: derived from createdTime (newest files first, no separate log needed)
export function deriveUpdates(index: DriveIndex): UpdateHistory {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30); // show last 30 days

  const recent = index.files
    .filter((f) => new Date(f.createdTime) >= cutoff)
    .sort((a, b) => b.createdTime.localeCompare(a.createdTime))
    .slice(0, 100);

  return {
    lastCheckedAt: index.syncedAt,
    updates: recent.map((f) => ({
      id: f.id,
      fileId: f.id,
      fileName: f.name,
      folderPath: f.folderPath,
      type: "new" as const,
      detectedAt: f.createdTime,
      webViewLink: f.webViewLink,
    })),
  };
}

