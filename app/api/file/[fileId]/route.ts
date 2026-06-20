import { NextRequest, NextResponse } from "next/server";

// Edge runtime: better streaming, no 10s timeout on Vercel hobby plan
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const apiKey = process.env.GOOGLE_API_KEY;

  const range = req.headers.get("range");
  const fetchHeaders: Record<string, string> = {};
  if (range) fetchHeaders["Range"] = range;

  // Primary: Drive API v3 with API key (fastest, supports range requests)
  // Fallback: usercontent download URL (works for public files without API key)
  const urls = [
    apiKey
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${apiKey}`
      : null,
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
  ].filter(Boolean) as string[];

  let lastError = "";
  for (const url of urls) {
    let res: Response;
    try {
      res = await fetch(url, { headers: fetchHeaders });
    } catch (e) {
      lastError = String(e);
      continue;
    }

    // Skip HTML error pages (Drive returns 200 HTML for auth errors sometimes)
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok && res.status !== 206) {
      lastError = `HTTP ${res.status}`;
      continue;
    }
    if (ct.includes("text/html")) {
      lastError = "Received HTML instead of file (auth error?)";
      continue;
    }

    const responseHeaders = new Headers();
    for (const h of ["content-type", "content-length", "content-range", "last-modified", "etag"]) {
      const v = res.headers.get(h);
      if (v) responseHeaders.set(h, v);
    }
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, max-age=3600");
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  }

  return new NextResponse(`File not accessible: ${lastError}`, { status: 502 });
}
