/* ==========================================================================
   SIGMA PROGRESS — core/format.js
   --------------------------------------------------------------------------
   Datum, Zahl und Text in Schweizer Format. Eine einzige Stelle, an der
   formatiert wird — dadurch bleibt die Oberfläche konsistent, egal ob ein
   Wert aus localStorage oder spaeter aus einer API kommt.
   ========================================================================== */

const LOCALE = "de-CH";

const numberFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit" });
const dateLongFormat = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const weekdayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "long" });
const weekdayShortFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });

/* --- Datum ---------------------------------------------------------------- */

/** Lokales Tagesdatum als "JJJJ-MM-TT". KEIN toISOString() — das liefert
    in Mitteleuropa bei Morgenumschlag den Vortag. */
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "JJJJ-MM-TT" -> lokales Datum um Mitternacht (verhindert Zeitzonen-Drift). */
export function parseDay(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(key, amount) {
  const date = parseDay(key);
  date.setDate(date.getDate() + amount);
  return dayKey(date);
}

/** Differenz in ganzen Tagen (b - a). */
export function daysBetween(a, b) {
  const ms = parseDay(b).getTime() - parseDay(a).getTime();
  return Math.round(ms / 86400000);
}

/** Montag der Woche von `key`. Kalenderwoche beginnt in CH am Montag. */
export function weekStart(key = dayKey()) {
  const date = parseDay(key);
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  return dayKey(date);
}

export function lastNDays(n, from = dayKey()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(from, -i));
  return out;
}

export function fmtDate(key) {
  if (!key) return "—";
  return dateFormat.format(parseDay(key));
}

export function fmtDateLong(key) {
  if (!key) return "—";
  return dateLongFormat.format(parseDay(key));
}

export function fmtWeekday(key) {
  return weekdayFormat.format(parseDay(key));
}

export function fmtWeekdayShort(key) {
  return weekdayShortFormat.format(parseDay(key));
}

export function fmtTime(stamp) {
  return timeFormat.format(new Date(stamp));
}

/** Relative Tageangabe, aber nur wenn sie etwas bringt. */
export function fmtRelativeDay(key) {
  const diff = daysBetween(dayKey(), key);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  if (diff === -1) return "Gestern";
  if (diff > 1 && diff <= 6) return `In ${diff} Tagen`;
  if (diff < -1 && diff >= -6) return `Vor ${Math.abs(diff)} Tagen`;
  return fmtDateLong(key);
}

/* --- Zahl ----------------------------------------------------------------- */

export function fmtNum(value) {
  return numberFormat.format(Math.round(value || 0));
}

export function fmtDecimal(value, digits = 1) {
  const formatted = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);
  return formatted;
}

export function fmtKg(value) {
  return `${fmtDecimal(value)} kg`;
}

/** 125 -> "2:05 min", 45 -> "45 min". */
export function fmtMinutes(total) {
  const min = Math.max(0, Math.round(total || 0));
  if (min < 60) return `${fmtNum(min)} min`;
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Sekunden -> "MM:SS" fuer die Pausenuhr. */
export function fmtClock(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Vorzeichenbehaftete Differenz, z.B. "-2,3 kg". */
export function fmtDelta(value, unit = "kg", digits = 1) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return `±0 ${unit}`;
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${fmtDecimal(Math.abs(rounded), digits)} ${unit}`;
}

/* --- Text ----------------------------------------------------------------- */

export function plural(n, one, many) {
  return n === 1 ? one : many;
}

/** "Lena M." aus einem vollen Namen. */
export function shortName(name) {
  const parts = String(name || "").trim().split(/\s+/);
  if (!parts[0]) return "du";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[1][0]}.`;
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "–";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

/** Erster Buchstabe gross, Rest klein. */
export function capitalise(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
