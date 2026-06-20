/**
 * Drive Sync Script
 * Usage: npm run sync
 * Requires env vars: GOOGLE_API_KEY, DRIVE_FOLDER_ID
 *
 * What it does:
 * 1. Fetches all files recursively from the Drive folder
 * 2. Extracts PDF text (if PDF text extraction is enabled via EXTRACT_PDF=true)
 * 3. Diffs against the previous index to find new/modified files
 * 4. Writes data/index.json and appends to data/updates.json
 */

import fs from "fs";
import path from "path";
import { listFilesRecursive } from "../lib/drive";
import type { DriveFile, DriveIndex, UpdateHistory, UpdateLog } from "../lib/types";

// Load .env.local for local development
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const DATA_DIR = path.join(process.cwd(), "data");
const INDEX_PATH = path.join(DATA_DIR, "index.json");
const UPDATES_PATH = path.join(DATA_DIR, "updates.json");

const API_KEY = process.env.GOOGLE_API_KEY;
const FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const EXTRACT_PDF = process.env.EXTRACT_PDF === "true";

async function extractPdfText(webViewLink: string): Promise<string | undefined> {
  // PDF text extraction requires downloading the file — only works for non-Google-native files
  // For now, we attempt to get the export URL for Drive files
  try {
    const { default: pdfParse } = await import("pdf-parse");
    // Convert view link to direct download
    const fileId = webViewLink.match(/\/d\/([^/]+)/)?.[1];
    if (!fileId) return undefined;

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) return undefined;

    const buffer = Buffer.from(await res.arrayBuffer());
    const result = await pdfParse(buffer);
    // Limit text to 10000 chars for index size
    return result.text.slice(0, 10_000).replace(/\s+/g, " ").trim();
  } catch {
    return undefined;
  }
}

async function main() {
  if (!API_KEY || !FOLDER_ID) {
    console.error(
      "Missing required env vars: GOOGLE_API_KEY, DRIVE_FOLDER_ID\n" +
      "Set them in .env.local or as GitHub Actions secrets."
    );
    process.exit(1);
  }

  console.log("Fetching file list from Google Drive…");
  const rawFiles = await listFilesRecursive(FOLDER_ID, API_KEY);
  console.log(`Found ${rawFiles.length} files`);

  // Load previous index for comparison
  let prevIndex: DriveIndex = { syncedAt: "", totalFiles: 0, files: [] };
  if (fs.existsSync(INDEX_PATH)) {
    prevIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  }
  const prevMap = new Map(prevIndex.files.map((f) => [f.id, f]));

  const newUpdates: UpdateLog[] = [];
  const now = new Date().toISOString();

  // Build new file list
  const newFiles: DriveFile[] = [];
  for (const { file, folderPath } of rawFiles) {
    const prev = prevMap.get(file.id);

    let fullText: string | undefined;
    if (EXTRACT_PDF && file.mimeType === "application/pdf" && file.webViewLink) {
      // Reuse existing text if file hasn't changed
      if (prev?.fullText && prev.modifiedTime === file.modifiedTime) {
        fullText = prev.fullText;
      } else {
        console.log(`  Extracting text: ${file.name}`);
        fullText = await extractPdfText(file.webViewLink ?? "");
      }
    } else if (prev?.fullText) {
      fullText = prev.fullText;
    }

    const driveFile: DriveFile = {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      folderId: file.parents?.[0] ?? "",
      folderPath,
      createdTime: file.createdTime ?? now,
      modifiedTime: file.modifiedTime ?? now,
      size: file.size ? parseInt(file.size) : undefined,
      webViewLink: file.webViewLink ?? "",
      thumbnailLink: file.thumbnailLink,
      fullText,
    };

    newFiles.push(driveFile);

    // Detect changes
    if (!prev) {
      newUpdates.push({
        id: `upd_${Date.now()}_${file.id}`,
        fileId: file.id,
        fileName: file.name,
        folderPath,
        type: "new",
        detectedAt: now,
        webViewLink: file.webViewLink ?? "",
      });
    } else if (prev.modifiedTime !== file.modifiedTime) {
      newUpdates.push({
        id: `upd_${Date.now()}_${file.id}`,
        fileId: file.id,
        fileName: file.name,
        folderPath,
        type: "modified",
        detectedAt: now,
        webViewLink: file.webViewLink ?? "",
      });
    }
  }

  // Write new index
  const newIndex: DriveIndex = {
    syncedAt: now,
    totalFiles: newFiles.length,
    files: newFiles,
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(newIndex, null, 2));
  console.log(`Index saved: ${newFiles.length} files`);

  // Append new updates
  let history: UpdateHistory = { lastCheckedAt: "", updates: [] };
  if (fs.existsSync(UPDATES_PATH)) {
    history = JSON.parse(fs.readFileSync(UPDATES_PATH, "utf-8"));
  }
  history.lastCheckedAt = now;
  history.updates = [...newUpdates, ...history.updates].slice(0, 500); // keep last 500
  fs.writeFileSync(UPDATES_PATH, JSON.stringify(history, null, 2));
  console.log(`Updates: ${newUpdates.length} new changes detected`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
