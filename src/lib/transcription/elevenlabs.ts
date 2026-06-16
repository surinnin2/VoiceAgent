import type {
  TranscribeOptions,
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionWord,
} from "./types";

// ElevenLabs Scribe v2 — highest raw English accuracy on independent benchmarks.
// Per-word confidence is thinner here than AssemblyAI/Deepgram, so we map it when present
// and fall back to null (UI then simply doesn't shade those words).
// NOTE: model_id may need to be "scribe_v1" depending on account access.

const BASE = "https://api.elevenlabs.io/v1/speech-to-text";
const MODEL = process.env.ELEVENLABS_MODEL || "scribe_v2";

function key(): string | undefined {
  return process.env.ELEVENLABS_API_KEY?.trim() || undefined;
}

// ElevenLabs uses ISO-639-3 codes ("eng"), unlike the others ("en").
function iso3(lang?: string): string {
  if (!lang || lang === "en") return "eng";
  return lang;
}

export const elevenlabs: TranscriptionProvider = {
  id: "elevenlabs",
  label: "ElevenLabs Scribe v2",
  model: MODEL,
  note: "Highest raw English accuracy; supports diarization + 'only my voice'.",
  isAvailable: () => !!key(),
  supportsDiarization: true,
  supportsSpeakerLibrary: true,
  async transcribe(audio, mimeType, opts: TranscribeOptions): Promise<TranscriptionResult> {
    const apiKey = key();
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

    const form = new FormData();
    form.append("model_id", MODEL);
    form.append("language_code", iso3(opts.languageCode));
    form.append("timestamps_granularity", "word");
    // Diarization (who-spoke-when). use_speaker_library is inert without diarize, so we
    // enable diarize whenever either is requested.
    if (opts.diarize || opts.useSpeakerLibrary) form.append("diarize", "true");
    // Match detected speakers against the workspace Speaker Library; matched speakers come
    // back with their library name in `speaker_id` (unmatched stay "speaker_0", etc.).
    if (opts.useSpeakerLibrary) form.append("use_speaker_library", "true");
    form.append(
      "file",
      new Blob([new Uint8Array(audio)], { type: mimeType }),
      "recording",
    );

    const res = await fetch(BASE, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });
    if (!res.ok) throw new Error(`ElevenLabs failed (${res.status}): ${await res.text()}`);

    const json = (await res.json()) as {
      text?: string;
      language_code?: string;
      words?: {
        text: string;
        start?: number;
        end?: number;
        type?: string;
        logprob?: number;
        speaker_id?: string | null;
      }[];
    };

    const words: TranscriptionWord[] = (json.words || [])
      .filter((w) => w.type !== "spacing")
      .map((w) => ({
        text: w.text,
        start: w.start ?? 0,
        end: w.end ?? 0,
        // Derive a rough 0..1 confidence from logprob if the API returned one.
        confidence: typeof w.logprob === "number" ? Math.exp(w.logprob) : null,
        speaker: w.speaker_id ?? null,
      }));

    return {
      text: json.text || "",
      words,
      languageCode: json.language_code || opts.languageCode || "en",
    };
  },
};
