import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureCategoriesSeeded } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureCategoriesSeeded();
  const categories = await prisma.category.findMany({
    orderBy: [{ isInbox: "desc" }, { position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { notes: true } } },
  });
  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isInbox: c.isInbox,
      position: c.position,
      createdAt: c.createdAt,
      noteCount: c._count.notes,
    })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; color?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  if (name.length > 40) {
    return NextResponse.json({ error: "Category name is too long" }, { status: 400 });
  }

  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ category: existing }, { status: 200 });

  const color =
    typeof body.color === "string" && /^#[0-9a-fA-F]{3,6}$/.test(body.color) ? body.color : null;

  const max = await prisma.category.aggregate({ _max: { position: true } });
  const category = await prisma.category.create({
    data: { name, color, position: (max._max.position ?? 0) + 1 },
  });
  return NextResponse.json({ category }, { status: 201 });
}
