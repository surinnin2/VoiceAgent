"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ProviderDTO, RecordingDTO } from "@/lib/dto";
import { AttemptCard } from "@/components/AttemptCard";
import { RetryPanel, type TranscribeRequest } from "@/components/RetryPanel";
import { formatBytes, formatDuration } from "@/lib/ui";

function RecordingDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const searchParams = useSearchParams();

  const [recording, setRecording] = useState<RecordingDTO | null>(null);
  const [providers, setProviders] = useState<ProviderDTO[]>([]);
  const [defaultProviderId, setDefaultProviderId] = useState("mock");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const autoStartedRef = useRef(false);

  const fetchRecording = useCallback(async () => {
    const res = await fetch(`/api/recordings/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      return null;
    }
    const j = await res.json();
    setRecording(j.recording as RecordingDTO);
    return j.recording as RecordingDTO;
  }, [id]);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((j) => {
        setProviders(j.providers ?? []);
        setDefaultProviderId(j.defaultProviderId ?? "mock");
      })
      .catch(() => {});
    fetchRecording();
  }, [id, fetchRecording]);

  const startTranscription = useCallback(
    async (req: TranscribeRequest) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/recordings/${id}/transcribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          alert(j.error || "Failed to start transcription");
          return;
        }
        await fetchRecording();
      } finally {
        setBusy(false);
      }
    },
    [id, fetchRecording],
  );

  // Auto-run a default transcription when arriving straight from the recorder.
  useEffect(() => {
    if (autoStartedRef.current || !recording) return;
    if (searchParams.get("auto") !== "1") return;
    autoStartedRef.current = true;
    if ((recording.attempts?.length ?? 0) === 0) {
      startTranscription({ provider: defaultProviderId, keyterms: [], contextPrompt: "" });
    }
  }, [recording, searchParams, defaultProviderId, startTranscription]);

  // Poll while any attempt is still running.
  const hasPending = !!recording?.attempts?.some(
    (a) => a.status === "queued" || a.status === "processing",
  );
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(() => void fetchRecording(), 1500);
    return () => clearInterval(t);
  }, [hasPending, fetchRecording]);

  async function star(attemptId: string) {
    const next = recording?.preferredAttemptId === attemptId ? null : attemptId;
    await fetch(`/api/recordings/${id}/prefer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: next }),
    });
    void fetchRecording();
  }

  if (notFound) {
    return (
      <main>
        <Link href="/">← All recordings</Link>
        <p className="empty" style={{ marginTop: 16 }}>Recording not found.</p>
      </main>
    );
  }
  if (!recording) {
    return (
      <main>
        <p className="subtle">Loading…</p>
      </main>
    );
  }

  return (
    <main>
      <Link href="/">← All recordings</Link>
      <h1 style={{ marginTop: 12 }}>{recording.filename}</h1>
      <p className="subtle">
        {formatDuration(recording.durationMs)} · {formatBytes(recording.sizeBytes)} ·{" "}
        {new Date(recording.createdAt).toLocaleString()}
      </p>

      <div className="panel">
        <h2>Audio</h2>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={`/api/recordings/${id}/audio`} />
      </div>

      <RetryPanel
        providers={providers}
        defaultProviderId={defaultProviderId}
        busy={busy}
        onSubmit={startTranscription}
      />

      <div className="panel">
        <h2>Attempts</h2>
        {(recording.attempts?.length ?? 0) === 0 && (
          <p className="empty">No attempts yet — run one above.</p>
        )}
        {recording.attempts?.map((a) => (
          <AttemptCard
            key={a.id}
            attempt={a}
            preferred={recording.preferredAttemptId === a.id}
            onStar={star}
          />
        ))}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main>
          <p className="subtle">Loading…</p>
        </main>
      }
    >
      <RecordingDetail />
    </Suspense>
  );
}
