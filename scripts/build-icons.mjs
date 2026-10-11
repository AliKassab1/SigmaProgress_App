/* Erzeugt die PNG-Icons aus den beiden SVG-Quellen.
   Einmal ausfuehren:  node scripts/build-icons.mjs
   Danach sind die PNGs versioniert und muessen nicht neu gebaut werden,
   ausser das Logo aendert sich.

   Die SVGs bleiben die Quelle der Wahrheit: Gradient, Lichtquellen und
   Pfaddaten stehen dort. Hier passiert nur Rastern. */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, "..", "icons");

const JOBS = [
  { source: "icon.svg", out: "icon-180.png", size: 180 },
  { source: "icon.svg", out: "icon-192.png", size: 192 },
  { source: "icon.svg", out: "icon-512.png", size: 512 },
  { source: "maskable.svg", out: "maskable-192.png", size: 192 },
  { source: "maskable.svg", out: "maskable-512.png", size: 512 },
];

for (const job of JOBS) {
  const svg = await readFile(join(iconsDir, job.source));

  /* density 384 statt der Standard-72: sonst rastet der Renderer das SVG
     auf 64×64 und skaliert das Ergebnis hoch — das sieht man am Rand. */
  const png = await sharp(svg, { density: 384 })
    .resize(job.size, job.size, { fit: "contain", background: "#0a0c0b" })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  await writeFile(join(iconsDir, job.out), png);
  console.log(`${job.out.padEnd(20)} ${job.size}×${job.size}  ${(png.length / 1024).toFixed(1)} kB`);
}

console.log("favicon.svg          (Quelle, unveraendert)");
