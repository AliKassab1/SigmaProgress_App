/* ==========================================================================
   SIGMA PROGRESS — core/repo.js
   --------------------------------------------------------------------------
   EINZIGE Stelle, an der Trainingsdaten gelesen und geschrieben werden.

   Das ist bewusst die einzige Datei, die localStorage kennt (die Zugänge
   liegen in core/auth.js). Ein spaeteres Backend wird hier angeschlossen,
   ohne dass ein Screen angefasst werden muss:

     - read()  -> GET  /api/state
     - write() -> PUT  /api/state
     - reset() -> POST /api/demo/reset

   Alle Aktionen der App laufen ueber `update(fn)`: `fn` bekommt den
   aktuellen Zustand, mutiert ihn und gibt ihn zurueck. Danach wird
   gespeichert und allen Abonnierten Bescheid gegeben. Damit ist jede
   Aenderung automatisch persistent und automatisch im Bildschirm sichtbar.
   ========================================================================== */

import { buildSeed } from "../data/seed.js";

const STORAGE_KEY = "sigma.progress.state";
const SCHEMA_VERSION = 1;

let state = null;
let owner = null;
const listeners = new Set();

/* --------------------------------------------------------------------------
   Wessen Daten
   --------------------------------------------------------------------------
   Jedes Konto hat seinen eigenen Bestand, sonst sieht man nach dem
   Kontowechsel die Gewichtslinie des Vorgängers. Der Gast bekommt den
   Bereich ohne Zusatz — das ist der Bestand, den es schon vor den Konten
   gab, und der wird von niemandem gelesen.
   -------------------------------------------------------------------------- */

export function useOwner(scope) {
  owner = scope || null;
}

function storageKey() {
  return owner ? `${STORAGE_KEY}.${owner}` : STORAGE_KEY;
}

/* --------------------------------------------------------------------------
   Lesen / Schreiben
   -------------------------------------------------------------------------- */

/**
 * Absichtlich async: die jetzige Implementierung ist synchron, aber eine
 * API-Anbindung ist es nicht. Alles darueber bleibt deshalb gleich.
 */
async function read() {
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SCHEMA_VERSION) return null;
    return parsed;
  } catch (error) {
    console.warn("[sigma]Gespeicherter Stand unlesbar, starte mit Demodaten.", error);
    return null;
  }
}

async function write(next) {
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(next));
    return true;
  } catch (error) {
    /* Der wahrscheinlichste Grund ist das 5-MB-Limit mit Fotos. */
    const full = error && /quota/i.test(String(error.name || error));
    console.error("[sigma]Speichern fehlgeschlagen.", error);
    notifyError(
      full
        ? "Der Speicher ist voll. Bitte lösche ein Foto in „Tracken › Fotos“."
        : "Änderung konnte nicht gespeichert werden."
    );
    return false;
  }
}

/* --------------------------------------------------------------------------
   Oeffentliche API
   -------------------------------------------------------------------------- */

export function getState() {
  return state;
}

export function isOnboarded() {
  return Boolean(state && state.onboarded);
}

/** Abonniert Zustandsaenderungen. Gibt eine Abmeldefunktion zurueck. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (error) {
      console.error("[sigma]Fehler im Abonnenten.", error);
    }
  }
}

/** Fehler, die an allen Screens sichtbar sind (z.B. Speicher voll). */
let errorHandler = null;
export function onError(handler) {
  errorHandler = handler;
}
function notifyError(message) {
  if (errorHandler) errorHandler(message);
}

/**
 * Zustand aendern. `mutator` bekommt den Zustand und veraendert ihn direkt
 * oder gibt einen neuen zurueck.
 */
export async function update(mutator) {
  const draft = state || buildSeed();
  const next = (await mutator(draft)) || draft;
  next.version = SCHEMA_VERSION;

  const ok = await write(next);
  if (!ok) return state;

  state = next;
  emit();
  return state;
}

/**
 * Erste Ladung.
 *
 * Ohne gespeicherten Stand beginnt die App beim Onboarding. Das ist kein
 * Formular-leerer Start: das Onboarding rechnet aus den Angaben sofort
 * einen gefuellten Demostand, damit die App beim ersten Oeffnen etwas zu
 * zeigen hat und der Nutzer sieht, worauf er sich einlaesst.
 *
 * `demo: true` liefert stattdessen den Bestand des Demokontos — dort soll
 * sofort etwas zu sehen sein, ohne vier Schritte Formular davor.
 */
export async function init({ demo = false } = {}) {
  const stored = await read();
  state = stored || buildSeed({ onboarded: demo });

  if (!stored) await write(state);

  /* Ein Tag ohne Eintraege sieht sonst im Diagramm wie ein Loch aus. */
  await update((draft) => {
    if (!draft.profile) draft.profile = buildSeed().profile;
    if (!draft.workouts) draft.workouts = buildSeed().workouts;
    if (!draft.goals) draft.goals = buildSeed().goals;
    if (!Array.isArray(draft.chat)) draft.chat = [];
    if (!Array.isArray(draft.weights)) draft.weights = [];
    if (!Array.isArray(draft.photos)) draft.photos = [];
  });

  return state;
}

/** Alles zuruecksetzen und Demodaten neu erzeugen. */
export async function reset({ onboarding = false } = {}) {
  const fresh = buildSeed({ onboarded: onboarding });
  await write(fresh);
  state = fresh;
  emit();
  return state;
}

/** Ausgabe fuer Backup/Export im Profil. */
export function exportState() {
  return JSON.stringify(state, null, 2);
}
