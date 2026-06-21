import { prisma } from "@/lib/db";
import { getDefaultProviderId, getProvider } from "./index";
import { processAttempt } from "./process";

export interface StartOptions {
  provider?: string;
  keyterms?: string[];
  contextPrompt?: string;
  onlyMyVoice?: boolean;
}

export type StartResult =
  | { ok: true; attemptId: string }
  | { ok: false; error: string; status: number };

// Creates a TranscriptionAttempt for a recording and kicks off processing.
// Shared by the auto-on-upload path and the retry route so provider validation lives in one place.
export async function startTranscription(
  recordingId: string,
  opts: StartOptions = {},
): Promise<StartResult> {
  const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording) return { ok: false, error: "Recording not found", status: 404 };

  const providerId = opts.provider || getDefaultProviderId();
  const provider = getProvider(providerId);
  if (!provider) return { ok: false, error: `Unknown provider: ${providerId}`, status: 400 };
  if (!provider.isAvailable()) {
    return {
      ok: false,
      error: `${provider.label} is not configured — add its API key to .env`,
      status: 400,
    };
  }

  const onlyMyVoice = opts.onlyMyVoice === true;
  if (onlyMyVoice && !provider.supportsDiarization) {
    return {
      ok: false,
      error: `${provider.label} does not support "only my voice" (no diarization).`,
      status: 400,
    };
  }

  let enrolledSpeaker: string | null = null;
  if (onlyMyVoice && provider.supportsSpeakerLibrary) {
    const enrollment = await prisma.enrollment.findUnique({ where: { id: "default" } });
    if (enrollment?.consentGiven && enrollment.speakerLabel) {
      enrolledSpeaker = enrollment.speakerLabel;
    }
  }

  const keyterms = (opts.keyterms ?? [])
    .filter((t): t is string => typeof t === "string" && t.trim() !== "")
    .map((t) => t.trim());
  const contextPrompt = typeof opts.contextPrompt === "string" ? opts.contextPrompt.trim() : "";

  const attempt = await prisma.transcriptionAttempt.create({
    data: {
      recordingId: recording.id,
      provider: provider.id,
      model: provider.model,
      status: "queued",
      languageCode: "en",
      keyterms: keyterms.length ? JSON.stringify(keyterms) : null,
      contextPrompt: contextPrompt || null,
      diarized: onlyMyVoice,
      onlyEnrolledSpeaker: onlyMyVoice,
      enrolledSpeaker,
    },
  });

  // Fire-and-forget locally; on serverless this becomes a durable queue job (see deploy milestone).
  void processAttempt(attempt.id);

  return { ok: true, attemptId: attempt.id };
}
