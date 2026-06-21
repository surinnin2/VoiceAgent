import sharp from "sharp";
import { mkdirSync } from "fs";

// Regenerate PWA icons: a mic glyph in record-red (#f85149) on the app's dark bg (#0f1115).
// Full-bleed square so the same art also works as a maskable icon (glyph sits inside the safe zone).
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f1115"/>
  <rect x="211" y="120" width="90" height="180" rx="45" fill="#f85149"/>
  <path d="M176 270 a80 80 0 0 0 160 0" fill="none" stroke="#e6e8ec" stroke-width="18" stroke-linecap="round"/>
  <path d="M256 350 L256 405" fill="none" stroke="#e6e8ec" stroke-width="18" stroke-linecap="round"/>
  <path d="M206 405 L306 405" fill="none" stroke="#e6e8ec" stroke-width="18" stroke-linecap="round"/>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const jobs = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/icon-maskable-512.png", 512],
  ["public/apple-touch-icon.png", 180],
];
for (const [out, size] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log("wrote", out, size + "px");
}
