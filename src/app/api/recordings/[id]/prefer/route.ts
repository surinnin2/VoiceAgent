import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Star (or un-star) the attempt the user judges best.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { attemptId?: string | null };
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : null;

  const recording = await prisma.recording.update({
    where: { id },
    data: { preferredAttemptId: attemptId },
  });
  return NextResponse.json({ recording });
}
