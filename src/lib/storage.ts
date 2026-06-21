import { promises as fs } from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Audio storage seam. Two drivers behind one interface so callers never change:
//   - "local": filesystem under ./storage (zero-setup local dev)
//   - "r2":    Cloudflare R2 (S3-compatible) — required in production, since serverless
//              filesystems are ephemeral/read-only.
// Select with STORAGE_DRIVER=local|r2. Defaults to "local" unless STORAGE_DRIVER=r2.

const DRIVER = process.env.STORAGE_DRIVER === "r2" ? "r2" : "local";
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

// --- R2 (S3) driver ---
let _r2: S3Client | null = null;
function r2(): S3Client {
  if (!_r2) {
    const accountId = process.env.R2_ACCOUNT_ID;
    if (!accountId) throw new Error("R2_ACCOUNT_ID is not set");
    _r2 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return _r2;
}
function bucket(): string {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error("R2_BUCKET is not set");
  return b;
}

/** Persist audio bytes and return the relative storage key stored on the Recording. */
export async function saveAudio(
  id: string,
  mimeType: string,
  data: Buffer,
): Promise<string> {
  const key = path.posix.join("audio", `${id}.${extFromMime(mimeType)}`);
  if (DRIVER === "r2") {
    await r2().send(
      new PutObjectCommand({ Bucket: bucket(), Key: key, Body: data, ContentType: mimeType }),
    );
    return key;
  }
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.writeFile(path.join(STORAGE_ROOT, key), data);
  return key;
}

/** Read raw audio bytes back (used by the transcription worker and the audio route). */
export async function readAudio(storagePath: string): Promise<Buffer> {
  if (DRIVER === "r2") {
    const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: storagePath }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  return fs.readFile(path.join(STORAGE_ROOT, storagePath));
}

/** Best-effort delete so storage stays tidy when a note is deleted. */
export async function deleteAudio(storagePath: string): Promise<void> {
  if (DRIVER === "r2") {
    await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: storagePath }));
    return;
  }
  await fs.rm(path.join(STORAGE_ROOT, storagePath), { force: true });
}
