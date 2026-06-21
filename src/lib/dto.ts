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
  diarized: boolean;
  onlyEnrolledSpeaker: boolean;
  enrolledSpeaker: string | null;
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

export interface CategoryDTO {
  id: string;
  name: string;
  color: string | null;
  isInbox: boolean;
  position: number;
  createdAt: string;
  noteCount?: number;
}

export interface NoteDTO {
  id: string;
  title: string | null;
  body: string;
  edited: boolean;
  status: "transcribing" | "done" | "error" | string;
  categoryId: string;
  recordingId: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; color: string | null } | null;
}

export interface ProviderDTO {
  id: string;
  label: string;
  model: string;
  note: string;
  available: boolean;
  supportsDiarization: boolean;
  supportsSpeakerLibrary: boolean;
}

export interface EnrollmentDTO {
  id: string;
  label: string;
  provider: string;
  speakerLabel: string | null;
  consentGiven: boolean;
  consentAt: string | null;
  consentVersion: string;
  createdAt: string;
  updatedAt: string;
}
