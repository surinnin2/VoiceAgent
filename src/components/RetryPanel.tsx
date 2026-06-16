"use client";

import { useState } from "react";
import type { EnrollmentDTO, ProviderDTO } from "@/lib/dto";

export interface TranscribeRequest {
  provider: string;
  keyterms: string[];
  contextPrompt: string;
  onlyMyVoice: boolean;
}

// The retry control. A retry is only useful if something varies, so this lets the user
// pick a DIFFERENT engine, add keyterms + context, and/or transcribe ONLY their own voice.
export function RetryPanel({
  providers,
  defaultProviderId,
  enrollment,
  busy,
  onSubmit,
}: {
  providers: ProviderDTO[];
  defaultProviderId: string;
  enrollment: EnrollmentDTO | null;
  busy: boolean;
  onSubmit: (req: TranscribeRequest) => void;
}) {
  const [provider, setProvider] = useState(defaultProviderId);
  const [keyterms, setKeyterms] = useState("");
  const [contextPrompt, setContextPrompt] = useState("");
  const [onlyMyVoice, setOnlyMyVoice] = useState(false);

  const selected = providers.find((p) => p.id === provider);
  const unavailable = selected && !selected.available;
  const canDiarize = !!selected?.supportsDiarization;
  const enrolledForMatch =
    !!selected?.supportsSpeakerLibrary && !!enrollment?.consentGiven && !!enrollment?.speakerLabel;

  function submit() {
    onSubmit({
      provider,
      keyterms: keyterms.split(",").map((t) => t.trim()).filter(Boolean),
      contextPrompt: contextPrompt.trim(),
      onlyMyVoice: onlyMyVoice && canDiarize,
    });
  }

  return (
    <div className="panel">
      <h2>Transcribe / retry</h2>
      <div className="field">
        <label htmlFor="engine">Engine</label>
        <select id="engine" value={provider} onChange={(e) => setProvider(e.target.value)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.available ? "" : " — no API key"}
            </option>
          ))}
        </select>
        {selected && <p className="subtle" style={{ marginTop: 4 }}>{selected.note}</p>}
      </div>

      <div className="field">
        <label htmlFor="keyterms">Keyterms (comma-separated proper nouns / jargon to boost)</label>
        <input
          id="keyterms"
          placeholder="e.g. Anthropic, Claude, VoiceAgent, R2"
          value={keyterms}
          onChange={(e) => setKeyterms(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="context">Context prompt (optional)</label>
        <input
          id="context"
          placeholder="e.g. A technical discussion about speech-to-text APIs."
          value={contextPrompt}
          onChange={(e) => setContextPrompt(e.target.value)}
        />
      </div>

      {/* Only my voice */}
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: canDiarize ? "pointer" : "not-allowed" }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={onlyMyVoice && canDiarize}
            disabled={!canDiarize}
            onChange={(e) => setOnlyMyVoice(e.target.checked)}
          />
          🎯 Only my voice
        </label>
        <p className="subtle" style={{ marginTop: 4 }}>
          {!canDiarize
            ? `${selected?.label ?? "This engine"} can’t diarize — switch to ElevenLabs Scribe (or Mock to demo).`
            : enrolledForMatch
              ? `Will match your enrolled voice (“${enrollment?.speakerLabel}”) and keep only your words.`
              : "Will diarize, then let you pick which speaker is you. Enroll below to auto-match."}
        </p>
      </div>

      {unavailable && (
        <p className="error">
          {selected?.label} has no API key configured — add it to <span className="mono">.env</span> and restart.
        </p>
      )}

      <button className="primary" onClick={submit} disabled={busy || unavailable}>
        {busy ? "Working…" : "Run transcription"}
      </button>
    </div>
  );
}
