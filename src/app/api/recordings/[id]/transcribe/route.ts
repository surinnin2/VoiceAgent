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
    onlyMyVoice?: boolean;
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

  const onlyMyVoice = body.onlyMyVoice === true;
  if (onlyMyVoice && !provider.supportsDiarization) {
    return NextResponse.json(
      { error: `${provider.label} does not support "only my voice" (no diarization).` },
      { status: 400 },
    );
  }
  // If enrolled (consent + a Speaker Library name) and the engine can match it, target that
  // speaker so matching recordings auto-filter to you. Otherwise we just diarize and let the
  // user pick their speaker.
  let enrolledSpeaker: string | null = null;
  if (onlyMyVoice && provider.supportsSpeakerLibrary) {
    const enrollment = await prisma.enrollment.findUnique({ where: { id: "default" } });
    if (enrollment?.consentGiven && enrollment.speakerLabel) {
      enrolledSpeaker = enrollment.speakerLabel;
    }
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
      diarized: onlyMyVoice,
      onlyEnrolledSpeaker: onlyMyVoice,
      enrolledSpeaker,
    },
  });

  // Fire-and-forget: process in the background and let the client poll the attempt.
  void processAttempt(attempt.id);

  return NextResponse.json({ attempt }, { status: 202 });
}
