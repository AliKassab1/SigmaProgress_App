/* ==========================================================================
   SIGMA PROGRESS — core/auth.js
   --------------------------------------------------------------------------
   Konten, Rollen, Freigaben und Anmeldung.

   Zusammen mit core/repo.js ist das der einzige Ort, der einen Speicher
   kennt: repo.js fuer die Trainingsdaten, diese Datei fuer die Zugangsdaten.
   Die Trennung ist Absicht — ein Passwort-Hash gehoert nicht in denselben
   Datensatz wie der Ernaehrungskalender, und schon gar nicht in die
   Sicherung, die man im Profil herunterlaedt.

   Drei Rollen:

     kunde  — eigene Trainingsdaten, eigene Ernaehrung, eigene Termine
     coach  — Mitarbeiter, betreut seine eigenen Kunden
     admin  — Inhaber: Anfragen, Kunden, Coaches, Abos

   Ein Konto traegt ausserdem einen Freigabestatus:

     wartend      beantragt, aber noch nicht freigeschaltet. Erst die
                  Probestunde, danach schaltet der Admin frei.
     freigegeben  aktiv, volles Abo
     abgelehnt    die Anfrage wurde abgelehnt; es gab nie eine Freigabe
     gesperrt     der Zugang war aktiv und wurde entzogen

   Anfragen kommen von zwei Seiten: aus dem Anfrageformular der Website und
   aus der Registrierung in der App. Beides landet in derselben Liste, die
   nur der Admin sieht.

   Echt ist hier: die Pruefung von E-Mail und Passwort, eine Sitzung, die
   den nächsten Start ueberlebt (wenn man das will), Rollen, Freigaben und
   ein eigener Trainingsdatenbestand je Konto.

   Nicht echt: Server, E-Mail-Versand, echter Passwortschutz. Ohne Backend
   liegen Hash und Verwaltung im selben Browser-Speicher. Daran aendert
   diese Datei nichts — sie hält die Schleife wenigstens an einer Stelle.
   ========================================================================== */

const ACCOUNTS_KEY = "sigma.progress.accounts";
const REQUESTS_KEY = "sigma.progress.requests";
const SESSION_KEY = "sigma.progress.session";
const LAST_KEY = "sigma.progress.last";

/** Kuerzer geht es nicht: darunter ist ein Passwort ein Satz aus einem Wort. */
export const MIN_PASSWORD = 8;

/** Ein Tarif fuer alle Kunden: voller Zugang, monatlich kündbar. */
export const PRICE_EUR = 100;

/* --------------------------------------------------------------------------
   Speicher
   --------------------------------------------------------------------------
   Ueber den Namen statt ueber window.localStorage, weil der Zugriff auf
   window.sessionStorage selbst scheitern kann (Sicherheitsrichtlinie im
   privaten Modus). Deshalb ist jeder Zugriff in try/catch.
   -------------------------------------------------------------------------- */

function readFrom(which, key) {
  try {
    const raw = window[which].getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("[sigma]Anmeldedaten unlesbar.", error);
    return null;
  }
}

function writeTo(which, key, value) {
  try {
    window[which].setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("[sigma]Anmeldedaten nicht speicherbar.", error);
    return false;
  }
}

function dropFrom(which, key) {
  try {
    window[which].removeItem(key);
  } catch (error) {
    /* Weglassen ist kein Fehler, den man anzeigen kann. */
  }
}

/* --------------------------------------------------------------------------
   Kleine Helfer
   -------------------------------------------------------------------------- */

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function nowISO() {
  return new Date().toISOString();
}

/** Kalendertag als YYYY-MM-DD — das Format, das ein Datumsfeld versteht. */
function dayKey(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Grobe, aber ehrliche Pruefung: ein @, ein Punkt danach, keine Leerzeichen. */
function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/* --------------------------------------------------------------------------
   Signatur aus Salt und Passwort
   --------------------------------------------------------------------------
   SHA-256 ueber beides. Das ist kein echter Passwortschutz — ohne Server
   gibt es nichts zu schuetzen, und mit Server muesste es PBKDF2 oder
   Argon2 sein. Was es hier immerhin verhindert: dass das Passwort im
   Klartext neben den Trainingsdaten liegt.
   -------------------------------------------------------------------------- */

async function digest(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);

  /* crypto.subtle gibt es nur im sicheren Kontext (https oder localhost).
     Ueber die IP-Adresse eines Handys fehlt es — dann laeuft die App weiter,
     nur eben mit dem Ersatz unten. */
  const subtle = window.crypto ? window.crypto.subtle : null;
  if (!subtle) return fallbackHash(bytes);

  const hash = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Ersatz ohne sicheren Kontext. FNV-1a, zweimal versetzt.
 *
 * Vergibt: es haelt falsche Passwoerter zuverlaessig fern. Mehr kann es
 * hier nicht geben, und mehr soll es auch nicht so tun.
 */
function fallbackHash(bytes) {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;

  for (let index = 0; index < bytes.length; index += 1) {
    a = Math.imul(a ^ bytes[index], 0x01000193) >>> 0;
    b = Math.imul(b + bytes[index] + index, 0x85ebca6b) >>> 0;
  }

  return `f${a.toString(16)}${b.toString(16)}`;
}

function newSalt() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* --------------------------------------------------------------------------
   Sitzung
   -------------------------------------------------------------------------- */

/**
 * Die aktuelle Sitzung, oder null.
 *
 * Eine Sitzung im localStorage ueberlebt den Browser-Neustart — nur wenn
 * ausdruecklich gewaehlt. Sonst liegt sie im sessionStorage und ist weg,
 * sobald der Tab geschlossen wird. Genau das verspricht der Schalter
 * „Angemeldet bleiben", deshalb ist es hier und nicht im Bildschirm.
 */
export function currentSession() {
  return readFrom("sessionStorage", SESSION_KEY) || readFrom("localStorage", SESSION_KEY);
}

/**
 * Das Konto hinter der Sitzung — und damit Rolle und Freigabestatus.
 *
 * Rolle und Status stehen nicht in der Sitzung, sondern im Konto: wer den
 * Zugang eines Kunden sperrt, soll das nicht erst nach einer neuen Anmeldung
 * wirksam wird. Fehlt das Konto (zurueckgesetzt, geloescht), gilt die
 * Sitzung als beendet — deshalb haengt hier das Aufraeumen.
 */
export function sessionAccount() {
  const session = currentSession();
  if (!session) return null;

  const account = accountByEmail(session.email);
  if (!account) {
    clearSession();
    return null;
  }
  return account;
}

export function isSignedIn() {
  return Boolean(sessionAccount());
}

/**
 * Gehoert zu diesem Konto. Wird an repo.js weitergegeben und bestimmt, aus
 * welchem Speicher die Trainingsdaten kommen — null heisst: ohne Konto, also
 * der gemeinsame Bereich, den es vor den Konten gab.
 */
export function sessionScope() {
  const account = sessionAccount();
  return account ? account.email : null;
}

/**
 * Der Coach, der dieses Konto betreut.
 *
 * Zwei Quellen stehen zur Wahl: die echte Zuordnung im Konto (der Admin
 * setzt sie, wenn er den Kunden freischaltet) und eine Notiz im
 * Trainingsprofil, die aus dem Startbestand stammt. Die Zuordnung gewinnt —
 * sonst nennt die App einen Menschen, den es fuer dieses Konto gar nicht
 * gibt. Ohne beides steht eine neutrale Zeile da, kein erfundener Name.
 */
export function currentCoach(profile = null) {
  const own = sessionAccount();
  const assigned = own && own.coach ? accountByEmail(own.coach) : null;
  const note = profile && profile.coach;

  if (assigned) {
    return {
      name: assigned.name,
      title: (note && note.title) || "Dein Online-Coach",
      active: assigned.status === "freigegeben",
    };
  }

  return note || { name: "Dein Coach", title: "Dein Online-Coach", active: false };
}

/** Zuletzt benutzte Adresse, damit das Feld nicht jedes Mal leer ist. */
export function lastEmail() {
  return readFrom("localStorage", LAST_KEY) || "";
}

function startSession(session, remember) {
  const data = { ...session, since: nowISO() };

  /* Erst beide Speicher leeren, dann genau einen fuellen — sonst waere ein
     alter Eintrag im anderen Speicher noch gueltig. */
  clearSession();

  const ok = writeTo(remember ? "localStorage" : "sessionStorage", SESSION_KEY, data);
  if (!ok) return null;

  writeTo("localStorage", LAST_KEY, data.email);
  return data;
}

/** Abmelden: beide Speicher frei, damit sich niemand „von selbst" anmeldet. */
export function clearSession() {
  dropFrom("sessionStorage", SESSION_KEY);
  dropFrom("localStorage", SESSION_KEY);
}

export function signOut() {
  clearSession();
  return true;
}

/* --------------------------------------------------------------------------
   Konten
   -------------------------------------------------------------------------- */

/** Die Konten auf diesem Gerät. Leer, wenn es keine gibt. */
export function accounts() {
  const list = readFrom("localStorage", ACCOUNTS_KEY);
  return Array.isArray(list) ? list : [];
}

function saveAccounts(list) {
  writeTo("localStorage", ACCOUNTS_KEY, list);
}

export function accountByEmail(email) {
  const address = normalizeEmail(email);
  return accounts().find((item) => item.email === address) || null;
}

/** Der Coach, der gerade am wenigsten Kunden betreut — Vorgabe beim Annehmen. */
function defaultCoach() {
  const coaches = accounts().filter((item) => item.role === "coach" && item.status === "freigegeben");
  if (!coaches.length) return null;

  const load = (email) => accounts().filter((item) => item.coach === email).length;
  return coaches.slice().sort((a, b) => load(a.email) - load(b.email))[0].email;
}

/* --------------------------------------------------------------------------
   Anfragen
   --------------------------------------------------------------------------
   Die Liste, die aus dem Anfrageformular der Website und aus der
   Registrierung in der App entsteht. Nur der Admin sieht sie.
   -------------------------------------------------------------------------- */

/** Offene, verschobene, angenommene und abgelehnte Anfragen. */
export function requests() {
  const list = readFrom("localStorage", REQUESTS_KEY);
  return Array.isArray(list) ? list : [];
}

function saveRequests(list) {
  writeTo("localStorage", REQUESTS_KEY, list);
}

function updateRequest(id, patch) {
  const list = requests();
  let changed = false;

  const next = list.map((item) => {
    if (item.id !== id) return item;
    changed = true;
    return { ...item, ...patch };
  });

  if (changed) saveRequests(next);
  return changed;
}

function findRequest(id) {
  return requests().find((item) => item.id === id) || null;
}

/* --------------------------------------------------------------------------
   Startbestand
   --------------------------------------------------------------------------
   Ohne Backend gibt es niemanden, der die ersten Zugangsdaten ausgibt. Deshalb
   liegen hier drei Konten, die der Inhaber im README findet — kein Knopf in
   der App, der jemanden ohne Passwort hineinlaesst.
   -------------------------------------------------------------------------- */

const SEED_ACCOUNTS = [
  {
    email: "admin@sigma-progress.de",
    name: "Sara Lindner",
    role: "admin",
    status: "freigegeben",
    password: "SigmaAdmin26",
    coach: null,
    abo: null,
    trial: null,
  },
  {
    email: "coach@sigma-progress.de",
    name: "Deniz Weber",
    role: "coach",
    status: "freigegeben",
    password: "SigmaCoach26",
    coach: null,
    abo: null,
    trial: null,
  },
  {
    email: "kunde@sigma-progress.de",
    name: "Tobias Reuter",
    role: "kunde",
    status: "freigegeben",
    password: "SigmaKunde26",
    coach: "coach@sigma-progress.de",
    abo: { active: true, since: dayKey(-46) },
    trial: { date: dayKey(-53), done: true },
  },
];

const SEED_REQUESTS = [
  {
    name: "Tobias Reuter",
    email: "kunde@sigma-progress.de",
    type: "kunde",
    source: "app",
    status: "angenommen",
    planned: dayKey(-53),
    note: "",
    createdAt: `${dayKey(-55)}T18:12:00.000Z`,
  },
  {
    name: "Mara Vogel",
    email: "mara.vogel@mail.de",
    type: "kunde",
    source: "website",
    status: "offen",
    planned: null,
    note: "Meldet sich abends nach der Arbeit.",
    createdAt: `${dayKey(-2)}T20:41:00.000Z`,
  },
  {
    name: "Jonas Kaufmann",
    email: "jonas.kaufmann@mail.de",
    type: "kunde",
    source: "website",
    status: "verschoben",
    planned: dayKey(3),
    note: "Wollte erst nach der Abreise zurückgerufen werden.",
    createdAt: `${dayKey(-7)}T11:05:00.000Z`,
  },
  {
    name: "Lea Sommer",
    email: "lea.sommer@mail.de",
    type: "coach",
    source: "website",
    status: "offen",
    planned: null,
    note: "Zwei Jahre Erfahrung mit Online-Training.",
    createdAt: `${dayKey(-1)}T08:30:00.000Z`,
  },
];

/**
 * Die ersten Zugangsdaten anlegen.
 *
 * Einmalig beim Start, solange es noch keine Konten gibt. Asynchron, weil
 * das Passwort gehasht werden muss — deshalb steht der Aufruf in main.js
 * und nicht im Modulkopf.
 */
export async function ensureSeeded() {
  if (!readFrom("localStorage", ACCOUNTS_KEY)) {
    const built = [];
    for (const seed of SEED_ACCOUNTS) {
      built.push(await buildAccount(seed));
    }
    saveAccounts(built);
  }

  if (!readFrom("localStorage", REQUESTS_KEY)) {
    saveRequests(SEED_REQUESTS.map((item) => ({ ...item, id: newId() })));
  }
}

async function buildAccount({
  email,
  name,
  role,
  status,
  password,
  coach = null,
  abo = null,
  trial = null,
  createdAt = null,
}) {
  const salt = newSalt();
  return {
    email: normalizeEmail(email),
    name,
    role,
    status,
    coach,
    abo,
    trial,
    createdAt: createdAt || nowISO(),
    salt,
    digest: await digest(password, salt),
  };
}

/* --------------------------------------------------------------------------
   Anlegen und Aendern
   -------------------------------------------------------------------------- */

/** Pruefung, die Kontoanlage und Registrierung teilen. */
function validateCredentials({ name, email, password, confirm = null }) {
  const who = String(name || "").trim();
  const address = normalizeEmail(email);
  const errors = {};

  if (who.length < 2) errors.name = "Bitte den Namen eingeben.";
  if (!isEmail(address)) errors.email = "Diese Adresse sieht nicht nach einer E-Mail aus.";
  if (String(password || "").length < MIN_PASSWORD) {
    errors.password = `Mindestens ${MIN_PASSWORD} Zeichen.`;
  }
  if (confirm !== null && password !== confirm) {
    errors.confirm = "Die beiden Passwörter stimmen nicht überein.";
  }
  if (!errors.email && accountByEmail(address)) {
    errors.email = "Für diese Adresse gibt es schon ein Konto — bitte anmelden.";
  }

  return { who, address, errors };
}

async function persistAccount({ who, address, password, role, status, coach, trial }) {
  const account = await buildAccount({ name: who, email: address, password, role, status, coach, trial });
  saveAccounts(accounts().concat(account));
  return account;
}

/**
 * Konto anlegen — von Admin und aus der Registrierung.
 *
 * Status „wartend" heisst: das Konto existiert, aber der Zugang ist noch
 * zu. Nur ein Admin kann daraus „freigegeben" machen.
 */
export async function createAccount({
  name,
  email,
  password,
  role = "kunde",
  status = "wartend",
  coach = null,
  trial = null,
} = {}) {
  const { who, address, errors } = validateCredentials({ name, email, password });
  if (Object.keys(errors).length) return { ok: false, errors };

  const account = await persistAccount({ who, address, password, role, status, coach, trial });
  return { ok: true, account };
}

/** Einen bestehenden Eintrag aendern. Liefert das Konto oder null. */
export function updateAccount(email, patch) {
  const address = normalizeEmail(email);
  const list = accounts();
  let changed = false;

  const next = list.map((item) => {
    if (item.email !== address) return item;
    changed = true;
    return { ...item, ...patch };
  });

  if (!changed) return null;

  saveAccounts(next);
  return next.find((item) => item.email === address);
}

/* --------------------------------------------------------------------------
   Anmeldung und Registrierung
   --------------------------------------------------------------------------
   Beide geben dasselbe zurueck:

     { ok: true }                       — weitermachen
     { ok: false, errors: {...} }       — Fehler je Feld, „form" fuer den Rest

   Kein Wurf: der Bildschirm soll den Fehler anzeigen, nicht in einen
   Bildschirm mit „Da ist etwas schiefgelaufen" fallen.
   -------------------------------------------------------------------------- */

/**
 * Anmelden.
 *
 * Unbekannte Adresse und falsches Passwort werden unterschieden. Fuer eine
 * echte Anmeldung waere das ein Fehler (es verrät, welche Adressen es gibt) —
 * hier hilft es dem Nutzer, der zwischen zwei Konten auf demselben Gerät
 * tippt.
 *
 * Der Freigabestatus wird hier nicht geprüft: ein Kunde im Wartezustand
 * soll sich anmelden und den Grund erfahren, statt draussen zu bleiben.
 */
export async function signIn({ email, password, remember = true } = {}) {
  const address = normalizeEmail(email);

  if (!isEmail(address)) {
    return { ok: false, errors: { email: "Bitte eine E-Mail-Adresse eingeben." } };
  }
  if (!password) {
    return { ok: false, errors: { password: "Bitte das Passwort eingeben." } };
  }

  const account = accountByEmail(address);
  if (!account) {
    return {
      ok: false,
      errors: { email: "Zu dieser Adresse gibt es auf diesem Gerät kein Konto." },
    };
  }

  const hash = await digest(password, account.salt);
  if (hash !== account.digest) {
    return { ok: false, errors: { password: "Das Passwort stimmt nicht überein." } };
  }

  return startSession({ email: account.email, name: account.name }, remember)
    ? { ok: true, account }
    : { ok: false, errors: { form: "Der Browser lässt das Speichern nicht zu." } };
}

/**
 * Zugang anfragen — die Registrierung in der App.
 *
 * Legt das Konto im Status „wartend" an und eine passende Anfrage. Der
 * Anfragetext ist derselbe wie im Formular der Website, damit der Admin
 * eine Liste hat und nicht zwei.
 *
 * AGB und Datenschutz sind Pflicht. Nicht weil ein Häkchen jemanden schützt,
 * sondern weil die Freigabe ohne dokumentierte Zustimmung nicht sauber ist.
 */
export async function signUp({
  name,
  email,
  password,
  confirm,
  terms = false,
  privacy = false,
  remember = true,
} = {}) {
  const { who, address, errors } = validateCredentials({ name, email, password, confirm });

  if (!terms) errors.terms = "Bitte bestätige die AGB.";
  if (!privacy) errors.privacy = "Bitte bestätige den Datenschutz.";

  if (Object.keys(errors).length) return { ok: false, errors };

  const account = await persistAccount({
    who,
    address,
    password,
    role: "kunde",
    status: "wartend",
    coach: defaultCoach(),
    trial: { date: null, done: false },
  });

  saveRequests(
    requests().concat({
      id: newId(),
      name: who,
      email: address,
      type: "kunde",
      source: "app",
      status: "offen",
      planned: null,
      note: "",
      createdAt: nowISO(),
    })
  );

  return startSession({ email: account.email, name: account.name }, remember)
    ? { ok: true, account }
    : { ok: false, errors: { form: "Der Browser lässt das Speichern nicht zu." } };
}

/* --------------------------------------------------------------------------
   Verwaltung
   --------------------------------------------------------------------------
   Die vier Vorgänge aus dem Admin-Bereich: annehmen, ablehnen,
   verschieben, freischalten. Alle hier, keine im Bildschirm — der
   Bildschirm soll nur anbieten und anzeigen.
   -------------------------------------------------------------------------- */

/**
 * Anfrage annehmen.
 *
 * Danach hat die Person ein Konto mit eigenem Passwort und im Fall eines
 * Kunden einen Probestunden-Termin. Zugang gibt es trotzdem noch nicht:
 * der muss ausdruecklich freigegeben werden.
 */
export async function acceptRequest(id, { password, planned = null, coach = null } = {}) {
  const request = findRequest(id);
  if (!request) return { ok: false, errors: { form: "Diese Anfrage gibt es nicht mehr." } };

  const isCoach = request.type === "coach";
  const existing = accountByEmail(request.email);

  if (!existing) {
    const created = await createAccount({
      name: request.name,
      email: request.email,
      password,
      role: isCoach ? "coach" : "kunde",
      status: isCoach ? "freigegeben" : "wartend",
      coach: isCoach ? null : coach || defaultCoach(),
      trial: isCoach ? null : { date: planned, done: false },
    });
    if (!created.ok) return created;
  } else if (isCoach) {
    updateAccount(request.email, { role: "coach", status: "freigegeben", coach: null, abo: null, trial: null });
  } else {
    updateAccount(request.email, {
      role: "kunde",
      status: "wartend",
      coach: coach || existing.coach || defaultCoach(),
      trial: { date: planned || (existing.trial ? existing.trial.date : null), done: false },
    });
  }

  updateRequest(id, { status: "angenommen", planned: planned || request.planned || null, handledAt: nowISO() });
  return { ok: true };
}

/** Anfrage ablehnen. Ein wartendes Konto wird mit abgelehnt. */
export function rejectRequest(id) {
  const request = findRequest(id);
  if (!request) return { ok: false, errors: { form: "Diese Anfrage gibt es nicht mehr." } };

  updateRequest(id, { status: "abgelehnt", handledAt: nowISO() });

  const account = accountByEmail(request.email);
  if (account && account.status === "wartend") {
    updateAccount(request.email, { status: "abgelehnt" });
  }

  return { ok: true };
}

/** Anfrage verschieben: Termin und Notiz, Status bleibt in der Warteschlange. */
export function postponeRequest(id, planned, note = "") {
  const request = findRequest(id);
  if (!request) return { ok: false, errors: { form: "Diese Anfrage gibt es nicht mehr." } };

  updateRequest(id, { status: "verschoben", planned: planned || null, note: note || request.note || "" });
  return { ok: true };
}

/**
 * Konto freischalten.
 *
 * Der Moment, in dem aus einer Anfrage ein Kunde wird: Status auf
 * „freigegeben", Abo auf 100 Euro monatlich, Probestunde als erledigt
 * abgelegt. Ohne diesen Aufruf sieht der Kunde weiterhin nur die
 * Warteseite.
 */
export function freeAccount(email, { coach = null } = {}) {
  const account = accountByEmail(email);
  if (!account) return { ok: false, errors: { form: "Dieses Konto gibt es nicht mehr." } };

  if (account.role !== "kunde") {
    updateAccount(account.email, { status: "freigegeben" });
    return { ok: true };
  }

  updateAccount(account.email, {
    status: "freigegeben",
    coach: coach || account.coach || defaultCoach(),
    abo: account.abo || { active: true, since: dayKey() },
    trial: account.trial
      ? { ...account.trial, done: true }
      : { date: null, done: true },
  });

  return { ok: true };
}

/** Zugang entziehen. Das Konto bleibt bestehen, nur das Abo pausiert. */
export function blockAccount(email) {
  const account = accountByEmail(email);
  if (!account) return { ok: false, errors: { form: "Dieses Konto gibt es nicht mehr." } };

  updateAccount(account.email, {
    status: "gesperrt",
    abo: account.abo ? { ...account.abo, active: false } : account.abo,
  });

  return { ok: true };
}

/** Abo ein- oder ausschalten, ohne den Zugang anzutasten. */
export function setAbo(email, active) {
  const account = accountByEmail(email);
  if (!account) return null;

  const base = account.abo || { since: dayKey() };
  return updateAccount(account.email, {
    abo: { ...base, active: Boolean(active) },
  });
}
