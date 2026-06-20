export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  folderId: string;
  folderPath: string; // e.g. "자료실/2024/정책자료"
  createdTime: string; // ISO 8601
  modifiedTime: string; // ISO 8601
  size?: number; // bytes
  webViewLink: string;
  thumbnailLink?: string;
  fullText?: string; // extracted PDF text (optional)
}

export interface UpdateLog {
  id: string;
  fileId: string;
  fileName: string;
  folderPath: string;
  type: "new" | "modified";
  detectedAt: string; // ISO 8601
  webViewLink: string;
}

export interface DriveIndex {
  syncedAt: string;
  totalFiles: number;
  files: DriveFile[];
}

export interface UpdateHistory {
  lastCheckedAt: string;
  updates: UpdateLog[];
}
