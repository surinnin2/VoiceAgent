"use client";

import { useMemo, useState } from "react";
import type { AttemptDTO } from "@/lib/dto";
import type { TranscriptionWord } from "@/lib/transcription/types";
import { formatDuration, speakerColor } from "@/lib/ui";
import { ConfidenceText } from "./ConfidenceText";

function parseWords(json: string | null): TranscriptionWord[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as TranscriptionWord[];
  } catch {
    return [];
  }
}

function distinctSpeakers(words: TranscriptionWord[]): string[] {
  const seen: string[] = [];
  for (const w of words) {
    if (w.speaker && !seen.includes(w.speaker)) seen.push(w.speaker);
  }
  return seen;
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

  const words = useMemo(() => parseWords(attempt.words), [attempt.words]);
  const speakers = useMemo(() => distinctSpeakers(words), [words]);
  const diarized = attempt.diarized && speakers.length > 0;
  const enrolledMatched =
    !!attempt.enrolledSpeaker && speakers.includes(attempt.enrolledSpeaker);

  // "all" or a specific speaker label. Default follows the enrolled match; user can override.
  const [override, setOverride] = useState<string | null>(null);
  const effective =
    override ?? (enrolledMatched ? (attempt.enrolledSpeaker as string) : "all");

  const shown = effective === "all" ? words : words.filter((w) => w.speaker === effective);

  return (
    <div className={`attempt${preferred ? " preferred" : ""}`}>
      <div className="row">
        <strong>{providerLabel(attempt.provider)}</strong>
        <span className="mono">{attempt.model}</span>
        <span className={`badge ${attempt.status}`}>{attempt.status}</span>
        {attempt.onlyEnrolledSpeaker && <span className="badge">🎯 only my voice</span>}
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

      {/* "Only my voice" status */}
      {attempt.status === "done" && attempt.onlyEnrolledSpeaker && (
        <p className="subtle" style={{ marginTop: 8 }}>
          {enrolledMatched ? (
            <span style={{ color: "var(--good)" }}>
              ✓ Matched your enrolled voice (“{attempt.enrolledSpeaker}”) — showing only your words.
            </span>
          ) : attempt.enrolledSpeaker ? (
            <span style={{ color: "var(--warn)" }}>
              Your enrolled voice (“{attempt.enrolledSpeaker}”) wasn’t detected — pick your speaker below.
            </span>
          ) : (
            <>Diarized — pick which speaker is you below.</>
          )}
        </p>
      )}

      {/* Speaker filter chips */}
      {attempt.status === "done" && diarized && (
        <div className="row" style={{ marginTop: 8, gap: 6 }}>
          <SpeakerChip label="All" active={effective === "all"} onClick={() => setOverride("all")} />
          {speakers.map((s, i) => (
            <SpeakerChip
              key={s}
              label={s === attempt.enrolledSpeaker ? `${s} (you)` : s}
              color={speakerColor(i)}
              active={effective === s}
              onClick={() => setOverride(s)}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        {inProgress && <span className="subtle">⏳ transcribing…</span>}
        {attempt.status === "error" && <p className="error">⚠ {attempt.errorMessage}</p>}
        {attempt.status === "done" && (
          <ConfidenceText words={shown} fallbackText={effective === "all" ? attempt.text : null} />
        )}
      </div>

      {attempt.status === "done" && attempt.durationMs != null && (
        <p className="subtle" style={{ marginTop: 8 }}>
          took {formatDuration(attempt.durationMs)}
          {diarized && effective !== "all" ? ` · ${shown.length} of ${words.length} words` : ""}
        </p>
      )}
    </div>
  );
}

function SpeakerChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="badge"
      style={{
        cursor: "pointer",
        borderColor: active ? "var(--accent)" : "var(--border)",
        color: active ? "var(--text)" : "var(--muted)",
        background: active ? "var(--panel)" : "transparent",
      }}
    >
      {color && (
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            marginRight: 6,
            verticalAlign: "middle",
          }}
        />
      )}
      {label}
    </button>
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
