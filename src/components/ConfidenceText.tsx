"use client";

import type { TranscriptionWord } from "@/lib/transcription/types";
import { confidenceBg, isLowConfidence } from "@/lib/ui";

// Renders the transcript with low-confidence words shaded/underlined so the user can
// immediately see where the engine was unsure — the cue for whether a retry is worth it.
export function ConfidenceText({
  words,
  fallbackText,
}: {
  words: TranscriptionWord[];
  fallbackText: string | null;
}) {
  if (!words.length) {
    return <p className="transcript">{fallbackText || <span className="empty">(empty)</span>}</p>;
  }

  const anyConfidence = words.some((w) => w.confidence !== null);

  return (
    <>
      <p className="transcript">
        {words.map((w, i) => (
          <span
            key={i}
            className={`w${isLowConfidence(w.confidence) ? " low" : ""}`}
            style={{ background: confidenceBg(w.confidence) }}
            title={w.confidence === null ? "no confidence" : `confidence ${(w.confidence * 100).toFixed(0)}%`}
          >
            {w.text}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
      {anyConfidence ? (
        <div className="legend">
          <span><span className="chip" style={{ background: "transparent", border: "1px solid var(--border)" }} />high confidence</span>
          <span><span className="chip" style={{ background: confidenceBg(0.65) }} />uncertain</span>
          <span><span className="chip" style={{ background: confidenceBg(0.4) }} />low (underlined)</span>
        </div>
      ) : (
        <div className="legend">This engine does not return per-word confidence.</div>
      )}
    </>
  );
}
