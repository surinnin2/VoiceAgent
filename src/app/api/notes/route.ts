import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { NoteDTO } from "@/lib/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const notes = await prisma.note.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { id: true, name: true, color: true } },
      recording: { select: { durationMs: true } },
    },
  });

  const dto: NoteDTO[] = notes.map((n) => ({
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
  }));

  return NextResponse.json({ notes: dto });
}
