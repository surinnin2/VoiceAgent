import type {
  TranscribeOptions,
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionWord,
} from "./types";

// Deepgram Nova-3 — best-documented per-word confidence + keyterm prompting; very fast.
// Single synchronous request: POST raw bytes, get words[] with confidence back.

const BASE = "https://api.deepgram.com/v1/listen";
const MODEL = process.env.DEEPGRAM_MODEL || "nova-3";

function key(): string | undefined {
  return process.env.DEEPGRAM_API_KEY?.trim() || undefined;
}

export const deepgram: TranscriptionProvider = {
  id: "deepgram",
  label: "Deepgram Nova-3",
  model: MODEL,
  note: "Best per-word confidence + keyterm prompting; fastest.",
  isAvailable: () => !!key(),
  async transcribe(audio, mimeType, opts: TranscribeOptions): Promise<TranscriptionResult> {
    const apiKey = key();
    if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not set");

    const params = new URLSearchParams({
      model: MODEL,
      language: opts.languageCode || "en",
      punctuate: "true",
      smart_format: "true",
    });
    // Nova-3 keyterm prompting: repeat the `keyterm` param per term.
    for (const term of opts.keyterms || []) params.append("keyterm", term);

    const res = await fetch(`${BASE}?${params.toString()}`, {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": mimeType },
      body: new Uint8Array(audio),
    });
    if (!res.ok) throw new Error(`Deepgram failed (${res.status}): ${await res.text()}`);

    const json = (await res.json()) as {
      results?: {
        channels?: {
          alternatives?: {
            transcript?: string;
            words?: { word: string; punctuated_word?: string; start: number; end: number; confidence: number }[];
          }[];
        }[];
      };
    };
    const alt = json.results?.channels?.[0]?.alternatives?.[0];
    const words: TranscriptionWord[] = (alt?.words || []).map((w) => ({
      text: w.punctuated_word || w.word,
      start: w.start,
      end: w.end,
      confidence: typeof w.confidence === "number" ? w.confidence : null,
    }));
    return {
      text: alt?.transcript || "",
      words,
      languageCode: opts.languageCode || "en",
    };
  },
};
