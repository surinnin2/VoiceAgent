"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/ui";

type RecState = "idle" | "recording" | "paused" | "uploading";

// Browser capture tuned for transcription accuracy: mono, 16 kHz target, echo cancellation
// on but noise suppression / auto gain OFF (those telephony filters can hurt ASR).
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  sampleRate: 16000,
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
};

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "";
}

export function Recorder({ onUploaded }: { onUploaded?: () => void }) {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => void handleStop(recorder.mimeType || mimeType || "audio/webm");
      recorder.start(1000); // emit a chunk every second (resilient to crashes)
      recorderRef.current = recorder;

      startedAtRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200);
      setState("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not access the microphone.");
    }
  }

  function stop() {
    stopTimer();
    recorderRef.current?.stop();
  }

  function pause() {
    recorderRef.current?.pause();
    stopTimer();
    setState("paused");
  }

  function resume() {
    recorderRef.current?.resume();
    timerRef.current = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200);
    setState("recording");
  }

  async function handleStop(mimeType: string) {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const durationMs = Date.now() - startedAtRef.current;
    const blob = new Blob(chunksRef.current, { type: mimeType });
    if (blob.size === 0) {
      setError("Nothing was recorded.");
      setState("idle");
      return;
    }

    setState("uploading");
    try {
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.append("audio", blob, `recording.${ext}`);
      form.append("durationMs", String(durationMs));

      const res = await fetch("/api/recordings", { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Upload failed (${res.status})`);
      }
      const { recording } = await res.json();
      onUploaded?.();
      // ?auto=1 tells the detail page to kick off a default transcription on arrival.
      router.push(`/recordings/${recording.id}?auto=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setState("idle");
    }
  }

  return (
    <div className="panel">
      <h2>Record</h2>
      <div className="row">
        {state === "idle" && (
          <button className="record" onClick={start}>● Start recording</button>
        )}
        {state === "recording" && (
          <>
            <span className="dot" />
            <span className="timer">{formatDuration(elapsed)}</span>
            <span className="spacer" />
            <button onClick={pause}>Pause</button>
            <button className="primary" onClick={stop}>Stop &amp; transcribe</button>
          </>
        )}
        {state === "paused" && (
          <>
            <span className="timer">{formatDuration(elapsed)}</span>
            <span className="subtle">paused</span>
            <span className="spacer" />
            <button onClick={resume}>Resume</button>
            <button className="primary" onClick={stop}>Stop &amp; transcribe</button>
          </>
        )}
        {state === "uploading" && <span className="subtle">Uploading &amp; queuing transcription…</span>}
      </div>
      {error && <p className="error">{error}</p>}
      <p className="subtle" style={{ marginTop: 10 }}>
        Captured mono @ 16 kHz, noise-suppression off — tuned for transcription accuracy.
      </p>
    </div>
  );
}
