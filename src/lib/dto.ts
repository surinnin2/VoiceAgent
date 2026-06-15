// Plain JSON shapes returned by the API (Prisma rows serialized — Dates become strings).
// Shared by client components.

export interface AttemptDTO {
  id: string;
  recordingId: string;
  provider: string;
  model: string;
  status: "queued" | "processing" | "done" | "error" | string;
  languageCode: string;
  keyterms: string | null;
  contextPrompt: string | null;
  text: string | null;
  words: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface RecordingDTO {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  preferredAttemptId: string | null;
  createdAt: string;
  attempts?: AttemptDTO[];
  _count?: { attempts: number };
}

export interface ProviderDTO {
  id: string;
  label: string;
  model: string;
  note: string;
  available: boolean;
}
