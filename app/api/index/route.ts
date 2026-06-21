import { getCachedIndex } from "@/lib/fetchIndex";
import { NextResponse } from "next/server";

// Edge runtime: no 10-second function timeout (Vercel hobby serverless limit)
export const runtime = "edge";
export const revalidate = 300;

export async function GET() {
  const index = await getCachedIndex();
  return NextResponse.json(index, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
