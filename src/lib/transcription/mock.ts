import type {
  TranscribeOptions,
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionWord,
} from "./types";

// Always-available offline engine so the app runs end-to-end before any API keys are set.
// It returns a fixed transcript with a couple of intentionally low-confidence words so the
// confidence-shading UI and the retry/compare flow are demonstrable out of the box.

const SAMPLE =
  "This is a mock transcription so you can try the full record, transcribe, and retry flow without any API keys. Replace the mock engine by adding a provider key in your env file.";

export const mock: TranscriptionProvider = {
  id: "mock",
  label: "Mock (offline demo)",
  model: "mock-1",
  note: "No API key needed — fake transcript for local testing.",
  isAvailable: () => true,
  async transcribe(_audio, _mimeType, opts: TranscribeOptions): Promise<TranscriptionResult> {
    await new Promise((r) => setTimeout(r, 800)); // simulate work

    const tokens = SAMPLE.split(" ");
    let t = 0;
    const words: TranscriptionWord[] = tokens.map((text, i) => {
      const dur = 0.25 + (text.length % 4) * 0.08;
      const start = t;
      t += dur;
      // Make a few words low-confidence to show off the shading.
      const lowConf = i === 4 || i === 11 || i === 19;
      return {
        text,
        start,
        end: t,
        confidence: lowConf ? 0.42 : 0.9 + ((i * 7) % 9) / 100,
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
