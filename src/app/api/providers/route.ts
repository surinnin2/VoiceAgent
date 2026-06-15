import { NextResponse } from "next/server";
import { getDefaultProviderId, listProviders } from "@/lib/transcription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    providers: listProviders(),
    defaultProviderId: getDefaultProviderId(),
  });
}
