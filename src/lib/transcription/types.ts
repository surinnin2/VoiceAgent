// Provider-agnostic contract. Every engine maps its native response into these shapes
// so the UI (confidence shading, diffing) and the retry flow never care which engine ran.

export interface TranscriptionWord {
  text: string;
  start: number; // seconds
  end: number; // seconds
  confidence: number | null; // 0..1, or null when the provider doesn't expose per-word confidence
  speaker?: string | null; // diarization label, e.g. "speaker_0" or an enrolled name; null/undefined if not diarized
}

export interface TranscriptionResult {
  text: string;
  words: TranscriptionWord[];
  languageCode: string;
}

export interface TranscribeOptions {
  /** Domain vocabulary / proper nouns to bias decoding toward (keyterm prompting). */
  keyterms?: string[];
  /** Free-text context prompt (used by engines that support it). */
  contextPrompt?: string;
  /** ISO language; defaults to English. */
  languageCode?: string;
  /** Return per-word speaker labels (who-spoke-when). */
  diarize?: boolean;
  /** Match diarized speakers against the provider's enrolled Speaker Library. */
  useSpeakerLibrary?: boolean;
  /**
   * The enrolled speaker label we want to keep ("me"). Real engines (ElevenLabs) match
   * server-side via the library and return this name in `speaker`; the mock engine uses
   * this to label its primary speaker so the local "only my voice" demo works end-to-end.
   */
  enrolledSpeaker?: string;
}

export interface TranscriptionProvider {
  /** Stable id stored on the attempt. */
  id: string;
  /** Human-facing label shown in the engine picker. */
  label: string;
  /** Model identifier reported back for the attempt record. */
  model: string;
  /** Whether the required API key is configured (mock is always available). */
  isAvailable: () => boolean;
  /** One-line note shown in the UI about what this engine is good for. */
  note: string;
  /** Returns per-word speaker labels when asked to diarize. */
  supportsDiarization: boolean;
  /** Can match diarized speakers against an enrolled voiceprint (Speaker Library). */
  supportsSpeakerLibrary: boolean;
  transcribe: (
    audio: Buffer,
    mimeType: string,
    opts: TranscribeOptions,
  ) => Promise<TranscriptionResult>;
}
