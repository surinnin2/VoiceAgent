// Client-safe presentation helpers.

/** Background highlight for a word given its confidence (null = no shading). */
export function confidenceBg(c: number | null): string | undefined {
  if (c === null || c === undefined) return undefined;
  if (c >= 0.9) return undefined;
  const alpha = Math.min(0.6, (0.9 - c) * 1.1);
  return `rgba(230, 90, 50, ${alpha.toFixed(2)})`;
}

export function isLowConfidence(c: number | null): boolean {
  return c !== null && c < 0.6;
}

export function formatDuration(ms?: number | null): string {
  if (!ms || ms < 0) return "0:00";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Color per speaker (by order of appearance) for the diarization filter chips/dots.
const SPEAKER_COLORS = ["#5b8cff", "#3fb950", "#d29922", "#bc6ff1", "#f85149", "#26c0c0"];
export function speakerColor(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}
