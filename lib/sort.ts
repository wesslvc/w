import type { DriveFile } from "./types";
import type { SortKey } from "@/components/SortSelect";

export function sortFiles(files: DriveFile[], sort: SortKey): DriveFile[] {
  return [...files].sort((a, b) => {
    switch (sort) {
      case "name-asc":
        return a.name.localeCompare(b.name, "ko");
      case "name-desc":
        return b.name.localeCompare(a.name, "ko");
      case "date-desc":
        return b.modifiedTime.localeCompare(a.modifiedTime);
      case "date-asc":
        return a.modifiedTime.localeCompare(b.modifiedTime);
      case "size-desc":
        return (b.size ?? 0) - (a.size ?? 0);
      case "size-asc":
        return (a.size ?? 0) - (b.size ?? 0);
    }
  });
}

export function parseSortKey(raw: string | null | undefined): SortKey {
  const valid: SortKey[] = ["name-asc", "name-desc", "date-desc", "date-asc", "size-desc", "size-asc"];
  return valid.includes(raw as SortKey) ? (raw as SortKey) : "date-desc";
}
