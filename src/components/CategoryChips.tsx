"use client";

import { useRef, useState } from "react";
import type { CategoryDTO } from "@/lib/dto";

// Horizontal chip strip that sits above the record button: pick the category a note saves into.
// The selected chip persists between sessions (handled by the parent). "+" adds a new category.
export function CategoryChips({
  categories,
  selectedId,
  onSelect,
  onCreate,
}: {
  categories: CategoryDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelledRef = useRef(false);

  function cancel() {
    cancelledRef.current = true; // tell the blur handler not to create anything
    setAdding(false);
    setName("");
  }

  async function submit() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    setBusy(true);
    try {
      await onCreate(trimmed);
      setName("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chips" role="group" aria-label="Save note to category">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`chip${c.id === selectedId ? " selected" : ""}`}
          onClick={() => onSelect(c.id)}
          aria-pressed={c.id === selectedId}
        >
          {c.id === selectedId && <span aria-hidden="true">✓ </span>}
          {c.name}
        </button>
      ))}

      {adding ? (
        <span className="chip-add">
          <input
            autoFocus
            value={name}
            placeholder="New category"
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => {
              cancelledRef.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
              if (e.key === "Escape") cancel();
            }}
            onBlur={() => void submit()}
            disabled={busy}
          />
        </span>
      ) : (
        <button
          type="button"
          className="chip chip-plus"
          onClick={() => setAdding(true)}
          aria-label="Add category"
        >
          +
        </button>
      )}
    </div>
  );
}
