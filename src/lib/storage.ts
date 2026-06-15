import { promises as fs } from "fs";
import path from "path";

// Local filesystem storage for raw audio. Designed as a thin seam so it can be
// swapped for Cloudflare R2 / S3 (presigned uploads) in production without touching
// callers — only the four functions below would change.

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const AUDIO_DIR = path.join(STORAGE_ROOT, "audio");

function extFromMime(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  return "bin";
}

/** Persist audio bytes and return the relative storage path stored on the Recording. */
export async function saveAudio(
  id: string,
  mimeType: string,
  data: Buffer,
): Promise<string> {
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  const ext = extFromMime(mimeType);
  const rel = path.posix.join("audio", `${id}.${ext}`);
  await fs.writeFile(path.join(STORAGE_ROOT, rel), data);
  return rel;
}

/** Read raw audio bytes back (used by the transcription worker and the audio route). */
export async function readAudio(storagePath: string): Promise<Buffer> {
  return fs.readFile(path.join(STORAGE_ROOT, storagePath));
}

/** Best-effort delete (not currently wired to a UI, but keeps storage tidy). */
export async function deleteAudio(storagePath: string): Promise<void> {
  await fs.rm(path.join(STORAGE_ROOT, storagePath), { force: true });
}
