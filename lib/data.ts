import path from "path";
import fs from "fs";
import type { DriveIndex, UpdateHistory } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

export function loadIndex(): DriveIndex {
  const filePath = path.join(DATA_DIR, "index.json");
  if (!fs.existsSync(filePath)) {
    return { syncedAt: "", totalFiles: 0, files: [] };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as DriveIndex;
}

export function loadUpdates(): UpdateHistory {
  const filePath = path.join(DATA_DIR, "updates.json");
  if (!fs.existsSync(filePath)) {
    return { lastCheckedAt: "", updates: [] };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as UpdateHistory;
}
