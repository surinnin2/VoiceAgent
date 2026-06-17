import { prisma } from "@/lib/db";
import { readAudio } from "@/lib/storage";
import { getProvider } from "./index";

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
  } catch (err) {
    await prisma.transcriptionAttempt.update({
      where: { id: attemptId },
      data: {
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
  }
}
