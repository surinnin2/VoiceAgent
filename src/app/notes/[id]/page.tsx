"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { CategoryDTO, NoteDTO } from "@/lib/dto";
import { formatDuration } from "@/lib/ui";

export default function NoteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [note, setNote] = useState<NoteDTO | null>(null);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  const fetchNote = useCallback(async () => {
    const res = await fetch(`/api/notes/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      return null;
    }
    const j = await res.json();
    const n = j.note as NoteDTO;
    setNote(n);
    // Don't stomp on in-progress edits when a poll lands.
    if (!dirtyRef.current) {
      setTitle(n.title ?? "");
      setBody(n.body ?? "");
    }
    return n;
  }, [id]);

  useEffect(() => {
    void fetchNote();
    fetch("/api/categories")
      .then((r) => r.json())
      .then((j) => setCategories(j.categories ?? []))
      .catch(() => {});
  }, [fetchNote]);

  // Poll while transcribing.
  const transcribing = note?.status === "transcribing";
  useEffect(() => {
    if (!transcribing) return;
    const t = setInterval(() => void fetchNote(), 1500);
    return () => clearInterval(t);
  }, [transcribing, fetchNote]);

  const save = useCallback(
    async (patch: { title?: string; body?: string; categoryId?: string }) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const j = await res.json().catch(() => ({}));
        if (j.note) setNote((cur) => (cur ? { ...cur, ...j.note } : cur));
        dirtyRef.current = false;
      } finally {
        setSaving(false);
      }
    },
    [id],
  );

  async function retry() {
    const res = await fetch(`/api/notes/${id}/retry`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Couldn't start a retry. Try again.");
      return; // don't flip to "transcribing" — keep the editable note accessible
    }
    dirtyRef.current = false;
    setNote((n) => (n ? { ...n, status: "transcribing" } : n));
    void fetchNote();
  }

  async function remove() {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    router.push("/notes");
  }

  if (notFound) {
    return (
      <main className="note-detail">
        <Link href="/notes" className="back">← Notes</Link>
        <p className="empty" style={{ marginTop: 16 }}>Note not found.</p>
      </main>
    );
  }
  if (!note) {
    return (
      <main className="note-detail">
        <p className="subtle">Loading…</p>
      </main>
    );
  }

  return (
    <main className="note-detail">
      <div className="detail-bar">
        <Link href="/notes" className="back">← Notes</Link>
        <span className="subtle">{saving ? "Saving…" : note.edited ? "Edited" : ""}</span>
      </div>

      <input
        className="title-input"
        value={title}
        placeholder="Untitled note"
        onChange={(e) => {
          dirtyRef.current = true;
          setTitle(e.target.value);
        }}
        onBlur={() => title !== (note.title ?? "") && save({ title })}
      />

      <div className="detail-meta">
        <select
          value={note.categoryId}
          onChange={(e) => void save({ categoryId: e.target.value })}
          aria-label="Category"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {note.durationMs ? <span className="subtle">{formatDuration(note.durationMs)}</span> : null}
        <span className="subtle">{new Date(note.createdAt).toLocaleString()}</span>
      </div>

      {note.recordingId && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={`/api/recordings/${note.recordingId}/audio`} />
      )}

      {note.status === "transcribing" ? (
        <p className="transcribing-note subtle">Transcribing… this updates automatically.</p>
      ) : (
        <textarea
          className="body-input"
          value={body}
          placeholder={note.status === "error" ? "Transcription failed — tap Retry, or type your note." : "Your note…"}
          onChange={(e) => {
            dirtyRef.current = true;
            setBody(e.target.value);
          }}
          onBlur={() => body !== note.body && save({ body })}
          rows={10}
        />
      )}

      <div className="detail-actions">
        <button onClick={() => void retry()} disabled={note.status === "transcribing" || !note.recordingId}>
          ↻ Retry transcription
        </button>
        <button className="danger" onClick={() => void remove()}>Delete</button>
      </div>
    </main>
  );
}
