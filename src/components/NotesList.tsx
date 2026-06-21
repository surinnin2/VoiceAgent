"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoryDTO, NoteDTO } from "@/lib/dto";
import { formatDuration } from "@/lib/ui";

function preview(n: NoteDTO): string {
  if (n.title) return n.title;
  const body = n.body.trim();
  if (body) return body.length > 60 ? `${body.slice(0, 57)}…` : body;
  return n.status === "transcribing" ? "Transcribing…" : "Empty note";
}

export function NotesList() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [pending, setPending] = useState<NoteDTO | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [n, c] = await Promise.all([
      fetch("/api/notes").then((r) => r.json()).catch(() => ({ notes: [] })),
      fetch("/api/categories").then((r) => r.json()).catch(() => ({ categories: [] })),
    ]);
    setNotes(n.notes ?? []);
    setCategories(c.categories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh while anything is still transcribing so the list settles on its own.
  const hasPending = notes.some((n) => n.status === "transcribing");
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [hasPending, load]);

  function startDelete(note: NoteDTO) {
    setMenuId(null);
    setMoveId(null);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    setPending(note);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      void fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      setPending(null);
    }, 5000);
  }

  function undoDelete() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (pending) setNotes((prev) => [pending, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setPending(null);
  }

  async function move(note: NoteDTO, categoryId: string) {
    setMoveId(null);
    setMenuId(null);
    const cat = categories.find((c) => c.id === categoryId) ?? null;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === note.id
          ? { ...n, categoryId, category: cat ? { id: cat.id, name: cat.name, color: cat.color } : n.category }
          : n,
      ),
    );
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
  }

  if (loading) return <p className="subtle">Loading…</p>;

  if (notes.length === 0 && !pending) {
    return <p className="empty">No notes yet — record one from the Capture tab.</p>;
  }

  // Group notes under their categories, in category order.
  const groups = categories
    .map((c) => ({ category: c, items: notes.filter((n) => n.categoryId === c.id) }))
    .filter((g) => g.items.length > 0);
  // Any note whose category isn't in the list (shouldn't happen) falls into a trailing group.
  const grouped = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
  const orphans = notes.filter((n) => !grouped.has(n.id));

  function rows(items: NoteDTO[]) {
    return items.map((n) => (
      <li key={n.id} className={`note-row${menuId === n.id ? " open" : ""}`}>
        <button className="note-main" onClick={() => router.push(`/notes/${n.id}`)}>
          <span className="note-title">{preview(n)}</span>
          <span className="note-meta">
            {n.status === "transcribing" && <span className="pill amber">transcribing…</span>}
            {n.status === "error" && <span className="pill red">failed</span>}
            {n.durationMs ? <span className="subtle">{formatDuration(n.durationMs)}</span> : null}
            <span className="subtle">{new Date(n.createdAt).toLocaleDateString()}</span>
          </span>
        </button>
        <button
          className="note-kebab"
          aria-label="Note actions"
          onClick={() => {
            setMenuId(menuId === n.id ? null : n.id);
            setMoveId(null);
          }}
        >
          ⋯
        </button>

        {menuId === n.id && (
          <div className="note-actions">
            {moveId === n.id ? (
              <div className="move-chips">
                {categories.map((c) => (
                  <button key={c.id} className="chip" onClick={() => void move(n, c.id)} disabled={c.id === n.categoryId}>
                    {c.name}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <button onClick={() => setMoveId(n.id)}>Move to…</button>
                <button className="danger" onClick={() => startDelete(n)}>Delete</button>
              </>
            )}
          </div>
        )}
      </li>
    ));
  }

  return (
    <>
      {groups.map((g) => (
        <section key={g.category.id} className="note-group">
          <h2 className="group-head" style={g.category.color ? { color: g.category.color } : undefined}>
            {g.category.name}
          </h2>
          <ul className="note-list">{rows(g.items)}</ul>
        </section>
      ))}
      {orphans.length > 0 && (
        <section className="note-group">
          <h2 className="group-head">Other</h2>
          <ul className="note-list">{rows(orphans)}</ul>
        </section>
      )}

      {pending && (
        <div className="snackbar">
          <span>Note deleted</span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}
    </>
  );
}
