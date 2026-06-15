import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readAudio } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const recording = await prisma.recording.findUnique({ where: { id } });
  if (!recording || !recording.storagePath) {
    return new NextResponse("Not found", { status: 404 });
  }
  const buf = await readAudio(recording.storagePath);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": recording.mimeType,
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
