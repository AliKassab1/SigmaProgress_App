/* ==========================================================================
   SIGMA PROGRESS — core/messages.js
   --------------------------------------------------------------------------
   Der gemeinsame Nachrichtenspeicher fuer den 1:1-Verlauf zwischen Kunde
   und Coach.

   Bewusst NICHT pro Konto (anders als core/repo.js): ein Gespraech gehoert
   beiden Seiten. Der Kunde schreibt, sein Coach liest dieselben Nachrichten
   und antwortet von Hand. Spaeter soll auch der Admin dieselben Verlaeufe
   einsehen — deshalb liegt alles an einer Stelle und nicht im Konto.

   Eine Nachricht:

     { id, customer, coach, from, text, at, read }

       customer, coach   E-Mail-Adressen der beiden Seiten
       from              wer geschrieben hat: "kunde" oder "coach"
       at                Zeitstempel (ISO)
       read              vom Empfaenger gelesen. Bei einer Kundennachricht
                         heisst das: der Coach hat sie gesehen, bei einer
                         Coach-Nachricht: der Kunde.

   Lesen und Schreiben sind wie in core/auth.js in try/catch gefasst: der
   Zugriff auf window.localStorage kann selbst scheitern (privater Modus).
   ========================================================================== */

const STORAGE_KEY = "sigma.progress.messages";

/** Startbestand, damit das Gespraech beim ersten Oeffnen nicht leer ist. */
const DEMO_CUSTOMER = "kunde@sigma-progress.de";
const DEMO_COACH = "coach@sigma-progress.de";

/* --------------------------------------------------------------------------
   Kleine Helfer
   -------------------------------------------------------------------------- */

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function nowISO() {
  return new Date().toISOString();
}

function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* --------------------------------------------------------------------------
   Speicher
   -------------------------------------------------------------------------- */

function readFromStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    /* Kein Schluessel vorhanden: null heisst „nie angelegt" — dann wird
       unten der Startbestand geschrieben. Eine leere Liste ist dagegen eine
       bewusste Entscheidung des Nutzers und wird nicht ueberschrieben. */
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("[sigma]Nachrichten unlesbar.", error);
    return [];
  }
}

/**
 * Der Startverlauf. Vier Nachrichten, aus Sicht beider Seiten etwas
 * ungelesen — so zeigt sich die Marke beim Kunden wie beim Coach.
 */
function demoMessages() {
  const base = Date.now();
  const ago = (minutes) => new Date(base - minutes * 60000).toISOString();

  return [
    {
      id: newId(),
      customer: DEMO_CUSTOMER,
      coach: DEMO_COACH,
      from: "kunde",
      text: "Hallo, ich habe eine Frage zu meinem Plan.",
      at: ago(2880),
      read: true,
    },
    {
      id: newId(),
      customer: DEMO_CUSTOMER,
      coach: DEMO_COACH,
      from: "coach",
      text: "Klar, schiess los. Ich schaue mir deinen Stand an und melde mich.",
      at: ago(2870),
      read: true,
    },
    {
      id: newId(),
      customer: DEMO_CUSTOMER,
      coach: DEMO_COACH,
      from: "kunde",
      text: "Soll ich beim Kreuzheben diese Woche mehr Gewicht nehmen?",
      at: ago(1440),
      read: false,
    },
    {
      id: newId(),
      customer: DEMO_CUSTOMER,
      coach: DEMO_COACH,
      from: "coach",
      text: "Bleib noch bei derselben Last und bring die Technik sauber durch. Nächste Woche steigern wir.",
      at: ago(1430),
      read: false,
    },
  ];
}

/* --------------------------------------------------------------------------
   Oeffentliche API
   -------------------------------------------------------------------------- */

/**
 * Alle Nachrichten. Fehlt der Speicher, wird einmalig das Demo-Gespraech
 * angelegt. Gibt immer eine Liste zurueck, nie null.
 */
export function allMessages() {
  const stored = readFromStorage();
  if (stored !== null) return stored;

  const demo = demoMessages();
  writeAll(demo);
  return demo;
}

/** Schreibt die ganze Liste zurueck in den Speicher. */
function writeAll(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (error) {
    console.warn("[sigma]Nachrichten nicht speicherbar.", error);
    return false;
  }
}

/** Alle Nachrichten eines Kunden, aelteste zuerst. */
export function messagesFor(customerEmail) {
  const address = normalizeEmail(customerEmail);
  return allMessages()
    .filter((message) => normalizeEmail(message.customer) === address)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/**
 * Eine Nachricht anhaengen. `from` bestimmt, wer geschrieben hat — die
 * Nachricht gilt zunaechst als ungelesen, weil der Empfaenger sie noch
 * nicht gesehen hat.
 */
export function sendMessage({ customer, coach, from, text }) {
  const body = String(text || "").trim();
  if (!body) return null;

  const message = {
    id: newId(),
    customer: normalizeEmail(customer),
    coach: normalizeEmail(coach),
    from: from === "coach" ? "coach" : "kunde",
    text: body,
    at: nowISO(),
    read: false,
  };

  const list = allMessages();
  list.push(message);
  writeAll(list);
  return message;
}

/**
 * Die Gespraeche eines Coachs: je Kunde eine Zeile, die letzte Nachricht
 * zuoberst. `unread` zaehlt nur die Nachrichten, die beim Coach liegen.
 */
export function conversationsForCoach(coachEmail) {
  const address = normalizeEmail(coachEmail);
  const mine = allMessages().filter((message) => normalizeEmail(message.coach) === address);
  return buildConversations(mine);
}

/**
 * Dieselbe Liste ueber alle Kunden — fuer die spaetere Admin-Ansicht.
 * Heute wird nur die Coach-Sicht gebaut, die Form ist aber schon dieselbe.
 */
export function conversationsForAdmin() {
  return buildConversations(allMessages());
}

/** Ungelesene Coach-Nachrichten fuer einen Kunden. */
export function unreadForCustomer(customerEmail) {
  const address = normalizeEmail(customerEmail);
  return allMessages().filter(
    (message) =>
      normalizeEmail(message.customer) === address &&
      message.from === "coach" &&
      !message.read
  ).length;
}

/** Ungelesene Kundennachrichten fuer einen Coach. */
export function unreadForCoach(coachEmail) {
  const address = normalizeEmail(coachEmail);
  return allMessages().filter(
    (message) =>
      normalizeEmail(message.coach) === address &&
      message.from === "kunde" &&
      !message.read
  ).length;
}

/**
 * Gelesen setzen. `reader` ist die Seite, die gerade liest — markiert werden
 * also die eingehenden Nachrichten der jeweils anderen Seite.
 * Gibt die Anzahl der geaenderten Nachrichten zurueck.
 */
export function markRead(customerEmail, reader) {
  const address = normalizeEmail(customerEmail);
  const who = reader === "coach" ? "coach" : "kunde";
  const list = allMessages();
  let changed = 0;

  for (const message of list) {
    if (normalizeEmail(message.customer) !== address) continue;
    /* Eigene Nachrichten gelten nicht als ungelesen. */
    if (message.from === who) continue;
    if (message.read) continue;

    message.read = true;
    changed += 1;
  }

  if (changed) writeAll(list);
  return changed;
}

/* --------------------------------------------------------------------------
   Zusammenfassen
   -------------------------------------------------------------------------- */

/** Aus einer Nachrichtenliste die Zeilen je Kunde bauen. */
function buildConversations(list) {
  const groups = new Map();

  for (const message of list) {
    const key = normalizeEmail(message.customer);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(message);
  }

  const out = [];

  for (const [customer, messages] of groups) {
    const sorted = messages.slice().sort((a, b) => (a.at < b.at ? -1 : 1));
    const last = sorted[sorted.length - 1];

    out.push({
      customer,
      coach: normalizeEmail(last.coach),
      last: last.text,
      lastAt: last.at,
      unread: sorted.filter((message) => message.from === "kunde" && !message.read).length,
    });
  }

  /* Die frischeste Unterhaltung zuerst. */
  return out.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}
