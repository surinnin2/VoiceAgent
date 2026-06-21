"use client";

import { useCallback, useEffect, useState } from "react";
import { Recorder } from "@/components/Recorder";
import { CategoryChips } from "@/components/CategoryChips";
import type { CategoryDTO } from "@/lib/dto";

const LS_KEY = "va.selectedCategory";

export default function CapturePage() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    const j = await fetch("/api/categories").then((r) => r.json()).catch(() => ({ categories: [] }));
    const cats: CategoryDTO[] = j.categories ?? [];
    setCategories(cats);
    setSelectedId((cur) => {
      if (cur && cats.some((c) => c.id === cur)) return cur;
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
      if (stored && cats.some((c) => c.id === stored)) return stored;
      return cats.find((c) => c.isInbox)?.id ?? cats[0]?.id ?? null;
    });
    return cats;
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  function select(id: string) {
    setSelectedId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, id);
  }

  async function createCategory(name: string) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    await loadCategories();
    if (j.category?.id) select(j.category.id);
  }

  const selectedName = categories.find((c) => c.id === selectedId)?.name ?? "Inbox";

  return (
    <main className="capture-page">
      <CategoryChips
        categories={categories}
        selectedId={selectedId}
        onSelect={select}
        onCreate={createCategory}
      />
      <Recorder categoryId={selectedId} categoryName={selectedName} />
    </main>
  );
}
