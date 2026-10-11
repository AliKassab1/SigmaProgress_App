/* ==========================================================================
   SIGMA PROGRESS — screens/login.js
   --------------------------------------------------------------------------
   Die Tür zur App. Wer hier landet, ist nicht angemeldet — main.js lässt
   niemanden daran vorbei.

   Zwei Wege stehen hier:

     Anmelden        — für Kunden, Coaches und Admins mit Zugangsdaten
     Zugang anfragen — die Registrierung. Sie legt noch keinen Zugang an,
                       sondern eine Anfrage. Der Admin prüft sie, der Kunde
                       macht eine Probestunde, danach wird freigeschaltet.

   Es gibt keinen Demo-Knopf und kein Zurücksetzen per E-Mail: nur wer
   Zugangsdaten hat, kommt weiter. Die drei Startkonten stehen im README.

   Die Eingaben liegen in einem Entwurf am Modul und nicht im Zustand: wer
   gerade tippt, ist mitten in einer Aktion, und die gehört nicht in den
   gespeicherten Datenbestand. `core/auth.js` erfährt erst davon, wenn
   alle Felder stehen — und schreibt danach eine Sitzung, keinen Entwurf.
   ========================================================================== */

import { h } from "../core/dom.js";
import { button, Icon, iconButton, segmented } from "../components/ui.js";
import { checkbox, field, textInput, toggle } from "../components/forms.js";
import { MIN_PASSWORD, PRICE_EUR, lastEmail, signIn, signUp } from "../core/auth.js";
import { openModal, toast } from "../core/overlay.js";

const MODES = [
  { id: "anmelden", label: "Anmelden" },
  { id: "konto", label: "Zugang anfragen" },
];

const COPY = {
  anmelden: {
    title: "Willkommen zurück",
    sub: "Melde dich an — dein Plan steht da, wo du aufgehört hast.",
    cta: "Anmelden",
  },
  konto: {
    title: "Zugang anfragen",
    sub: "Deine Anfrage landet beim Coach. Nach der Probestunde schalten wir deinen Zugang frei.",
    cta: "Anfrage senden",
  },
};

/** Entwurf, bis alles vollständig ist. */
const draft = {
  name: "",
  email: "",
  password: "",
  confirm: "",
  remember: true,
  terms: false,
  privacy: false,
};

let mode = "anmelden";
let errors = {};
let showPassword = false;
let primed = false;

/* --------------------------------------------------------------------------
   Bildschirm
   -------------------------------------------------------------------------- */

export default function renderLogin(ctx) {
  /* Die zuletzt benutzte Adresse einmalig übernehmen. Danach entscheidet
     der Entwurf und nicht der Speicher — sonst überschriebe ein Neuladen
     das, was gerade getippt wurde. */
  if (!primed) {
    primed = true;
    draft.email = lastEmail();
  }

  return h(
    "div",
    { class: "auth" },

    h("div", { class: "auth__top" }, brand(), modeSwitch(ctx)),

    h(
      "form",
      {
        class: "auth__panel",
        /* Die Prüfung macht der Bildschirm selbst, mit einer eigenen
           Meldung an jedem Feld. Der Browser wäre doppelt, würde die
           deutschen Texte überschreiben und nach dem Absenden springen. */
        novalidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          submit(ctx);
        },
        /* Enter soll absenden. Die Eingabefelder unterbinden den
           Standard-Enter (damit die Taste nicht ungefragt einen Wert
           speichert) — deshalb wird es hier von Hand nachgeholt. */
        onKeydown: (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit(ctx);
          }
        },
      },

      h("h1", { class: "h1 auth__title" }, COPY[mode].title),
      h("p", { class: "lead auth__sub" }, COPY[mode].sub),

      errors.form &&
        h(
          "div",
          { class: "notice notice--warn" },
          Icon("help", "icon icon--sm"),
          h("p", null, errors.form)
        ),

      h("div", { class: "auth__fields" }, renderFields()),

      h(
        "div",
        { class: "auth__actions" },
        button({ label: COPY[mode].cta, type: "submit", block: true, size: "lg", iconEnd: "arrow-right" })
      ),

      mode === "anmelden" && rememberRow(),
      mode === "anmelden" ? signInNote() : requestNote()
    )
  );
}

/* --------------------------------------------------------------------------
   Kopfbereich
   -------------------------------------------------------------------------- */

function brand() {
  return h(
    "div",
    { class: "auth__brand" },
    h(
      "span",
      { class: "brand__mark brand__mark--lg" },
      h(
        "svg",
        { viewBox: "87.43 386.78 281.24 204.49", "aria-hidden": "true" },
        h("path", { d: "M133.16 472.55h143.53v35.35h-48.52v82.77h-46.5V507.9h-48.51z" })
      )
    ),
    h(
      "span",
      { class: "auth__brand-name" },
      h("span", { class: "brand__name" }, "Sigma"),
      h("span", { class: "brand__sub" }, "Progress")
    )
  );
}

function modeSwitch(ctx) {
  return segmented(MODES, mode, (next) => switchMode(ctx, next), {
    label: "Anmelden oder Zugang anfragen",
  });
}

/* --------------------------------------------------------------------------
   Felder
   -------------------------------------------------------------------------- */

function renderFields() {
  if (mode === "konto") {
    return [
      field({
        label: "Name",
        control: textInput({
          value: draft.name,
          placeholder: "Vor- und Nachname",
          autocomplete: "name",
          maxLength: 40,
          autofocus: true,
          onInput: (value) => {
            draft.name = value;
          },
        }),
        error: errors.name,
      }),
      emailField(),
      passwordField({ autocomplete: "new-password", hint: true }),
      confirmField(),
      consentFields()
    ];
  }

  return [emailField(), passwordField({ autocomplete: "current-password" })];
}

function emailField() {
  return field({
    label: "E-Mail",
    control: textInput({
      value: draft.email,
      type: "email",
      inputMode: "email",
      /* "username" ist der richtige Name dafür: der Browser weiss dann,
         dass dieses Feld später das Anmeldefeld ist. */
      autocomplete: "username",
      placeholder: "name@beispiel.de",
      autofocus: mode !== "konto",
      onInput: (value) => {
        draft.email = value;
      },
    }),
    error: errors.email,
  });
}

/**
 * Passwortfeld mit Sichtbarkeitsknopf.
 *
 * Der Knopf tauscht nur `type` und das Symbol am Platz — kein Neuzeichnen.
 * Ein Neuzeichnen würde alle Felder neu aufbauen, während man gerade tippt.
 */
function passwordField({ autocomplete = "current-password", hint = false }) {
  const input = textInput({
    value: draft.password,
    type: showPassword ? "text" : "password",
    autocomplete,
    placeholder: "Mindestens 8 Zeichen",
    maxLength: 72,
    onInput: (value) => {
      draft.password = value;
    },
  });

  const eye = iconButton({
    icon: showPassword ? "eye-off" : "eye",
    label: eyeLabel(),
    onClick: () => {
      showPassword = !showPassword;
      input.type = showPassword ? "text" : "password";
      eye.querySelector("use").setAttribute("href", showPassword ? "#i-eye-off" : "#i-eye");
      eye.setAttribute("aria-label", eyeLabel());
      input.focus({ preventScroll: true });
    },
  });

  return field({
    label: "Passwort",
    hint: hint ? `Mindestens ${MIN_PASSWORD} Zeichen.` : null,
    suffix: eye,
    control: input,
    error: errors.password,
  });
}

function eyeLabel() {
  return showPassword ? "Passwort verbergen" : "Passwort anzeigen";
}

function confirmField() {
  return field({
    label: "Passwort wiederholen",
    control: textInput({
      value: draft.confirm,
      type: showPassword ? "text" : "password",
      autocomplete: "new-password",
      placeholder: "Noch einmal",
      maxLength: 72,
      onInput: (value) => {
        draft.confirm = value;
      },
    }),
    error: errors.confirm,
  });
}

/**
 * Die beiden Pflicht-Häkchen.
 *
 * AGB und Datenschutz sind keine Nebenabrede, sondern die Bedingung dafür,
 * dass überhaupt ein Zugang entstehen darf — deshalb stehen sie im Formular
 * und nicht in einem Hinweis darunter.
 */
function consentFields() {
  return h(
    "div",
    { class: "consent" },
    checkbox({
      id: "consent-terms",
      checked: draft.terms,
      onChange: (next) => {
        draft.terms = next;
      },
      label: h(
        "span",
        null,
        "Ich habe die ",
        legalLink("AGB", openTerms),
        " gelesen und akzeptiere sie."
      ),
      error: errors.terms,
    }),
    checkbox({
      id: "consent-privacy",
      checked: draft.privacy,
      onChange: (next) => {
        draft.privacy = next;
      },
      label: h(
        "span",
        null,
        "Ich habe die ",
        legalLink("Datenschutzerklärung", openPrivacy),
        " zur Kenntnis genommen."
      ),
      error: errors.privacy,
    })
  );
}

/** Ein Link mitten im Satz. Ein Knopf, weil er keinen Ort wechselt. */
function legalLink(text, onOpen) {
  return h(
    "button",
    {
      type: "button",
      class: "auth__link",
      onClick: (event) => {
        event.preventDefault();
        onOpen();
      },
    },
    text
  );
}

/* --------------------------------------------------------------------------
   Hinweise unter dem Formular
   -------------------------------------------------------------------------- */

function signInNote() {
  return h(
    "p",
    { class: "auth__note" },
    Icon("lock", "icon icon--sm"),
    "Anmeldung und Daten bleiben auf diesem Gerät. Nichts davon wird ins Netz geschickt."
  );
}

function requestNote() {
  return h(
    "div",
    { class: "auth__aside" },
    h(
      "p",
      { class: "auth__note" },
      Icon("clock", "icon icon--sm"),
      "Nach der Anfrage folgt eine Probestunde. Erst danach wird dein Zugang freigeschaltet."
    ),
    h(
      "p",
      { class: "auth__note" },
      `Das Abo kostet ${PRICE_EUR} € im Monat und enthält alles: App, Trainingsplan, Ernährung und Chat mit deinem Coach.`
    )
  );
}

/* --------------------------------------------------------------------------
   Rechtstexte
   -------------------------------------------------------------------------- */

function openTerms() {
  openModal({
    title: "Allgemeine Geschäftsbedingungen",
    subtitle: "Sigma Progress, Online-Coaching",
    size: "lg",
    body: () =>
      h(
        "div",
        { class: "legal" },
        legalSection("1. Leistung", "Sigma Progress bietet Online-Coaching in den Bereichen Training und Ernährung. Enthalten sind die Nutzung der App, ein individueller Trainings- und Ernährungsrahmen, wöchentliche Video-Check-ins und der Chat mit dem Coach."),
        legalSection("2. Abo und Laufzeit", "Das Abo kostet 100 € pro Monat und enthält alle Leistungen. Es verlängert sich monatlich und ist zum Ende des laufenden Monats kündbar."),
        legalSection("3. Probestunde", "Vor der Freischaltung findet eine Probestunde statt. Danach entscheidet Sigma Progress über die Freischaltung des Zugangs."),
        legalSection("4. Gesundheit", "Die Angaben aus dem Gesundheitsfragebogen dienen der sicheren Planung. Bei gesundheitlichen Beschwerden ist vor dem Training ärztlicher Rat einzuholen."),
        legalSection("5. Pflichten", "Zugangsdaten sind persönlich und dürfen nicht weitergegeben werden."),
        h("p", { class: "legal__foot" }, "Prototyp, Version 1.0 — dieser Text ersetzt keine Rechtsberatung.")
      ),
  });
}

function openPrivacy() {
  openModal({
    title: "Datenschutzerklärung",
    subtitle: "Was mit deinen Angaben passiert",
    size: "lg",
    body: () =>
      h(
        "div",
        { class: "legal" },
        legalSection("Wo die Daten liegen", "In diesem Prototyp werden Konto, Trainingsdaten und Nachrichten ausschließlich lokal im Browser auf diesem Gerät gespeichert. Es gibt keinen Server, an den etwas übertragen wird."),
        legalSection("Welche Daten", "Name, E-Mail-Adresse, Passwort als Hash, Trainings- und Körperdaten, Fotos, Ernährungsangaben und Nachrichten an den Coach."),
        legalSection("Wer sie sieht", "Dein Coach und der Admin sehen die Angaben, die du im Coaching teilst. Alles andere bleibt auf deinem Gerät."),
        legalSection("Löschen", "Du kannst dein Konto und alle Daten jederzeit im Profil zurücksetzen. Damit sind sie unwiderruflich entfernt."),
        legalSection("Kein Tracking", "Die App setzt keine Analyse- oder Werbedienste ein."),
        h("p", { class: "legal__foot" }, "Prototyp, Version 1.0 — dieser Text ersetzt keine Rechtsberatung.")
      ),
  });
}

function legalSection(title, text) {
  return h("section", { class: "legal__block" }, h("h3", null, title), h("p", null, text));
}

/* --------------------------------------------------------------------------
   Absenden
   -------------------------------------------------------------------------- */

async function submit(ctx) {
  const result =
    mode === "konto"
      ? await signUp(draft)
      : await signIn({ email: draft.email, password: draft.password, remember: draft.remember });

  if (!result.ok) {
    errors = result.errors || {};
    /* Der Fokus wandert auf das erste fehlerhafte Feld — auch auf ein
       fehlendes Häkchen, das kein Eingabefeld im engeren Sinn ist. Der
       Zeichnen-Aufruf kommt erst danach; vorher gäbe es kein Feld. */
    ctx.refresh(".field--error .input, .checkrow--error .checkrow__input");
    return;
  }

  /* Ein Passwort bleibt nicht im Entwurf liegen, wenn der Bildschirm
     gleich verschwindet. */
  draft.password = "";
  draft.confirm = "";

  if (mode === "konto") {
    toast("Anfrage gesendet — der Coach meldet sich.", { icon: "check" });
  }

  await ctx.enterAccount();
}

/* --------------------------------------------------------------------------
   Zuruecksetzen
   -------------------------------------------------------------------------- */

/**
 * Zurueck auf den Anfangszustand. Wird beim Abmelden gerufen: danach soll die
 * Tür wieder mit „Anmelden" aufgehen und nicht mit der zuletzt gewaehlten
 * Anfrage. Die zuletzt benutzte Adresse bleibt stehen und wird beim naechsten
 * Zeichnen uebernommen.
 */
export function resetLogin() {
  mode = "anmelden";
  errors = {};
  showPassword = false;
  primed = false;
  draft.name = "";
  draft.password = "";
  draft.confirm = "";
  draft.terms = false;
  draft.privacy = false;
  draft.remember = true;
}

/* --------------------------------------------------------------------------
   Modus wechseln
   -------------------------------------------------------------------------- */

function switchMode(ctx, next) {
  if (next === mode) return;

  mode = next;
  errors = {};
  showPassword = false;
  draft.password = "";
  draft.confirm = "";

  /* Ohne diesen Aufruf bleibt der alte Bildschirm stehen: der Umschalter
     ändert nur den Entwurf, nicht das Markup. */
  ctx.refresh("[data-autofocus]");
}

/* --------------------------------------------------------------------------
   Angemeldet bleiben
   -------------------------------------------------------------------------- */

function rememberRow() {
  const sub = h("p", { class: "auth__row-sub" }, rememberText());

  return h(
    "div",
    { class: "auth__row" },
    h(
      "div",
      { class: "auth__row-text" },
      h("p", { class: "auth__row-title" }, "Angemeldet bleiben"),
      sub
    ),
    toggle({
      checked: draft.remember,
      onChange: (next) => {
        draft.remember = next;
        /* Nur der Nebentext ändert sich. Ein Neuzeichnen würde den
           Schalter unter dem Daumen wegziehen. */
        sub.textContent = rememberText();
      },
      label: "Angemeldet bleiben",
    })
  );
}

function rememberText() {
  return draft.remember
    ? "Du musst dich auf diesem Gerät nicht jedes Mal melden."
    : "Beim nächsten Start bist du wieder abgemeldet.";
}
