/* ==========================================================================
   SIGMA PROGRESS — screens/chat.js
   --------------------------------------------------------------------------
   Der Chat mit dem Coach — ein echter 1:1-Verlauf.

   Hier wird nichts mehr automatisch beantwortet: Was der Kunde schreibt,
   landet in core/messages.js und geht an seinen Coach. Der Coach liest und
   antwortet von Hand in der Verwaltung (#/admin/nachrichten) — es ist
   derselbe Verlauf, den beide Seiten sehen.

   Ohne zugewiesenen Coach gibt es keinen Empfaenger. Dann steht hier ein
   Hinweis statt einer Eingabezeile, die ins Leere schreibt.
   ========================================================================== */

import { h } from "../core/dom.js";
import { avatar, card, Icon } from "../components/ui.js";
import { textInput } from "../components/forms.js";
import { currentCoach, sessionAccount } from "../core/auth.js";
import { addDays, dayKey, fmtDate, fmtTime, initials } from "../core/format.js";
import { markRead, messagesFor, sendMessage } from "../core/messages.js";

/* Getippter Text. Kein Store-Write beim Tippen — sonst springt der Cursor. */
const draft = { text: "" };

/* Vorschlaege fuellen nur das Eingabefeld. Sie senden nie von selbst: die
   Nachricht geht erst raus, wenn der Kunde sie mit dem Pfeil abschickt. */
const SUGGESTIONS = [
  { id: "training", label: "Training", icon: "dumbbell", text: "Kurze Frage zu meinem Training: " },
  { id: "ernaehrung", label: "Ernährung", icon: "utensils", text: "Frage zu meiner Ernährung: " },
  { id: "uebungen", label: "Übungen", icon: "activity", text: "Ich habe eine Frage zur Ausführung: " },
  { id: "planung", label: "Planung", icon: "calendar", text: "Frage zu meiner Wochenplanung: " },
  { id: "fortschritt", label: "Fortschritt", icon: "bar-chart", text: "Frage zu meinem Fortschritt: " },
  { id: "motivation", label: "Motivation", icon: "flame", text: "Ich brauche gerade etwas Motivation: " },
];

let showSuggestions = true;

/* -------------------------------------------------------------------------- */

export default function renderChat(ctx) {
  const state = ctx.getState();
  const account = sessionAccount();
  const coach = currentCoach(state.profile);

  if (!account) {
    return h(
      "div",
      { class: "shell chat-screen" },
      h("div", { class: "screen__inner screen__inner--chat" }, h("p", { class: "lead" }, "Nicht angemeldet."))
    );
  }

  /* Beim Öffnen gilt der Verlauf als gelesen. Gibt es etwas zu markieren,
     folgt ein Durchlauf mehr — damit die Marke im Dock sofort verschwindet. */
  const changed = markRead(account.email, "kunde");
  if (changed > 0) queueMicrotask(() => ctx.refresh());

  const assigned = Boolean(account.coach);
  const messages = assigned ? messagesFor(account.email) : [];

  return h(
    "div",
    { class: "shell chat-screen" },
    h(
      "div",
      { class: "screen__inner screen__inner--chat" },
      chatHead(ctx, coach, assigned),
      assigned && showSuggestions && suggestionBar(),
      assigned
        ? h("div", { class: "chat__thread" }, thread(messages, initials(coach.name)))
        : noCoach(),
      assigned ? composer(ctx, account) : null
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Kopfzeile                                                                 */
/* -------------------------------------------------------------------------- */

function chatHead(ctx, coach, assigned) {
  return h(
    "header",
    { class: "chat__head" },
    h(
      "div",
      { class: "row" },
      avatar(initials(coach.name), { cool: true, size: "lg" }),
      h(
        "div",
        { style: { flex: "1", minWidth: "0" } },
        h("h1", { class: "h1" }, coach.name),
        h("p", { class: "meta-dim" }, assigned ? coach.title : "Noch keine Zuordnung")
      ),
      assigned &&
        h(
          "button",
          {
            type: "button",
            class: "icon-btn icon-btn--ghost",
            "aria-label": showSuggestions ? "Vorschläge ausblenden" : "Vorschläge einblenden",
            onClick: () => {
              showSuggestions = !showSuggestions;
              ctx.refresh();
            },
          },
          Icon(showSuggestions ? "close" : "grid")
        )
    )
  );
}

/** Verständlicher Hinweis, wenn kein Coach zugewiesen ist. */
function noCoach() {
  return card(
    { variant: "sunken" },
    h(
      "div",
      { class: "notice" },
      Icon("info", "icon icon--sm"),
      h(
        "div",
        null,
        h("p", { class: "privacy-item__title" }, "Dir ist noch kein Coach zugewiesen"),
        h(
          "p",
          { class: "meta-dim" },
          "Sobald dein Zugang freigeschaltet und ein Coach eingetragen ist, kannst du hier direkt schreiben."
        )
      )
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Vorschläge — füllen nur das Eingabefeld                                    */
/* -------------------------------------------------------------------------- */

function suggestionBar() {
  return h(
    "div",
    { class: "chat__topics", role: "group", "aria-label": "Vorschläge" },
    SUGGESTIONS.map((item) =>
      h(
        "button",
        { type: "button", class: "topic", onClick: () => fillDraft(item.text) },
        h("span", { class: "topic__icon" }, Icon(item.icon)),
        item.label
      )
    )
  );
}

function fillDraft(value) {
  draft.text = value;
  const input = document.getElementById("chat-input");
  if (input) {
    input.value = value;
    input.focus();
  }
  updateSendButton();
}

/* -------------------------------------------------------------------------- */
/* Verlauf                                                                    */
/* -------------------------------------------------------------------------- */

function thread(messages, badge) {
  if (!messages.length) {
    return h(
      "div",
      { class: "chat__empty" },
      h("p", { class: "meta-dim" }, "Noch keine Nachrichten. Schreib deinem Coach, was du wissen willst.")
    );
  }

  const out = [];
  let lastDay = null;

  for (const message of messages) {
    const day = String(message.at || "").slice(0, 10);
    if (day !== lastDay) {
      lastDay = day;
      out.push(h("p", { class: "chat__day" }, dayLabel(day)));
    }
    out.push(bubble(message, badge));
  }

  return out;
}

function dayLabel(day) {
  if (day === dayKey()) return "Heute";
  if (day === addDays(dayKey(), -1)) return "Gestern";
  return fmtDate(day);
}

function bubble(message, badge) {
  /* In der Kundensicht sind die eigenen Nachrichten die des Kunden. */
  const mine = message.from === "kunde";

  return h(
    "div",
    { class: `msg ${mine ? "msg--me" : "msg--coach"}` },
    !mine &&
      h(
        "span",
        { class: "avatar avatar--cool avatar--sm msg__avatar", "aria-hidden": "true" },
        badge || "–"
      ),
    h(
      "div",
      { class: "msg__body" },
      h(
        "div",
        { class: "msg__bubble" },
        String(message.text || "")
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map((line) => h("p", { class: "msg__line" }, line))
      ),
      h("p", { class: "msg__time" }, fmtTime(message.at))
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Eingabe                                                                    */
/* -------------------------------------------------------------------------- */

function composer(ctx, account) {
  return h(
    "div",
    { class: "chat__composer" },
    h(
      "form",
      {
        class: "chat__form",
        onSubmit: (event) => {
          event.preventDefault();
          send(ctx, account);
        },
      },
      textInput({
        value: draft.text,
        id: "chat-input",
        placeholder: "Nachricht an deinen Coach",
        maxLength: 500,
        onInput: (value) => {
          draft.text = value;
          updateSendButton();
        },
      }),
      h(
        "button",
        {
          type: "submit",
          class: "send",
          id: "chat-send",
          "aria-label": "Nachricht senden",
          disabled: true,
        },
        Icon("arrow-up")
      )
    )
  );
}

function updateSendButton() {
  const btn = document.getElementById("chat-send");
  if (btn) btn.disabled = !draft.text.trim();
}

function scrollToEnd() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });
}

/* -------------------------------------------------------------------------- */
/* Senden                                                                     */
/* -------------------------------------------------------------------------- */

function send(ctx, account) {
  const text = draft.text.trim();
  if (!text) return;

  draft.text = "";
  sendMessage({ customer: account.email, coach: account.coach, from: "kunde", text });

  ctx.refresh();
  scrollToEnd();
}
