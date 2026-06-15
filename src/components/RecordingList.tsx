"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RecordingDTO } from "@/lib/dto";
import { formatBytes, formatDuration } from "@/lib/ui";

export function RecordingList({ refreshKey }: { refreshKey: number }) {
  const [recordings, setRecordings] = useState<RecordingDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/recordings")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setRecordings(j.recordings ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="panel">
      <h2>Recordings</h2>
      {loading && <p className="subtle">Loading…</p>}
      {!loading && recordings.length === 0 && (
        <p className="empty">No recordings yet — hit “Start recording” above.</p>
      )}
      {recordings.map((r) => (
        <Link
          key={r.id}
          href={`/recordings/${r.id}`}
          className="list-item"
          style={{ color: "var(--text)" }}
        >
          <span>🎙️</span>
          <div>
            <div>{r.filename}</div>
            <div className="subtle">
              {formatDuration(r.durationMs)} · {formatBytes(r.sizeBytes)} ·{" "}
              {r._count?.attempts ?? 0} attempt{(r._count?.attempts ?? 0) === 1 ? "" : "s"}
            </div>
          </div>
          <span className="spacer" />
          <span className="subtle">{new Date(r.createdAt).toLocaleString()}</span>
        </Link>
      ))}
    </div>
  );
}
