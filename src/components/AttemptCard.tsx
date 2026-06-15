"use client";

import type { AttemptDTO } from "@/lib/dto";
import type { TranscriptionWord } from "@/lib/transcription/types";
import { formatDuration } from "@/lib/ui";
import { ConfidenceText } from "./ConfidenceText";

function parseWords(json: string | null): TranscriptionWord[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as TranscriptionWord[];
  } catch {
    return [];
  }
}

export function AttemptCard({
  attempt,
  preferred,
  onStar,
}: {
  attempt: AttemptDTO;
  preferred: boolean;
  onStar: (attemptId: string) => void;
}) {
  const keyterms: string[] = attempt.keyterms ? safeArray(attempt.keyterms) : [];
  const inProgress = attempt.status === "queued" || attempt.status === "processing";

  return (
    <div className={`attempt${preferred ? " preferred" : ""}`}>
      <div className="row">
        <strong>{providerLabel(attempt.provider)}</strong>
        <span className="mono">{attempt.model}</span>
        <span className={`badge ${attempt.status}`}>{attempt.status}</span>
        {preferred && <span className="badge star">★ preferred</span>}
        <span className="spacer" />
        {attempt.status === "done" && (
          <button onClick={() => onStar(attempt.id)} title="Mark this as the best result">
            {preferred ? "★ starred" : "☆ star"}
          </button>
        )}
      </div>

      {(keyterms.length > 0 || attempt.contextPrompt) && (
        <p className="subtle" style={{ marginTop: 8 }}>
          {keyterms.length > 0 && <>keyterms: {keyterms.join(", ")}</>}
          {keyterms.length > 0 && attempt.contextPrompt ? " · " : ""}
          {attempt.contextPrompt && <>context: “{attempt.contextPrompt}”</>}
        </p>
      )}

      <div style={{ marginTop: 10 }}>
        {inProgress && <span className="subtle">⏳ transcribing…</span>}
        {attempt.status === "error" && <p className="error">⚠ {attempt.errorMessage}</p>}
        {attempt.status === "done" && (
          <ConfidenceText words={parseWords(attempt.words)} fallbackText={attempt.text} />
        )}
      </div>

      {attempt.status === "done" && attempt.durationMs != null && (
        <p className="subtle" style={{ marginTop: 8 }}>took {formatDuration(attempt.durationMs)}</p>
      )}
    </div>
  );
}

function safeArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function providerLabel(id: string): string {
  switch (id) {
    case "assemblyai":
      return "AssemblyAI Universal-3 Pro";
    case "elevenlabs":
      return "ElevenLabs Scribe v2";
    case "deepgram":
      return "Deepgram Nova-3";
    case "mock":
      return "Mock (offline demo)";
    default:
      return id;
  }
}
