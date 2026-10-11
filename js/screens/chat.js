/* ==========================================================================
   SIGMA PROGRESS — screens/chat.js
   --------------------------------------------------------------------------
   Der Chat mit dem Coach.

   Zwei Dinge machen ihn glaubwürdig:

     1. Der Coach kennt deinen Stand. Die Antworten lesen echte Werte aus
        dem Zustand — Gewicht, Wochenquote, Ziel. Keine Platzhaltertexte.
     2. Er schreibt von sich aus. Einmal am Tag eine Begruessung, ohne
        dass du schreiben musst.

   Was er nicht kann: wirklich verstehen. Die Thumenerkennung ist eine
   Regelliste (data/coach.js), kein Modell. Das ist im Code so vermerkt und
   im Chat auch nicht anders behauptet.
   ========================================================================== */

import { h } from "../core/dom.js";
import { avatar, Icon } from "../components/ui.js";
import { textInput } from "../components/forms.js";
import { quickReplies, markAllRead, proactiveGreeting, reply } from "../data/coach.js";
import { currentCoach } from "../core/auth.js";
import { addDays, dayKey, fmtDate, fmtTime, initials } from "../core/format.js";
import { unreadCount } from "../core/stats.js";
import { toast } from "../core/overlay.js";

/* -------------------------------------------------------------------------- */

/* Getippter Text. Kein Store-Write beim Tippen — sonst springt der Cursor. */
const draft = { text: "" };

/* Themenleiste. Jedes Thema bringt eine Frage mit, die ein Mensch auch so
   stellen wuerde — damit greift die Thumenerkennung in coach.js. */
const TOPICS = [
  { id: "training", label: "Training", icon: "dumbbell", ask: "Was steht heute an?" },
  { id: "ernaehrung", label: "Ernährung", icon: "utensils", ask: "Wie soll ich mich ernähren?" },
  { id: "uebungen", label: "Übungen", icon: "activity", ask: "Wie übe ich das richtig?" },
  { id: "planung", label: "Planung", icon: "calendar", ask: "Wie plane ich meine Woche?" },
  { id: "fortschritt", label: "Fortschritt", icon: "bar-chart", ask: "Wie weit bin ich?" },
  { id: "motivation", label: "Motivation", icon: "flame", ask: "Ich habe heute keine Lust" },
];

let showTopics = true;
let prepared = false;

export default function renderChat(ctx) {
  const state = ctx.getState();

  /* Vorbereitung (gelesen markieren, einmal taeglich begruessen) an den
     naechsten Tick haengen: wuerde das hier passieren, loest jede
     Zustandsaenderung sofort ein zweites Zeichnen aus. */
  if (!prepared) {
    prepared = true;
    queueMicrotask(() => {
      prepare(ctx);
      scrollToEnd();
    });
  }

  return h(
    "div",
    { class: "shell chat-screen" },
    h(
      "div",
      { class: "screen__inner screen__inner--chat" },
      chatHead(ctx),
      showTopics && topicBar(ctx),
      h("div", { class: "chat__thread" }, thread(state.chat, initials(currentCoach(state.profile).name))),
      composer(ctx, state)
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Vorbereitung                                                              */
/* -------------------------------------------------------------------------- */

async function prepare(ctx) {
  const state = ctx.getState();

  const needsRead = unreadCount(state) > 0;
  const needsGreeting = state.meta.coachGreetedOn !== dayKey();
  if (!needsRead && !needsGreeting) return;

  const greeting = needsGreeting ? proactiveGreeting(state) : null;

  await ctx.update((draft2) => {
    markAllRead(draft2);
    if (greeting) {
      draft2.chat.push({
        id: `c-greet-${Date.now()}`,
        role: "coach",
        text: greeting,
        at: new Date().toISOString(),
        read: true,
      });
      draft2.meta.coachGreetedOn = dayKey();
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Kopf                                                                      */
/* -------------------------------------------------------------------------- */

function chatHead(ctx) {
  const state = ctx.getState();
  const coach = currentCoach(state.profile);

  return h(
    "header",
    { class: "screen__head chat__head" },
    h(
      "div",
      { class: "row" },
      h("span", { class: "avatar avatar--cool avatar--lg" }, initials(coach.name)),
      h(
        "div",
        { style: { flex: "1", minWidth: "0" } },
        h("h1", { class: "h1" }, coach.name),
        h(
          "p",
          { class: "meta-dim" },
          h("span", { class: "dot-live", "aria-hidden": "true" }),
          `${coach.title} · antwortet sofort`
        )
      ),
      h(
        "button",
        {
          type: "button",
          class: "icon-btn icon-btn--ghost",
          "aria-label": showTopics ? "Themenleiste ausblenden" : "Themenleiste einblenden",
          onClick: () => {
            showTopics = !showTopics;
            ctx.refresh();
          },
        },
        Icon(showTopics ? "close" : "grid")
      )
    )
  );
}

function topicBar(ctx) {
  return h(
    "div",
    { class: "chat__topics", role: "group", "aria-label": "Themen" },
    TOPICS.map((topic) =>
      h(
        "button",
        {
          type: "button",
          class: "topic",
          onClick: () => {
            draft.text = topic.ask;
            send(ctx);
          },
        },
        h("span", { class: "topic__icon" }, Icon(topic.icon)),
        topic.label
      )
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Verlauf                                                                   */
/* -------------------------------------------------------------------------- */

function thread(messages, badge) {
  if (!messages.length) {
    return h(
      "div",
      { class: "chat__empty" },
      h(
        "p",
        { class: "meta-dim" },
        "Noch keine Nachrichten. Frag nach deinem Training, deiner Ernährung oder dem nächsten Schritt."
      )
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
  const mine = message.role === "me";

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
/* Eingabe                                                                   */
/* -------------------------------------------------------------------------- */

function composer(ctx, state) {
  const suggestions = quickReplies(state);

  return h(
    "div",
    { class: "chat__composer" },
    suggestions.length > 0 &&
      h(
        "div",
        { class: "quick-replies", role: "group", "aria-label": "Schnellantworten" },
        suggestions.map((item) =>
          h(
            "button",
            {
              type: "button",
              class: "quick-reply",
              onClick: () => {
                draft.text = item;
                send(ctx);
              },
            },
            item
          )
        )
      ),

    h(
      "form",
      {
        class: "chat__form",
        onSubmit: (event) => {
          event.preventDefault();
          send(ctx);
        },
      },
      h("label", { class: "sr-only", for: "chat-input" }, "Nachricht an den Coach"),
      textInput({
        value: draft.text,
        id: "chat-input",
        placeholder: "Was möchtest du wissen?",
        maxLength: 400,
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
/* Senden                                                                    */
/* -------------------------------------------------------------------------- */

async function send(ctx) {
  const text = draft.text.trim();
  if (!text) return;

  draft.text = "";

  await ctx.update((state) => {
    state.chat.push({
      id: `c-${Date.now()}`,
      role: "me",
      text,
      at: new Date().toISOString(),
    });
  });

  updateSendButton();
  scrollToEnd();

  /* Kurze Verzoegerung, damit die eigene Nachricht sichtbar ist, bevor die
     Antwort kommt. Ohne das wirkt es, als wuerde gar nicht geantwortet. */
  setTimeout(async () => {
    /* `reply` ist die einzige Stelle, die spaeter ein echtes Modell oder
       eine API bedient. Was dort schiefgeht, darf nicht als stummer
       Chat enden — lieber eine ehrliche Antwort als gar keine. */
    let answers;

    try {
      answers = reply(text, ctx.getState());
    } catch (error) {
      console.error("Coach-Antwort fehlgeschlagen:", error);
      toast("Die Antwort liess sich gerade nicht erzeugen. Versuch es nochmals.");
      answers = [
        "Kurzfassung: Das hat mich diesmal überfordert — ich kann dir zu der Frage gerade nichts Zuverlässiges sagen.",
        "Frag mich nochmals, oder schau in Fortschritt nach deinen Zahlen.",
      ];
    }

    await ctx.update((state) => {
      state.chat.push({
        id: `c-${Date.now()}-a`,
        role: "coach",
        text: answers.join("\n\n"),
        at: new Date().toISOString(),
        read: true,
      });
    });

    scrollToEnd();
  }, 450);
}
