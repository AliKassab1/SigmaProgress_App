/* ==========================================================================
   SIGMA PROGRESS — screens/freischaltung.js
   --------------------------------------------------------------------------
   Die Warteseite. Hier landet jeder Kunde, dessen Konto noch nicht
   freigegeben ist — und jeder, dessen Zugang gesperrt wurde.

   Sie ist bewusst eine eigene Route und keine Meldung im Dashboard: ohne
   Freigabe gibt es kein Dashboard, und das soll die Seite auch sagen.
   Dieselbe Seite deckt drei Fälle ab, weil sich nur Titel und Text
   unterscheiden und ein eigener Bildschirm je Fall nichts hinzufügt.
   ========================================================================== */

import { h } from "../core/dom.js";
import { brandMark, button, card, Icon } from "../components/ui.js";
import { accountByEmail, sessionAccount } from "../core/auth.js";
import { toast } from "../core/overlay.js";
import { fmtDateLong } from "../core/format.js";

const STATUS_COPY = {
  wartend: {
    icon: "clock",
    tone: "",
    title: "Dein Zugang wird geprüft",
    lead: "Wir haben deine Anfrage. Nach der Probestunde schaltet dein Coach den Zugang frei.",
  },
  abgelehnt: {
    icon: "close",
    tone: "warn",
    title: "Anfrage nicht angenommen",
    lead: "Diese Anfrage wurde leider abgelehnt. Wenn du Fragen hast, wende dich an deinen Coach.",
  },
  gesperrt: {
    icon: "lock",
    tone: "warn",
    title: "Zugang gesperrt",
    lead: "Der Zugang zu diesem Konto ist zurzeit gesperrt. Melde dich bei deinem Coach.",
  },
};

/**
 * Welcher Status zuletzt zu sehen war.
 *
 * „Status pruefen" muss dem Menschen sagen, ob sich etwas getan hat. Dazu
 * braucht es den Zustand, den er auf dem Bildschirm sieht — zwei frische
 * Lesevorgaenge kurz nacheinander waeren immer gleich.
 */
let shown = null;

export default function renderFreischaltung(ctx) {
  const account = sessionAccount();

  /* Die Wache in main.js schickt Abgemeldete an die Tür, bevor dieser
     Bildschirm gezeichnet wird. Der Zweig ist der letzte Halt, falls das
     doch einmal jemand umgeht. */
  if (!account) {
    shown = null;
    return h(
      "div",
      { class: "gate" },
      h("div", { class: "gate__panel" }, h("h1", { class: "h1" }, "Abgemeldet"))
    );
  }

  const copy = STATUS_COPY[account.status] || STATUS_COPY.wartend;
  const coach = account.coach ? accountByEmail(account.coach) : null;
  const waiting = account.status === "wartend";

  shown = account.status;

  return h(
    "div",
    { class: "gate" },
    h("div", { class: "gate__top" }, brandMark("lg")),

    h(
      "div",
      { class: "gate__panel" },
      h(
        "div",
        { class: `gate__icon ${copy.tone ? `gate__icon--${copy.tone}` : ""}` },
        Icon(copy.icon)
      ),
      h("h1", { class: "h1 gate__title" }, copy.title),
      h("p", { class: "lead gate__lead" }, copy.lead),

      waiting && steps(account),

      card(
        { variant: "sunken" },
        h(
          "div",
          { class: "gate__meta" },
          metaRow("Konto", account.name || account.email),
          metaRow("E-Mail", account.email),
          coach && metaRow("Coach", coach.name),
          account.trial && account.trial.date && metaRow("Probestunde", fmtDateLong(account.trial.date)),
          metaRow("Abo", aboLine(account))
        )
      ),

      h(
        "div",
        { class: "gate__actions" },
        waiting &&
          button({
            label: "Status prüfen",
            block: true,
            icon: "refresh",
            onClick: () => recheck(ctx),
          }),
        button({
          label: "Abmelden",
          variant: "secondary",
          block: true,
          icon: "log-out",
          onClick: () => confirmLeave(ctx),
        })
      )
    )
  );
}

/* --------------------------------------------------------------------------
   Bausteine
   -------------------------------------------------------------------------- */

/**
 * Die Abo-Zeile. Drei Faelle, die sich wirklich unterscheiden: noch keines,
 * eines, das laeuft, und eines, das ruht. dieselbe Zeile fuer alle drei
 * waere eine Behauptung statt einer Auskunft.
 */
function aboLine(account) {
  if (account.status === "gesperrt") return "100 € im Monat, pausiert";
  if (account.status === "abgelehnt") return "Kein Abo";
  return "100 € im Monat, mit der Freischaltung aktiv";
}

function metaRow(label, value) {
  return h(
    "div",
    { class: "gate__meta-row" },
    h("span", { class: "gate__meta-label" }, label),
    h("span", { class: "gate__meta-value" }, value)
  );
}

function steps(account) {
  const date = account.trial && account.trial.date;

  return h(
    "ol",
    { class: "gate__steps" },
    step("1", "Anfrage geprüft", "Deine Angaben liegen beim Coach."),
    step("2", "Probestunde", date ? `Termin: ${fmtDateLong(date)}` : "Der Termin wird noch abgestimmt."),
    step("3", "Zugang frei", "Danach geht es direkt in der App los.")
  );
}

function step(number, title, text) {
  return h(
    "li",
    { class: "gate__step" },
    h("span", { class: "gate__step-num" }, number),
    h(
      "div",
      null,
      h("p", { class: "gate__step-title" }, title),
      h("p", { class: "meta-dim" }, text)
    )
  );
}

/* --------------------------------------------------------------------------
   Aktionen
   -------------------------------------------------------------------------- */

/**
 * Noch einmal nachsehen.
 *
 * Der Admin kann in einem anderen Tab freigeschaltet haben — die Wache in
 * main.js merkt das beim nächsten Zeichnen und leitet weiter. Bleibt der
 * Status gleich, sagt ein Hinweis wenigstens, dass nachgesehen wurde.
 */
function recheck(ctx) {
  const before = shown;
  ctx.refresh();

  /* Hat sich nichts getan, hat das Neuzeichnen denselben Bildschirm
     gezeichnet und der Mensch wartet weiter. Hat sich etwas getan, hat
     uns die Wache in main.js längst weitergeschickt — dann wäre ein
     „noch nicht" eine Luege. */
  const after = sessionAccount();
  if (after && after.status === before) {
    toast("Noch nicht freigeschaltet.", { icon: "clock" });
  }
}

function confirmLeave(ctx) {
  toast("Abgemeldet.", { icon: "log-out" });
  ctx.leaveAccount();
}
