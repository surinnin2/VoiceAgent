import { prisma } from "@/lib/db";

// Preset categories created on first run so capture works immediately. "Inbox" is the
// always-present default bucket — capture never blocks on a category choice.
const SEED: { name: string; isInbox?: boolean; color?: string; position: number }[] = [
  { name: "Inbox", isInbox: true, color: "#9aa3b2", position: 0 },
  { name: "Ideas", color: "#5b8cff", position: 1 },
  { name: "Tasks", color: "#3fb950", position: 2 },
];

// Once we've confirmed categories exist in this process, skip the COUNT on every request.
let seeded = false;

/** Create the preset categories the first time the app is used (idempotent). */
export async function ensureCategoriesSeeded(): Promise<void> {
  if (seeded) return;
  const count = await prisma.category.count();
  if (count > 0) {
    seeded = true;
    return;
  }
  for (const c of SEED) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, isInbox: c.isInbox ?? false, color: c.color, position: c.position },
    });
  }
  seeded = true;
}

/** The Inbox category id, creating it if it somehow doesn't exist. */
export async function getInboxId(): Promise<string> {
  const inbox =
    (await prisma.category.findFirst({ where: { isInbox: true } })) ??
    (await prisma.category.findFirst({ orderBy: { position: "asc" } }));
  if (inbox) return inbox.id;
  const created = await prisma.category.create({
    data: { name: "Inbox", isInbox: true, color: "#9aa3b2", position: 0 },
  });
  return created.id;
}

/** Validate a requested category id, falling back to Inbox when missing/unknown. */
export async function resolveCategoryId(requested?: string | null): Promise<string> {
  if (requested) {
    const found = await prisma.category.findUnique({ where: { id: requested } });
    if (found) return found.id;
  }
  return getInboxId();
}
