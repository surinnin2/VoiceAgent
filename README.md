# VoiceAgent

Record voice in the browser, transcribe it with accuracy-optimized engines, and **retry
across engines** (or with added keyterms/context) when you're not satisfied.

The core idea: top English transcription accuracy has plateaued across vendors, so the
biggest wins come from **good capture**, **keyterm boosting**, and a **retry that runs a
*different* engine and lets you compare** — not from chasing one "best" model.

## Features

- 🎙️ Browser recording tuned for ASR accuracy — mono, 16 kHz target, noise-suppression/AGC **off**, echo-cancellation on; pause/resume; chunked capture.
- 🗄️ Raw audio stored once; every transcription is a re-runnable **attempt** against it (never re-record).
- 🔁 **Retry** with a different engine and/or keyterms + context prompt; **star** the best attempt.
- 🌈 **Per-word confidence shading** so you can see where the engine was unsure.
- 🔌 Pluggable engines behind one interface — **AssemblyAI Universal-3 Pro** (default), **ElevenLabs Scribe v2**, **Deepgram Nova-3**, and an always-on **mock** engine so it runs with zero API keys.

## Stack

- **Next.js (App Router) + React + TypeScript**
- **Prisma + SQLite** for local dev (swap `datasource` to Postgres for production)
- **Local filesystem storage** behind a thin seam (`src/lib/storage.ts`) — swap for Cloudflare R2 / S3 in production
- Transcription runs **async** (fire-and-forget worker + client polling). In production, move `processAttempt` into a durable queue (Inngest / QStash).

## Quick start

```bash
npm install
cp .env.example .env          # optional: add real API keys
npx prisma db push            # create the SQLite schema
npm run dev                   # http://localhost:3000
```

With no API keys the app runs on the **mock** engine end-to-end. Add any of
`ASSEMBLYAI_API_KEY`, `ELEVENLABS_API_KEY`, `DEEPGRAM_API_KEY` to `.env` and restart to
enable real engines (the default becomes the first available, preferring AssemblyAI).

> ⚠️ Microphone capture requires a secure context. `localhost` is treated as secure; on a
> LAN IP you'll need HTTPS.

## Project layout

```
src/
  app/
    page.tsx                       # home: record + recordings list
    recordings/[id]/page.tsx       # detail: audio, retry panel, attempts
    api/                           # route handlers (recordings, transcribe, attempts, providers)
  components/                      # Recorder, RecordingList, RetryPanel, AttemptCard, ConfidenceText
  lib/
    db.ts                          # Prisma client singleton
    storage.ts                     # audio storage seam (local FS -> R2 later)
    transcription/                 # provider interface + assemblyai/elevenlabs/deepgram/mock + worker
prisma/schema.prisma               # Recording (1) -> TranscriptionAttempt (N)
```

## Engine notes

Provider model IDs and keyterm params move over time — verify against current docs and
adjust via the `*_MODEL` env overrides if a call fails. Per-word confidence is strongest on
Deepgram and AssemblyAI; ElevenLabs returns it only when logprobs are present; the mock
engine fakes it for the demo.

## Roadmap (not yet built)

- Silero VAD silence-trimming in-browser (kills hallucinations on silence)
- WAV/PCM capture via AudioWorklet for max fidelity
- Word-level **diff** view between two attempts; multi-engine **ROVER** consensus
- Confidence-guided LLM cleanup pass (e.g. Claude Haiku)
- Move storage to R2 and the worker to a durable queue
