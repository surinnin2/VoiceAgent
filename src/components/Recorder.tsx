"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/ui";

type RecState = "idle" | "starting" | "recording" | "uploading";
type Mode = "hold" | "toggle";

// A press shorter than this is treated as a tap → hands-free (toggle) mode for a long note.
// A longer press is push-to-talk → recording stops when the finger lifts.
const TAP_MS = 350;
// Slide the finger up this far during a hold to arm cancel (discard the recording on release).
const CANCEL_DIST = 90;

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  sampleRate: 16000,
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
};

// iOS records audio/mp4 (AAC); Android/desktop Chrome record audio/webm (opus). Pick whatever
// the platform supports rather than assuming one container.
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

function extFromMime(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function Recorder({
  categoryId,
  categoryName,
  onSaved,
}: {
  categoryId: string | null;
  categoryName: string;
  onSaved?: () => void;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [mode, setMode] = useState<Mode>("hold");
  const [elapsed, setElapsed] = useState(0);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const pressStartRef = useRef(0);
  const pressYRef = useRef(0);
  const modeRef = useRef<Mode>("hold");
  const cancelRef = useRef(false);
  const discardRef = useRef(false);
  const pendingRef = useRef<"stop" | "cancel" | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);
  const stateRef = useRef<RecState>("idle");
  stateRef.current = state;

  function setBoth(s: RecState) {
    stateRef.current = s;
    setState(s);
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }
  function startTimer() {
    stopTimer();
    timerRef.current = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200);
  }

  async function acquireWakeLock() {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wl) wakeRef.current = await wl.request("screen");
    } catch {
      /* best-effort — broken in installed PWAs before iOS 18.4 */
    }
  }
  function releaseWakeLock() {
    wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  }

  const handleStop = useCallback(
    async (mimeType: string) => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      if (discardRef.current) {
        discardRef.current = false;
        chunksRef.current = [];
        setBoth("idle");
        setMode("hold");
        return;
      }

      const durationMs = Date.now() - startedAtRef.current;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      if (blob.size === 0) {
        setError("Nothing was recorded — try holding a little longer.");
        setBoth("idle");
        setMode("hold");
        return;
      }

      setBoth("uploading");
      try {
        const form = new FormData();
        form.append("audio", blob, `recording.${extFromMime(mimeType)}`);
        form.append("durationMs", String(durationMs));
        if (categoryId) form.append("categoryId", categoryId);

        const res = await fetch("/api/recordings", { method: "POST", body: form });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Upload failed (${res.status})`);
        }
        onSaved?.();
        setToast(`Saved to ${categoryName} · transcribing…`);
        window.setTimeout(() => setToast(null), 2600);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBoth("idle");
        setMode("hold");
      }
    },
    [categoryId, categoryName, onSaved],
  );

  async function startRecording() {
    setError(null);
    setBoth("starting");
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
      recorder.start(1000); // chunk every second so partial audio survives a crash/suspend
      recorderRef.current = recorder;

      startedAtRef.current = Date.now();
      setElapsed(0);
      startTimer();
      void acquireWakeLock();
      setBoth("recording");

      // Resolve any release that happened while the mic was still being acquired.
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending === "cancel") discard();
      else if (pending === "stop") stopAndSave();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not access the microphone (${e.message}). On a phone the app must be served over HTTPS.`
          : "Could not access the microphone.",
      );
      setBoth("idle");
    }
  }

  function stopAndSave() {
    if (stateRef.current === "starting") {
      pendingRef.current = "stop";
      return;
    }
    stopTimer();
    releaseWakeLock();
    discardRef.current = false;
    recorderRef.current?.stop();
  }

  function discard() {
    if (stateRef.current === "starting") {
      pendingRef.current = "cancel";
      return;
    }
    stopTimer();
    releaseWakeLock();
    setCancelArmed(false);
    discardRef.current = true;
    recorderRef.current?.stop();
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    // Ignore presses while uploading or still acquiring the mic — prevents a double-start race
    // on devices where the permission prompt / getUserMedia takes a moment.
    if (state === "uploading" || state === "starting") return;
    e.preventDefault();
    if (state === "recording" && modeRef.current === "toggle") {
      stopAndSave(); // tap again to stop a hands-free recording
      return;
    }
    if (state === "idle") {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* not all environments support pointer capture */
      }
      pressStartRef.current = Date.now();
      pressYRef.current = e.clientY;
      cancelRef.current = false;
      setCancelArmed(false);
      modeRef.current = "hold";
      setMode("hold");
      void startRecording();
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (modeRef.current !== "hold") return;
    if (state !== "recording" && state !== "starting") return;
    const dy = pressYRef.current - e.clientY;
    const armed = dy > CANCEL_DIST;
    if (armed !== cancelRef.current) {
      cancelRef.current = armed;
      setCancelArmed(armed);
    }
  }

  function onPointerUp() {
    if (modeRef.current !== "hold") return;
    if (state !== "recording" && state !== "starting") return;
    if (cancelRef.current) {
      discard();
      return;
    }
    const dur = Date.now() - pressStartRef.current;
    if (dur < TAP_MS) {
      // Quick tap → switch to hands-free; keep recording until the next tap.
      modeRef.current = "toggle";
      setMode("toggle");
    } else {
      stopAndSave();
    }
  }

  // Safety net: iOS suspends a backgrounded PWA and stops capture. If we go hidden mid-record,
  // finalize immediately so the note is never lost.
  useEffect(() => {
    function onHidden() {
      if (document.visibilityState === "hidden" && stateRef.current === "recording") {
        stopAndSave();
      }
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      stopTimer();
      releaseWakeLock();
    };
  }, []);

  const recording = state === "recording" || state === "starting";
  const buttonLabel =
    state === "uploading"
      ? "Saving…"
      : cancelArmed
        ? "Release to cancel"
        : mode === "toggle"
          ? "Tap to stop"
          : recording
            ? "Release to save"
            : "Hold or tap";

  return (
    <div className="capture">
      <div className="capture-hint">
        Saving to <strong>{categoryName}</strong>
      </div>

      <button
        type="button"
        className={`rec-btn${recording ? " live" : ""}${cancelArmed ? " cancel" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        disabled={state === "uploading"}
        aria-label={mode === "toggle" ? "Tap to stop recording" : "Hold to record, tap for hands-free"}
      >
        <span className="rec-icon" aria-hidden="true">
          {state === "uploading" ? "…" : recording ? "■" : "●"}
        </span>
      </button>

      <div className="capture-status">
        {recording ? (
          <span className="timer">{formatDuration(elapsed)}</span>
        ) : (
          <span className="subtle">{buttonLabel}</span>
        )}
      </div>

      <p className="capture-sub subtle">
        {recording
          ? mode === "toggle"
            ? "Hands-free — tap the button to stop."
            : "Hold for a quick note · slide up to cancel."
          : "Hold for a quick note. Tap for a long, hands-free one."}
      </p>

      {toast && <div className="toast">{toast}</div>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
