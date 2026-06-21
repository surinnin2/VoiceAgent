import { prisma } from "@/lib/db";
import { readAudio } from "@/lib/storage";
import { getProvider } from "./index";

// Derive a short, scannable note title from the transcript (first line / first ~8 words).
function titleFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const firstLine = trimmed.split(/\r?\n/)[0].trim();
  const words = firstLine.split(/\s+/).slice(0, 8).join(" ");
  const title = words.length > 60 ? `${words.slice(0, 57)}…` : words;
  return title || null;
}

// Reflect a finished transcription onto the categorized note, without clobbering hand-edits.
async function applyToNote(
  recordingId: string,
  outcome: { status: "done"; text: string } | { status: "error" },
): Promise<void> {
  const note = await prisma.note.findUnique({ where: { recordingId } });
  if (!note) return;
  if (outcome.status === "done") {
    // Write body/title atomically guarded by `edited` in the WHERE clause, so a user edit that
    // lands while transcription is in flight is never overwritten (the row simply won't match).
    await prisma.note.updateMany({
      where: { recordingId, edited: false },
      data: { body: outcome.text, title: titleFromText(outcome.text) },
    });
    await prisma.note.updateMany({ where: { recordingId }, data: { status: "done" } });
  } else {
    // Failed: keep any text we already have (revert to done), else surface the error. This also
    // un-sticks a retry that failed on a note that already had a good transcript.
    await prisma.note.updateMany({
      where: { recordingId },
      data: { status: note.body ? "done" : "error" },
    });
  }
}

// Runs a single transcription attempt to completion and writes the result back.
// Invoked fire-and-forget from the transcribe route; in production this is the unit of
// work you'd move into a durable queue (Inngest/QStash) so it survives process restarts.
export async function processAttempt(attemptId: string): Promise<void> {
  const attempt = await prisma.transcriptionAttempt.findUnique({
    where: { id: attemptId },
    include: { recording: true },
  });
  if (!attempt) return;

  const provider = getProvider(attempt.provider);
  if (!provider) {
    await prisma.transcriptionAttempt.update({
      where: { id: attemptId },
      data: {
        status: "error",
        errorMessage: `Unknown provider: ${attempt.provider}`,
        completedAt: new Date(),
      },
    });
    return;
  }

  const startedAt = new Date();
  await prisma.transcriptionAttempt.update({
    where: { id: attemptId },
    data: { status: "processing", startedAt },
  });

  try {
    const audio = await readAudio(attempt.recording.storagePath);
    const keyterms = attempt.keyterms ? (JSON.parse(attempt.keyterms) as string[]) : undefined;

    const result = await provider.transcribe(audio, attempt.recording.mimeType, {
      keyterms,
      contextPrompt: attempt.contextPrompt ?? undefined,
      languageCode: attempt.languageCode,
      diarize: attempt.diarized,
      useSpeakerLibrary:
        attempt.onlyEnrolledSpeaker &&
        provider.supportsSpeakerLibrary &&
        !!attempt.enrolledSpeaker,
      enrolledSpeaker: attempt.enrolledSpeaker ?? undefined,
    });

    const completedAt = new Date();
    await prisma.transcriptionAttempt.update({
      where: { id: attemptId },
      data: {
        status: "done",
        text: result.text,
        words: JSON.stringify(result.words),
        languageCode: result.languageCode,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    });
    await applyToNote(attempt.recordingId, { status: "done", text: result.text });
  } catch (err) {
    await prisma.transcriptionAttempt.update({
      where: { id: attemptId },
      data: {
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
    await applyToNote(attempt.recordingId, { status: "error" });
  }
}
