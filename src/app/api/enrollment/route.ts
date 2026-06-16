import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Single-user app: one enrollment row keyed by a fixed id.
const ID = "default";

export async function GET() {
  const enrollment = await prisma.enrollment.findUnique({ where: { id: ID } });
  return NextResponse.json({ enrollment });
}

// Save consent + the ElevenLabs Speaker Library name to match ("me").
// A voiceprint reference is biometric data, so consent is mandatory and we store only the
// library label — never raw enrollment audio.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    speakerLabel?: string | null;
    label?: string;
    consentGiven?: boolean;
  };

  if (body.consentGiven !== true) {
    return NextResponse.json(
      { error: "Consent is required to store a voiceprint reference." },
      { status: 400 },
    );
  }

  const speakerLabel =
    typeof body.speakerLabel === "string" && body.speakerLabel.trim()
      ? body.speakerLabel.trim()
      : null;
  const label =
    typeof body.label === "string" && body.label.trim() ? body.label.trim() : "Me";
  const now = new Date();

  const enrollment = await prisma.enrollment.upsert({
    where: { id: ID },
    create: {
      id: ID,
      label,
      speakerLabel,
      provider: "elevenlabs",
      consentGiven: true,
      consentAt: now,
    },
    update: { label, speakerLabel, consentGiven: true, consentAt: now },
  });

  return NextResponse.json({ enrollment });
}

export async function DELETE() {
  await prisma.enrollment.deleteMany({ where: { id: ID } });
  return NextResponse.json({ ok: true });
}
