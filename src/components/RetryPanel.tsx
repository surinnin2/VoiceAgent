"use client";

import { useState } from "react";
import type { ProviderDTO } from "@/lib/dto";

export interface TranscribeRequest {
  provider: string;
  keyterms: string[];
  contextPrompt: string;
}

// The retry control. A retry is only useful if something varies, so this lets the user
// pick a DIFFERENT engine and/or add keyterms + context before re-running.
export function RetryPanel({
  providers,
  defaultProviderId,
  busy,
  onSubmit,
}: {
  providers: ProviderDTO[];
  defaultProviderId: string;
  busy: boolean;
  onSubmit: (req: TranscribeRequest) => void;
}) {
  const [provider, setProvider] = useState(defaultProviderId);
  const [keyterms, setKeyterms] = useState("");
  const [contextPrompt, setContextPrompt] = useState("");

  const selected = providers.find((p) => p.id === provider);
  const unavailable = selected && !selected.available;

  function submit() {
    onSubmit({
      provider,
      keyterms: keyterms
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      contextPrompt: contextPrompt.trim(),
    });
  }

  return (
    <div className="panel">
      <h2>Transcribe / retry</h2>
      <div className="field">
        <label htmlFor="engine">Engine</label>
        <select
          id="engine"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
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
