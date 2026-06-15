import type {
  TranscribeOptions,
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionWord,
} from "./types";

// AssemblyAI Universal-3 Pro — our default engine: top-tier English accuracy plus
// well-documented per-word confidence and keyterm prompting (the retry-UX essentials).
// Flow: upload bytes -> create transcript -> poll until completed.
// NOTE: model id / keyterm param names move over time — verify against current docs.

const BASE = "https://api.assemblyai.com";
const MODEL = process.env.ASSEMBLYAI_SPEECH_MODEL || "universal-3-pro";

function key(): string | undefined {
  return process.env.ASSEMBLYAI_API_KEY?.trim() || undefined;
}

async function uploadAudio(audio: Buffer, apiKey: string): Promise<string> {
  const res = await fetch(`${BASE}/v2/upload`, {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/octet-stream" },
    body: new Uint8Array(audio),
  });
  if (!res.ok) throw new Error(`AssemblyAI upload failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { upload_url: string };
  return json.upload_url;
}

export const assemblyai: TranscriptionProvider = {
  id: "assemblyai",
  label: "AssemblyAI Universal-3 Pro",
  model: MODEL,
  note: "Default — strong English accuracy + per-word confidence + keyterms.",
  isAvailable: () => !!key(),
  async transcribe(audio, _mimeType, opts: TranscribeOptions): Promise<TranscriptionResult> {
    const apiKey = key();
    if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is not set");

    const audioUrl = await uploadAudio(audio, apiKey);

    const body: Record<string, unknown> = {
      audio_url: audioUrl,
      // AssemblyAI replaced the singular `speech_model` with a `speech_models` array.
      speech_models: [MODEL],
      language_code: opts.languageCode || "en",
      punctuate: true,
      format_text: true,
    };
    if (opts.keyterms?.length) body.keyterms_prompt = opts.keyterms;

    const createRes = await fetch(`${BASE}/v2/transcript`, {
      method: "POST",
      headers: { authorization: apiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!createRes.ok)
      throw new Error(`AssemblyAI create failed (${createRes.status}): ${await createRes.text()}`);
    const created = (await createRes.json()) as { id: string };

    // Poll. Universal models are fast, but transcripts are async by design.
    const deadline = Date.now() + 1000 * 60 * 10; // 10 min ceiling
    while (Date.now() < deadline) {
      const pollRes = await fetch(`${BASE}/v2/transcript/${created.id}`, {
        headers: { authorization: apiKey },
      });
      if (!pollRes.ok)
        throw new Error(`AssemblyAI poll failed (${pollRes.status}): ${await pollRes.text()}`);
      const t = (await pollRes.json()) as {
        status: string;
        text?: string;
        language_code?: string;
        error?: string;
        words?: { text: string; start: number; end: number; confidence: number }[];
      };
      if (t.status === "completed") {
        const words: TranscriptionWord[] = (t.words || []).map((w) => ({
          text: w.text,
          start: w.start / 1000,
          end: w.end / 1000,
          confidence: typeof w.confidence === "number" ? w.confidence : null,
        }));
        return { text: t.text || "", words, languageCode: t.language_code || "en" };
      }
      if (t.status === "error") throw new Error(`AssemblyAI: ${t.error || "transcription error"}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error("AssemblyAI transcription timed out");
  },
};
