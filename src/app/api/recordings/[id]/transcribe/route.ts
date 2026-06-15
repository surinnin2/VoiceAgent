import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDefaultProviderId, getProvider } from "@/lib/transcription";
import { processAttempt } from "@/lib/transcription/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const recording = await prisma.recording.findUnique({ where: { id } });
  if (!recording) return NextResponse.json({ error: "Recording not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    provider?: string;
    keyterms?: unknown;
    contextPrompt?: unknown;
  };

  const providerId = body.provider || getDefaultProviderId();
  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 });
  }
  if (!provider.isAvailable()) {
    return NextResponse.json(
      { error: `${provider.label} is not configured — add its API key to .env` },
      { status: 400 },
    );
  }

  const keyterms = Array.isArray(body.keyterms)
    ? body.keyterms.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim())
    : [];
  const contextPrompt =
    typeof body.contextPrompt === "string" ? body.contextPrompt.trim() : "";

  const attempt = await prisma.transcriptionAttempt.create({
    data: {
      recordingId: recording.id,
      provider: provider.id,
      model: provider.model,
      status: "queued",
      languageCode: "en",
      keyterms: keyterms.length ? JSON.stringify(keyterms) : null,
      contextPrompt: contextPrompt || null,
    },
  });

  // Fire-and-forget: process in the background and let the client poll the attempt.
  void processAttempt(attempt.id);

  return NextResponse.json({ attempt }, { status: 202 });
}
