# Voice Notes — remaining roadmap

Status: **Milestone 1 (core capture loop) is done** on branch `feature/voice-notes-redesign`.
This doc lists the remaining work to reach the full product vision, split into chunks that are
each **self-contained enough for one agent to one-shot**. Each chunk states its goal, what it
depends on, the exact files to touch, the steps, how to verify it, and the known gotchas.

**Target architecture:** Next.js (App Router) on **Vercel (serverless)**, **Postgres** (Neon or
Supabase), audio in **Cloudflare R2**, transcription via the existing pluggable engines.
Single user, no auth (private app).

**The vision (recap):** open app → hold for a short note / tap for a long one → auto-transcribe →
note auto-sorts into a pre-selected category → simple Retry if bad → separate screen to
read/edit/reorganize/delete. Advanced engine/speaker/transcription settings hidden in Settings.
Installable as a Chrome PWA on the phone.

---

## Phase A — Ship it to your phone (deploy path)

Do A1–A4 in any order (they're independent, each testable locally), then A5 integrates them.
A5 is the only one that needs the others done first.

### Chunk A1 — Swap SQLite → Postgres
**Goal:** Run on managed Postgres with proper migrations and serverless-safe pooling.
**Depends on:** nothing.
**Files:** `prisma/schema.prisma`, `src/lib/db.ts` (likely unchanged), `.env`, `.env.example`,
`package.json` (scripts).
**Steps:**
1. Change `datasource db { provider = "postgresql" }` in `prisma/schema.prisma`. (It is currently
   hardcoded to `sqlite` — this is a code change, not just an env flip.)
2. Provision a Postgres DB (Neon or Supabase free tier). Get the **pooled** connection string
   (for the app) and the **direct** string (for migrations). Add `directUrl = env("DIRECT_URL")`
   to the datasource.
3. Set `DATABASE_URL` (pooled, `?pgbouncer=true&connection_limit=1`) and `DIRECT_URL` in `.env`
   and document both in `.env.example`.
4. Replace `prisma db push` workflow with migrations: `npx prisma migrate dev --name init`
   (creates `prisma/migrations/`). Change `package.json` `build` to run `prisma generate &&
   prisma migrate deploy && next build`. Keep `db:push` for local scratch if desired.
5. Re-seed categories (the `ensureCategoriesSeeded()` on-boot path still works; confirm Inbox/Ideas/Tasks appear).
**Acceptance:**
- `npm run build` passes; `npx prisma migrate deploy` applies cleanly to a fresh Postgres DB.
- App boots against Postgres; create a recording via `POST /api/recordings`, confirm note + attempt rows land in Postgres; `GET /api/notes` returns it.
**Gotchas:**
- The codebase stores `keyterms`/`words` as JSON-encoded **strings** (portable). Keep them as
  `String?` — do NOT convert to Prisma `Json` unless you also update the `JSON.parse`/`stringify`
  call sites in `process.ts`/`AttemptCard.tsx`.
- There is no existing migration history (project used `db push`). The first `migrate dev` will
  baseline the whole schema — that's expected.
- Serverless + Prisma needs connection pooling; using a direct connection string for the app will
  exhaust connections. Pooled URL for runtime, `DIRECT_URL` for migrate.

### Chunk A2 — Move audio storage to Cloudflare R2 (S3 API)
**Goal:** Persist audio off the local filesystem (Vercel's FS is ephemeral/read-only).
**Depends on:** nothing.
**Files:** `src/lib/storage.ts` (the seam — only the 3 functions change), `.env`, `.env.example`,
`src/app/api/recordings/[id]/audio/route.ts` (may switch to a redirect), `package.json` (add
`@aws-sdk/client-s3`).
**Steps:**
1. Create an R2 bucket + API token (S3-compatible). Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` to env + `.env.example`.
2. Reimplement `saveAudio` / `readAudio` / `deleteAudio` in `storage.ts` against R2 using
   `@aws-sdk/client-s3` (`endpoint: https://<account>.r2.cloudflarestorage.com`). Keep the exact
   same function signatures so callers (`recordings/route.ts`, the audio route, the worker,
   `notes/[id]` DELETE) are untouched.
3. Keep a **local-FS fallback** gated on an env flag (e.g. `STORAGE_DRIVER=local|r2`) so dev still
   works without R2 creds.
4. `audio/route.ts`: either stream the R2 object through, or 302-redirect to a short-lived
   presigned GET URL (simpler + cheaper). If redirecting, the `<audio>` tag will follow it.
**Acceptance:**
- With `STORAGE_DRIVER=r2`, upload a note → object appears in the R2 bucket; the detail page's
  audio player plays it; Retry still works (re-reads from R2); Delete removes the R2 object (no orphan).
**Gotchas:**
- The `extFromMime` helper in `storage.ts` must stay (iOS=mp4, Android=webm).
- Presigned URLs must be short-lived; don't make the bucket public.

### Chunk A3 — Make transcription survive serverless
**Goal:** The fire-and-forget worker (`void processAttempt(...)`) dies when a serverless function
returns. Make transcription actually complete after the HTTP response.
**Depends on:** nothing (but easiest to test after deploy).
**Files:** `src/lib/transcription/start.ts`, `src/app/api/recordings/route.ts`,
`src/app/api/notes/[id]/retry/route.ts`, `package.json`.
**Steps (MVP path — recommended first):**
1. `npm i @vercel/functions`. In `start.ts`, replace `void processAttempt(attempt.id)` with
   `waitUntil(processAttempt(attempt.id))` so Vercel keeps the function alive until transcription
   finishes. Set `export const maxDuration = 300` on the routes that call it (needs Vercel Pro for
   >60s; Hobby caps at 60s, fine for short notes).
**Steps (robust upgrade — do later if needed):**
2. Swap to a durable queue: enqueue a job on upload/retry (Inngest, QStash, or Trigger.dev); a
   separate function/route runs `processAttempt`. This survives restarts and long audio.
**Acceptance (on Vercel preview):**
- Upload a real voice note; after the POST returns, the note transitions `transcribing → done`
  within a reasonable time and the body fills in. Kill nothing manually — it must finish on its own.
**Gotchas:**
- AssemblyAI's provider does its own upload+poll loop (up to ~10 min for long audio). `waitUntil`
  is bounded by the function's `maxDuration`; for short personal notes this is fine, but flag the
  queue upgrade if you ever record long audio.
- Keep the upload response fast: don't `await` the full transcription in the request — only enqueue/waitUntil.

### Chunk A4 — PWA packaging (installable on the phone)
**Goal:** Installable to the home screen on iOS Safari + Android Chrome; standalone shell so the
mic works.
**Depends on:** nothing.
**Files:** `public/manifest.webmanifest` (new), `public/icons/*` (new), `src/app/layout.tsx`
(add `metadata.manifest`), a small `src/components/InstallHint.tsx` (new, optional).
**Steps:**
1. Add `public/manifest.webmanifest`: `name`, `short_name`, `start_url: "/"`, `display:
   "standalone"`, `theme_color: "#0f1115"`, `background_color: "#0f1115"`, and `icons` with 192px,
   512px, and a 512px `purpose: "maskable"` variant.
2. Generate the icons (a simple solid-bg mic glyph is fine — a script with `sharp`, or hand-made
   PNGs at 192/512). Add `apple-touch-icon.png` (180px).
3. In `layout.tsx`, set `metadata.manifest = "/manifest.webmanifest"`. The `appleWebApp` metadata
   is already present (capable + status bar). Verify `apple-touch-icon` is linked.
4. iOS shows **no install prompt** — add an `InstallHint` that, when not in standalone mode
   (`navigator.standalone !== true` / `display-mode: standalone` media query is false) and on iOS,
   shows a dismissible "Tap Share → Add to Home Screen" tip. On Android, capture
   `beforeinstallprompt` and show a custom "Install" button.
5. A service worker is **not required** for installability or the mic — skip it unless you want an
   offline shell.
**Acceptance:**
- Chrome DevTools → Application → Manifest shows no errors and "Installable".
- On a real iPhone (after A5), Add to Home Screen launches a chromeless standalone app and the mic works.
**Gotchas:**
- `maximumScale=1` / `userScalable=false` are already set in `layout.tsx` viewport.
- Don't rely on opening the app from an in-app browser (Messages/Mail) for recording — getUserMedia
  only works in the real Safari/standalone PWA. The hint should say "open from the home-screen icon".

### Chunk A5 — Deploy to Vercel + wire env + verify on phone
**Goal:** The app is live at an HTTPS URL, installed on the phone, full loop working on cellular.
**Depends on:** A1, A2, A3 (A4 strongly recommended so it's installable).
**Files:** `vercel.json` (optional), `.env.example` (final), `README.md` (deploy notes).
**Steps:**
1. Push the branch; import the repo into Vercel.
2. Set env vars in Vercel: `DATABASE_URL` (pooled) + `DIRECT_URL`, the `R2_*` vars +
   `STORAGE_DRIVER=r2`, the STT provider keys (`ASSEMBLYAI_API_KEY` etc.), and any queue keys.
3. Ensure the build runs `prisma migrate deploy` (from A1) so the schema is applied on deploy.
4. Deploy. Open the HTTPS URL on the phone, install to home screen (A4), record a note over
   cellular, confirm it transcribes and appears in Notes.
**Acceptance:**
- From a phone on cellular: install PWA → hold-to-record → note auto-transcribes → shows in Notes →
  edit/recategorize/delete all work. No mixed-content or secure-context errors.
**Gotchas:**
- HTTPS is mandatory for `getUserMedia`; Vercel provides it. (A plain LAN IP would silently break the mic.)
- First request after deploy may be a cold start; transcription via `waitUntil` still completes.

---

## Phase B — Complete the product vision

These are independent of the deploy and of each other (all depend only on M1). Prioritize B1.

### Chunk B1 — Settings screen (hide the advanced controls)
**Goal:** A `/settings` screen reachable from the Notes header holding default engine, "only my
voice" + voice enrollment, keyterms/context defaults, and language — so the capture flow stays
zero-config.
**Depends on:** M1.
**Files:** `prisma/schema.prisma` (add a `Settings` singleton, mirror the `Enrollment id="default"`
pattern, or reuse env for engine), `src/app/settings/page.tsx` (new), `src/app/api/settings/route.ts`
(new GET/PUT), `src/lib/transcription/start.ts` (read defaults), `src/components/TabBar.tsx` or the
Notes header (add a gear link), and relocate `RetryPanel.tsx` + `EnrollmentPanel.tsx` here.
**Steps:**
1. Add a `Settings` row: `defaultProvider`, `defaultKeyterms`, `defaultContextPrompt`,
   `onlyMyVoice`, `languageCode`. Seed a default row.
2. Build `/settings` UI from the existing `RetryPanel` + `EnrollmentPanel` controls (move, don't rebuild).
3. Make `startTranscription({})` (the auto-on-upload call) read these defaults instead of hardcoding.
4. Add a gear icon in the Notes header → `/settings` (hide the tab bar on `/settings` like the detail screen).
**Acceptance:**
- Change the default engine/keyterms in Settings; a new recording auto-transcribes using them.
- Enroll a voice + toggle "only my voice"; new notes filter to your speaker. Capture screen stays clean.
**Gotchas:**
- Reconcile default engine vs "only my voice": only `elevenlabs`/`mock` diarize (assemblyai/deepgram
  don't). If `onlyMyVoice` is the default, the auto engine selection must pick a diarization-capable
  provider or the transcribe path 400s. See `start.ts` validation.
- `languageCode` is currently hardcoded `"en"` in `start.ts` — thread the setting through.

### Chunk B2 — AI cleanup pass (raw + cleaned, never destructive)
**Goal:** Optional Claude pass that rewrites the raw transcript into clean prose (fix filler/grammar),
shown alongside — never replacing — the verbatim text.
**Depends on:** M1 (B1 nice for the on/off toggle).
**Files:** `prisma/schema.prisma` (add `Note.cleanedBody String?`), `src/lib/transcription/process.ts`
(run cleanup after a successful transcription), a new `src/lib/cleanup.ts` (Claude Haiku call via
`@anthropic-ai/sdk`), `src/app/notes/[id]/page.tsx` (toggle raw ↔ cleaned).
**Steps:**
1. Add `cleanedBody` to `Note`. After `applyToNote` writes a `done` transcript (and only when not
   `edited`), call a Haiku cleanup and store `cleanedBody`. Run it async — never block capture.
2. On the detail screen, default to showing `cleanedBody` when present with a "show original" toggle.
   Editing edits `body` (raw stays the source of truth given the accuracy/retry focus).
**Acceptance:**
- A rambling note gets a clean version; the raw transcript is always recoverable; toggling works.
**Gotchas:**
- Use the latest Haiku model id; keep the raw text — this app's whole premise is accuracy + retry.
- Make it opt-in (Settings flag) so it doesn't add latency/cost when unwanted.

### Chunk B3 — Full-text search
**Goal:** Search notes by title/body from the Notes header.
**Depends on:** M1 (A1 if you want Postgres FTS).
**Files:** `src/app/notes/page.tsx` / `src/components/NotesList.tsx` (search input + filter),
optionally `src/app/api/notes/route.ts` (accept a `?q=` query).
**Steps:**
1. Add a search input to the Notes header. Either filter client-side over the loaded notes (simplest)
   or pass `?q=` and do a Postgres `ILIKE`/`to_tsvector` query server-side (better at scale).
2. Debounce input; highlight or just filter the grouped list.
**Acceptance:** Typing filters the list to matching titles/bodies in real time.

### Chunk B4 — Capture polish (optional)
**Goal:** Round out the recording UX.
**Depends on:** M1.
**Files:** `src/components/Recorder.tsx`, `src/app/globals.css`, `src/components/NotesList.tsx`.
**Steps:**
1. **Slide-to-lock** on the hold path (WhatsApp-style): dragging up past a threshold locks into
   hands-free so the user can release without stopping. (The cancel-slide already exists; add a lock zone.)
2. **Live level meter / waveform** during recording via an `AnalyserNode` on the captured stream.
3. **True swipe-to-delete / swipe-to-recategorize** on list rows (currently a `⋯` menu). Pointer-drag
   translateX with an undo snackbar (already built) — the menu can stay as the accessible fallback.
**Acceptance:** Lock, meter, and swipe all work on a touch device; nothing regresses on desktop.

---

## Suggested order
A1 → A2 → A3 → A4 → A5 (you're on your phone) → B1 (settings) → B2/B3/B4 as desired.
A1–A4 can be parallelized across agents since they touch disjoint files; A5 merges them.
