import { assemblyai } from "./assemblyai";
import { deepgram } from "./deepgram";
import { elevenlabs } from "./elevenlabs";
import { mock } from "./mock";
import type { TranscriptionProvider } from "./types";

// Registry order = retry-picker order = default-preference order.
// AssemblyAI is the preferred default; mock guarantees the app always works.
const PROVIDERS: TranscriptionProvider[] = [assemblyai, elevenlabs, deepgram, mock];

export function listProviders() {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    model: p.model,
    note: p.note,
    available: p.isAvailable(),
  }));
}

export function getProvider(id: string): TranscriptionProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** First available real engine, else the always-on mock. */
export function getDefaultProviderId(): string {
  const firstReal = PROVIDERS.find((p) => p.id !== "mock" && p.isAvailable());
  return firstReal?.id ?? "mock";
}

export type { TranscriptionProvider } from "./types";
