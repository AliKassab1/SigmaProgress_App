/* ==========================================================================
   SIGMA PROGRESS — data/photos.js
   --------------------------------------------------------------------------
   Platzhalter fuer Fortschrittsfotos.

   Ein Prototyp hat keine echten Fotos. Statt leerer Kacheln wird ein
   bewusst als Beispiel beschriftetes Bild erzeugt — so ist auf den ersten
   Blick klar, was echt ist und was nicht. Sobald der Nutzer ein echtes
   Foto hochlaedt, ersetzt es den Platzhalter.
   ========================================================================== */

import { dayKey, fmtDate } from "../core/format.js";

const PALETTE = [
  ["#10161a", "#182320"],
  ["#0f1512", "#1b2419"],
  ["#111519", "#18201f"],
  ["#0e1413", "#17201d"],
];

/**
 * Erzeugt ein Beispielbild als SVG-Data-URL.
 * Kein Netzwerk, kein Canvas — reines Markup.
 */
export function placeholderPhoto({ date = dayKey(), weight = null, index = 0 } = {}) {
  const [from, to] = PALETTE[index % PALETTE.length];
  const label = weight ? `${weight.toFixed(1).replace(".", ",")} kg` : "Beispiel";
  const caption = fmtDate(date);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 480 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <linearGradient id="fig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#22c77e" stop-opacity=".26"/>
      <stop offset="1" stop-color="#22c77e" stop-opacity=".05"/>
    </linearGradient>
  </defs>
  <rect width="480" height="600" fill="url(#bg)"/>
  <g opacity=".5">
    <path d="M0 470h480M0 380h480M0 290h480M0 200h480" stroke="#ffffff" stroke-opacity=".045"/>
  </g>
  <g fill="url(#fig)" stroke="#22c77e" stroke-opacity=".5" stroke-width="2">
    <circle cx="240" cy="188" r="46"/>
    <path d="M240 246c-52 0-84 34-90 88l-12 108c-2 20 10 34 28 34h148c18 0 30-14 28-34l-12-108c-6-54-38-88-90-88z"/>
    <path d="M156 292c-14 46-18 92-14 138M324 292c14 46 18 92 14 138" stroke-opacity=".35"/>
  </g>
  <g font-family="ui-monospace, monospace">
    <text x="32" y="56" fill="#22c77e" font-size="15" letter-spacing="3">BEISPIEL</text>
    <text x="32" y="546" fill="#f2f6f4" font-size="34" font-weight="700">${label}</text>
    <text x="32" y="576" fill="#7c8981" font-size="17" letter-spacing="2">${caption}</text>
  </g>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
