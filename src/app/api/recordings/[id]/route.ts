import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const recording = await prisma.recording.findUnique({
    where: { id },
    include: { attempts: { orderBy: { createdAt: "desc" } } },
  });
  if (!recording) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ recording });
}
