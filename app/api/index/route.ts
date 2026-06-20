import { getCachedIndex } from "@/lib/fetchIndex";
import { NextResponse } from "next/server";

export const revalidate = 60;

export async function GET() {
  const index = await getCachedIndex();
  return NextResponse.json(index, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
