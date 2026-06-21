import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveAudio } from "@/lib/storage";
import { resolveCategoryId } from "@/lib/categories";
import { startTranscription } from "@/lib/transcription/start";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const recordings = await prisma.recording.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { attempts: true } } },
  });
  return NextResponse.json({ recordings });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'audio' file" }, { status: 400 });
  }

  const durationRaw = form.get("durationMs");
  const durationMs =
    typeof durationRaw === "string" ? Number.parseInt(durationRaw, 10) || null : null;

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: "Empty audio" }, { status: 400 });
  }
  const mimeType = file.type || "audio/webm";

  const categoryRaw = form.get("categoryId");
  const categoryId = await resolveCategoryId(
    typeof categoryRaw === "string" ? categoryRaw : null,
  );

  // Create the row first to mint an id, then persist the bytes under that id.
  const recording = await prisma.recording.create({
    data: {
      filename: file.name || "recording",
      mimeType,
      storagePath: "",
      sizeBytes: buf.length,
      durationMs,
    },
  });
  const storagePath = await saveAudio(recording.id, mimeType, buf);
  const updated = await prisma.recording.update({
    where: { id: recording.id },
    data: { storagePath },
  });

  // The user-facing note. It starts "transcribing"; the worker fills body + title when done.
  const note = await prisma.note.create({
    data: { categoryId, recordingId: recording.id, status: "transcribing" },
  });

  // Auto-transcribe with the default engine — seamless, no extra tap. The recording + note are
  // already saved; if transcription can't even start (e.g. no provider configured), mark the note
  // errored rather than leaving it stuck "transcribing" with no retry affordance.
  const tx = await startTranscription(recording.id, {});
  if (!tx.ok) {
    await prisma.note.update({ where: { id: note.id }, data: { status: "error" } });
    note.status = "error";
  }

  return NextResponse.json({ recording: updated, note }, { status: 201 });
}
