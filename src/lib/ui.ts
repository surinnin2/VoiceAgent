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
