// Google Drive API v3 helper (uses API Key — no OAuth needed for public folders)

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export interface DriveApiFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

export async function listAllFiles(
  folderId: string,
  apiKey: string
): Promise<DriveApiFile[]> {
  const results: DriveApiFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      key: apiKey,
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "nextPageToken,files(id,name,mimeType,parents,createdTime,modifiedTime,size,webViewLink,thumbnailLink)",
      pageSize: "1000",
      ...(pageToken ? { pageToken } : {}),
    });

    const res = await fetch(`${DRIVE_API}/files?${params}`);
    if (!res.ok) throw new Error(`Drive API error: ${res.status} ${await res.text()}`);

    const data = (await res.json()) as {
      nextPageToken?: string;
      files: DriveApiFile[];
    };

    results.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

// Recursively list all files — fetches all subfolders in parallel to stay
// well within Vercel's function timeout even for large folder trees.
export async function listFilesRecursive(
  rootFolderId: string,
  apiKey: string,
  folderPath = ""
): Promise<{ file: DriveApiFile; folderPath: string }[]> {
  const items = await listAllFiles(rootFolderId, apiKey);

  const folders = items.filter(
    (f) => f.mimeType === "application/vnd.google-apps.folder"
  );
  const files = items.filter(
    (f) => f.mimeType !== "application/vnd.google-apps.folder"
  );

  const result: { file: DriveApiFile; folderPath: string }[] = files.map((f) => ({
    file: f,
    folderPath,
  }));

  // Fetch all subfolders in parallel instead of sequentially
  const subResults = await Promise.all(
    folders.map((folder) => {
      const subPath = folderPath ? `${folderPath}/${folder.name}` : folder.name;
      return listFilesRecursive(folder.id, apiKey, subPath);
    })
  );

  for (const sub of subResults) {
    result.push(...sub);
  }

  return result;
}
