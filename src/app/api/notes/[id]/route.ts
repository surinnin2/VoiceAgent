import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteAudio } from "@/lib/storage";
import type { NoteDTO } from "@/lib/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const n = await prisma.note.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, color: true } },
      recording: { select: { durationMs: true } },
    },
  });
  if (!n) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dto: NoteDTO = {
    id: n.id,
    title: n.title,
    body: n.body,
    edited: n.edited,
    status: n.status,
    categoryId: n.categoryId,
    recordingId: n.recordingId,
    durationMs: n.recording?.durationMs ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    category: n.category,
  };
  return NextResponse.json({ note: dto });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    title?: unknown;
    body?: unknown;
    categoryId?: unknown;
  };

  const data: { title?: string | null; body?: string; edited?: boolean; categoryId?: string } = {};

  if (typeof body.title === "string") {
    if (body.title.length > 200) {
      return NextResponse.json({ error: "Title too long" }, { status: 400 });
    }
    data.title = body.title.trim() || null;
  }

  if (typeof body.body === "string") {
    if (body.body.length > 100_000) {
      return NextResponse.json({ error: "Note is too long" }, { status: 400 });
    }
    data.body = body.body;
    // A manual edit blocks the transcription worker from overwriting the note text.
    if (body.body !== existing.body) data.edited = true;
  }

  if (typeof body.categoryId === "string") {
    const cat = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!cat) return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    data.categoryId = cat.id;
  }

  const note = await prisma.note.update({ where: { id }, data });
  return NextResponse.json({ note });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const note = await prisma.note.findUnique({
    where: { id },
    include: { recording: true },
  });
  if (!note) return NextResponse.json({ ok: true });

  // Delete the note first (it FKs the recording), then the recording (cascades attempts),
  // then the audio bytes — so nothing is orphaned.
  await prisma.note.delete({ where: { id } });
  if (note.recording) {
    await prisma.recording.delete({ where: { id: note.recording.id } }).catch(() => {});
    if (note.recording.storagePath) {
      await deleteAudio(note.recording.storagePath).catch(() => {});
    }
  }
  return NextResponse.json({ ok: true });
}
