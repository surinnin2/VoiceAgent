import { NextResponse } from "next/server";
import { startTranscription } from "@/lib/transcription/start";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    provider?: string;
    keyterms?: unknown;
    contextPrompt?: unknown;
    onlyMyVoice?: boolean;
  };

  const result = await startTranscription(id, {
    provider: typeof body.provider === "string" ? body.provider : undefined,
    keyterms: Array.isArray(body.keyterms) ? (body.keyterms as string[]) : [],
    contextPrompt: typeof body.contextPrompt === "string" ? body.contextPrompt : "",
    onlyMyVoice: body.onlyMyVoice === true,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ attemptId: result.attemptId }, { status: 202 });
}
