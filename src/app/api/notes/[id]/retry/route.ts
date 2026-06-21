import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startTranscription } from "@/lib/transcription/start";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // budget for the post-response transcription (after())

// Re-transcribe a note's audio with the default engine. For an un-edited note the fresh transcript
// replaces the body (the common "the auto transcript was bad" case); a hand-edited note keeps its
// text — the `edited` guard lives in the worker (applyToNote), so we don't touch it here.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!note.recordingId) {
    return NextResponse.json({ error: "Note has no audio to retry" }, { status: 400 });
  }

  const result = await startTranscription(note.recordingId, {});
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await prisma.note.update({ where: { id }, data: { status: "transcribing" } });

  return NextResponse.json({ ok: true }, { status: 202 });
}
