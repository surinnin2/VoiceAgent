"use client";

import { useEffect, useState } from "react";
import type { EnrollmentDTO } from "@/lib/dto";

// Voice enrollment for "only my voice". ElevenLabs has no public enrollment API yet, so
// enrolling a voiceprint is a one-time step in the ElevenLabs dashboard; here we capture
// consent + the resulting Speaker Library name to match against. Without a name, the feature
// still works by letting you pick your speaker per recording.
export function EnrollmentPanel({
  onChange,
}: {
  onChange?: (e: EnrollmentDTO | null) => void;
}) {
  const [enrollment, setEnrollment] = useState<EnrollmentDTO | null>(null);
  const [consent, setConsent] = useState(false);
  const [speakerLabel, setSpeakerLabel] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/enrollment")
      .then((r) => r.json())
      .then((j) => {
        const e: EnrollmentDTO | null = j.enrollment ?? null;
        setEnrollment(e);
        setConsent(!!e?.consentGiven);
        setSpeakerLabel(e?.speakerLabel ?? "");
        onChange?.(e);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentGiven: consent, speakerLabel }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error || "Save failed");
        return;
      }
      setEnrollment(j.enrollment);
      onChange?.(j.enrollment);
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    await fetch("/api/enrollment", { method: "DELETE" });
    setEnrollment(null);
    setConsent(false);
    setSpeakerLabel("");
    onChange?.(null);
  }

  const status = enrollment?.speakerLabel
    ? `Enrolled: “${enrollment.speakerLabel}”`
    : enrollment?.consentGiven
      ? "Consent given (no Speaker Library name yet)"
      : "Not set up";

  return (
    <div className="panel">
      <div className="row">
        <h2 style={{ margin: 0 }}>🎯 Voice enrollment</h2>
        <span className="badge">{status}</span>
        <span className="spacer" />
        <button onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Set up"}</button>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          <p className="subtle">
            “Only my voice” keeps only your words from a recording. To auto-match you across
            recordings, enroll your voice once in the ElevenLabs dashboard
            (<span className="mono">Workspace → Speaker Library</span>), then paste the speaker
            name here. Without a name it still works — you just pick your speaker after each
            transcription.
          </p>

          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="speakerLabel">ElevenLabs Speaker Library name</label>
            <input
              id="speakerLabel"
              placeholder="e.g. Robert"
              value={speakerLabel}
              onChange={(e) => setSpeakerLabel(e.target.value)}
            />
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              style={{ width: "auto", marginTop: 3 }}
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span className="subtle">
              I consent to storing a voiceprint reference (the speaker name above) to identify
              my voice. A voiceprint is biometric data; only this label is stored — never raw
              enrollment audio — and I can delete it anytime.
            </span>
          </label>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary" onClick={save} disabled={saving || !consent}>
              {saving ? "Saving…" : "Save enrollment"}
            </button>
            {enrollment && (
              <button className="danger" onClick={clear}>Delete enrollment</button>
            )}
            {!consent && <span className="subtle">Consent is required to save.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
