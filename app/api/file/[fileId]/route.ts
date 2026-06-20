import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return new NextResponse("No API key configured", { status: 500 });

  const range = req.headers.get("range");
  const fetchHeaders: Record<string, string> = {};
  if (range) fetchHeaders["Range"] = range;

  const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(driveUrl, { headers: fetchHeaders });
  } catch {
    return new NextResponse("Failed to fetch from Drive", { status: 502 });
  }

  if (!res.ok && res.status !== 206) {
    return new NextResponse(`Drive API error: ${res.status}`, { status: res.status });
  }

  const responseHeaders = new Headers();
  const copyHeaders = ["content-type", "content-length", "content-range", "last-modified", "etag"];
  for (const h of copyHeaders) {
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
