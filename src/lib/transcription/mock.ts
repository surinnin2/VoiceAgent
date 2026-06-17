import type {
  TranscribeOptions,
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionWord,
} from "./types";

// Always-available offline engine so the app runs end-to-end before any API keys are set.
// It returns a fixed transcript with a couple of intentionally low-confidence words so the
// confidence-shading UI and the retry/compare flow are demonstrable out of the box.
// When asked to diarize, it fakes a second speaker (an interjection) so the "only my voice"
// filter can be tested locally without an ElevenLabs key.

const SAMPLE =
  "This is a mock transcription so you can try the full record, transcribe, and retry flow without any API keys. Replace the mock engine by adding a provider key in your env file.";

// Word indices spoken by a second (other) person when diarizing.
const OTHER_SPEAKER_RANGE = { from: 8, to: 14 };

export const mock: TranscriptionProvider = {
  id: "mock",
  label: "Mock (offline demo)",
  model: "mock-1",
  note: "No API key needed — fake transcript (diarizes too) for local testing.",
  isAvailable: () => true,
  supportsDiarization: true,
  // Pretend to support a speaker library so the "only my voice" auto-match path is fully
  // demoable offline: when enrolled, the mock labels its primary speaker with your name.
  supportsSpeakerLibrary: true,
  async transcribe(_audio, _mimeType, opts: TranscribeOptions): Promise<TranscriptionResult> {
    await new Promise((r) => setTimeout(r, 800)); // simulate work

    // Primary speaker = the enrolled user (so "only my voice" auto-match works in the demo).
    const me = opts.enrolledSpeaker || "speaker_0";
    const other = "speaker_1";

    const tokens = SAMPLE.split(" ");
    let t = 0;
    const words: TranscriptionWord[] = tokens.map((text, i) => {
      const dur = 0.25 + (text.length % 4) * 0.08;
      const start = t;
      t += dur;
      // Make a few words low-confidence to show off the shading.
      const lowConf = i === 4 || i === 11 || i === 19;
      const isOther = i >= OTHER_SPEAKER_RANGE.from && i <= OTHER_SPEAKER_RANGE.to;
      return {
        text,
        start,
        end: t,
        confidence: lowConf ? 0.42 : 0.9 + ((i * 7) % 9) / 100,
        speaker: opts.diarize ? (isOther ? other : me) : null,
      };
    });

    // Reflect any keyterms back into the text so retries visibly differ.
    const suffix = opts.keyterms?.length
      ? ` [keyterms applied: ${opts.keyterms.join(", ")}]`
      : "";

    return {
      text: SAMPLE + suffix,
      words,
      languageCode: opts.languageCode || "en",
    };
  },
};
