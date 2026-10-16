/* ==========================================================================
   SIGMA PROGRESS — screens/admin.js
   --------------------------------------------------------------------------
   Die Verwaltung. Ein eigener Bereich mit eigener Route (#/admin/<bereich>),
   ohne untere Leiste, ohne Trainingsdaten — erreichbar nur mit einem Konto
   in der Rolle Coach oder Admin.

   Fuenf Bereiche, je nach Rolle:

     Uebersicht  — was heute liegen bleibt (beide)
     Anfragen    — annehmen, verschieben, ablehnen (nur Admin)
     Kunden      — freischalten, Abo, Coach zuweisen (beide, Coach sieht
                   nur seine eigenen)
     Coaches     — Zugang anlegen und sperren (nur Admin)
     Abo         — der eine Tarif und wer ihn zahlt (nur Admin)

   Der Bildschirm veraendert nie direkt etwas: jede Aufgabe ist eine
   Funktion aus core/auth.js, und danach wird neu gezeichnet.
   ========================================================================== */

import { h } from "../core/dom.js";
import {
  avatar,
  brandMark,
  button,
  card,
  cardHead,
  chip,
  empty,
  Icon,
  iconTile,
  list,
  listRow,
  sectionHead,
  segmented,
  stat,
} from "../components/ui.js";
import { dateInput, field, select, textarea, textInput } from "../components/forms.js";
import { closeModal, confirmDialog, openModal, toast } from "../core/overlay.js";
import {
  MIN_PASSWORD,
  PRICE_EUR,
  acceptRequest,
  accountByEmail,
  accounts,
  blockAccount,
  createAccount,
  freeAccount,
  postponeRequest,
  rejectRequest,
  requests,
  sessionAccount,
  setAbo,
  updateAccount,
} from "../core/auth.js";
import {
  conversationsForCoach,
  markRead,
  messagesFor,
  sendMessage,
} from "../core/messages.js";
import {
  addDays,
  dayKey,
  fmtDate,
  fmtDateLong,
  fmtNum,
  fmtRelativeDay,
  fmtTime,
  initials,
  plural,
} from "../core/format.js";

/* --------------------------------------------------------------------------
   Aufbau
   -------------------------------------------------------------------------- */

const SECTIONS = [
  { id: "uebersicht", label: "Übersicht", icon: "grid", roles: ["admin", "coach"] },
  { id: "nachrichten", label: "Nachrichten", icon: "chat", roles: ["coach"] },
  { id: "anfragen", label: "Anfragen", icon: "mail", roles: ["admin"] },
  { id: "kunden", label: "Kunden", icon: "user", roles: ["admin", "coach"] },
  { id: "coaches", label: "Coaches", icon: "award", roles: ["admin"] },
  { id: "abo", label: "Abo", icon: "credit-card", roles: ["admin"] },
];

const REQUEST_FILTERS = [
  { id: "offen", label: "Offen" },
  { id: "verschoben", label: "Verschoben" },
  { id: "angenommen", label: "Angenommen" },
  { id: "abgelehnt", label: "Abgelehnt" },
  { id: "alle", label: "Alle" },
];

const CUSTOMER_FILTERS = [
  { id: "alle", label: "Alle" },
  { id: "wartend", label: "Wartend" },
  { id: "freigegeben", label: "Freigegeben" },
  { id: "gesperrt", label: "Gesperrt" },
];

/* Filter und Auswahl liegen am Modul und nicht am Zustand: sie sind eine
   Sicht auf die Daten, keine Tatsache ueber den Betrieb. */
let requestFilter = "offen";
let customerFilter = "alle";

export default function renderAdmin(ctx, route) {
  const account = sessionAccount();

  /* Die Wache in main.js laesst nur Coach und Admin hierher. Der Zweig ist
     der letzte Halt, falls doch jemand ohne Konto ankommt. */
  if (!account) {
    return h("div", { class: "admin" }, h("p", { class: "lead" }, "Nicht angemeldet."));
  }

  const sections = SECTIONS.filter((item) => item.roles.includes(account.role));

  /* Die Route ist #/admin/<bereich> — bei Nachrichten zusätzlich
     #/admin/nachrichten/<kunde>. `route.param` trägt alles nach `/admin/`,
     deshalb wird hier selbst am Schrägstrich getrennt. */
  const [sectionParam, ...rest] = String(route.param || "").split("/");
  const sub = rest.join("/");
  const active = sections.find((item) => item.id === sectionParam) || sections[0];

  /* Eine Adresse, die es fuer diese Rolle nicht gibt (oder die es nie gab),
     weicht auf den gueltigen Abschnitt aus. Sonst stunde in der Browserzeile
     eine Route, die gerade gar nicht angezeigt wird. */
  if (sectionParam && sectionParam !== active.id) {
    ctx.navigate(`/admin/${active.id}`);
  }

  return h(
    "div",
    { class: "admin" },
    adminBar(account, ctx),
    adminTabs(sections, active),
    h("div", { class: "admin__body" }, h("div", { class: "stack stack--lg" }, ...section(ctx, account, active, sub)))
  );
}

function adminBar(account, ctx) {
  return h(
    "header",
    { class: "admin__bar" },
    h(
      "div",
      { class: "admin__brand" },
      brandMark(),
      h(
        "div",
        null,
        h("p", { class: "admin__title" }, "Verwaltung"),
        h("p", { class: "admin__sub" }, account.role === "admin" ? "Admin" : "Coach")
      )
    ),
    h(
      "div",
      { class: "admin__who" },
      h("span", { class: "admin__name" }, account.name),
      button({
        label: "Abmelden",
        variant: "ghost",
        size: "sm",
        icon: "log-out",
        onClick: () => confirmSignOut(ctx),
      })
    )
  );
}

function adminTabs(sections, active) {
  return h(
    "nav",
    { class: "admin__tabs", "aria-label": "Verwaltungsbereiche" },
    sections.map((item) =>
      h(
        "a",
        {
          class: `admin__tab ${item.id === active.id ? "is-active" : ""}`,
          href: `#/admin/${item.id}`,
          "aria-current": item.id === active.id ? "page" : null,
        },
        Icon(item.icon),
        item.label
      )
    )
  );
}

function section(ctx, account, active, sub = "") {
  switch (active.id) {
    case "nachrichten":
      return messagesSection(ctx, account, sub);
    case "anfragen":
      return requestsSection(ctx);
    case "kunden":
      return customersSection(ctx, account);
    case "coaches":
      return coachesSection(ctx);
    case "abo":
      return aboSection(ctx);
    default:
      return overviewSection(ctx, account);
  }
}

/* --------------------------------------------------------------------------
   Daten
   -------------------------------------------------------------------------- */

function kundeAccounts() {
  return accounts().filter((item) => item.role === "kunde");
}

function coachAccounts() {
  return accounts().filter((item) => item.role === "coach");
}

/** Die Kunden, die dieser Nutzer sehen darf: Admin alle, Coach seine. */
function visibleKunden(account) {
  if (account.role === "admin") return kundeAccounts();
  return kundeAccounts().filter((item) => item.coach === account.email);
}

function pendingRequests() {
  return requests().filter((item) => item.status === "offen" || item.status === "verschoben");
}

function aboActive(account) {
  return Boolean(account.abo && account.abo.active);
}

/* --------------------------------------------------------------------------
   Uebersicht
   -------------------------------------------------------------------------- */

function overviewSection(ctx, account) {
  const isAdmin = account.role === "admin";
  const kunden = visibleKunden(account);
  const open = isAdmin ? pendingRequests() : [];
  const pending = kunden.filter((item) => item.status === "wartend");
  const active = kunden.filter(aboActive);
  const revenue = active.length * PRICE_EUR;

  const tasks = [
    ...open.slice(0, 3).map((item) =>
      listRow({
        icon: "mail",
        title: `Anfrage: ${item.name}`,
        sub: `${typeLabel(item.type)} · ${sourceLabel(item.source)} · ${fmtRelativeDay(dayOf(item.createdAt))}`,
        onClick: () => ctx.navigate("/admin/anfragen"),
      })
    ),
    ...pending.slice(0, 3).map((item) =>
      listRow({
        icon: "clock",
        title: `Freischalten: ${item.name}`,
        sub: item.trial && item.trial.date ? `Probestunde am ${fmtDateLong(item.trial.date)}` : "Noch kein Termin eingetragen",
        onClick: () => ctx.navigate("/admin/kunden"),
      })
    ),
  ];

  return [
    h(
      "div",
      { class: "grid-4" },
      stat({
        label: isAdmin ? "Offene Anfragen" : "Meine Kunden",
        value: isAdmin ? open.length : kunden.length,
        icon: isAdmin ? "mail" : "user",
      }),
      stat({ label: "Aktive Abos", value: active.length, icon: "credit-card" }),
      stat({ label: "Wartend", value: pending.length, icon: "clock" }),
      stat({
        label: isAdmin ? "Umsatz / Monat" : "Probestunden",
        value: isAdmin ? fmtNum(revenue) : pending.length,
        unit: isAdmin ? "€" : "",
        icon: isAdmin ? "bar-chart" : "calendar",
      })
    ),

    card(
      {},
      cardHead("Zu tun"),
      tasks.length
        ? list(...tasks)
        : empty({ icon: "check", title: "Nichts zu tun", hint: "Alle Anfragen sind bearbeitet." })
    ),

    isAdmin ? recentRequests(ctx) : myCustomers(ctx, account, kunden)
  ];
}

function recentRequests(ctx) {
  const latest = requests()
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 4);

  return card(
    {},
    cardHead("Letzte Anfragen", button({ label: "Alle", size: "sm", variant: "ghost", onClick: () => ctx.navigate("/admin/anfragen") })),
    latest.length
      ? list(
          ...latest.map((item) =>
            listRow({
              icon: item.type === "coach" ? "award" : "user",
              title: item.name,
              sub: `${requestStatus(item.status).label} · ${fmtRelativeDay(dayOf(item.createdAt))}`,
              trailing: chip(sourceLabel(item.source), { variant: item.source === "app" ? "green" : "" }),
            })
          )
        )
      : empty({ icon: "mail", title: "Keine Anfragen", hint: "Neue Anfragen erscheinen hier." })
  );
}

function myCustomers(ctx, account, kunden) {
  const own = kunden.slice(0, 5);

  return card(
    {},
    cardHead(
      "Meine Kunden",
      button({ label: "Alle", size: "sm", variant: "ghost", onClick: () => ctx.navigate("/admin/kunden") })
    ),
    own.length
      ? list(
          ...own.map((item) =>
            listRow({
              title: item.name,
              sub: item.email,
              trailing: chip(aboActive(item) ? "Abo aktiv" : "Kein Abo", {
                variant: aboActive(item) ? "green" : "",
              }),
            })
          )
        )
      : empty({ icon: "user", title: "Noch keine Kunden", hint: "Freigeschaltete Kunden erscheinen hier." })
  );
}

/* --------------------------------------------------------------------------
   Anfragen
   -------------------------------------------------------------------------- */

function requestsSection(ctx) {
  const all = requests();
  const filtered =
    requestFilter === "alle" ? all : all.filter((item) => item.status === requestFilter);
  const sorted = filtered.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return [
    h(
      "div",
      { class: "admin__filters" },
      segmented(REQUEST_FILTERS, requestFilter, (next) => {
        requestFilter = next;
        ctx.refresh();
      }, { label: "Anfragen filtern" })
    ),

    card(
      {},
      cardHead(`Anfragen · ${filtered.length}`),
      sorted.length
        ? h("div", { class: "admin__rows" }, ...sorted.map((item) => requestRow(ctx, item)))
        : empty({ icon: "mail", title: "Keine Anfragen", hint: "In diesem Filter liegt gerade nichts." })
    ),
  ];
}

function requestRow(ctx, request) {
  const actions = [];

  if (request.status === "offen" || request.status === "verschoben") {
    actions.push(
      button({ label: "Annehmen", size: "sm", icon: "check", onClick: () => acceptDialog(ctx, request) }),
      button({
        label: "Verschieben",
        size: "sm",
        variant: "secondary",
        icon: "calendar",
        onClick: () => postponeDialog(ctx, request),
      }),
      button({
        label: "Ablehnen",
        size: "sm",
        variant: "ghost",
        icon: "close",
        onClick: () => rejectDialog(ctx, request),
      })
    );
  }

  const tags = [typeChip(request.type), requestChip(request.status), chip(sourceLabel(request.source))];
  if (request.planned) tags.push(chip(fmtDateLong(request.planned)));

  return personRow({
    name: request.name,
    email: request.email,
    tags,
    note: request.note,
    actions,
  });
}

/* --------------------------------------------------------------------------
   Kunden
   -------------------------------------------------------------------------- */

function customersSection(ctx, account) {
  const base = visibleKunden(account);
  const filtered = customerFilter === "alle" ? base : base.filter((item) => item.status === customerFilter);
  const sorted = filtered.slice().sort((a, b) => a.name.localeCompare(b.name, "de"));

  return [
    h(
      "div",
      { class: "admin__filters" },
      segmented(CUSTOMER_FILTERS, customerFilter, (next) => {
        customerFilter = next;
        ctx.refresh();
      }, { label: "Kunden filtern" })
    ),

    card(
      {},
      cardHead(`Kunden · ${filtered.length}`),
      sorted.length
        ? h("div", { class: "admin__rows" }, ...sorted.map((item) => customerRow(ctx, isAdminView(account), item)))
        : empty({ icon: "user", title: "Keine Kunden", hint: "In diesem Filter liegt gerade niemand." })
    ),
  ];
}

/** Admin sieht alle Kunden, Coach nur die eigenen — das entscheidet die Zeile. */
function isAdminView(account) {
  return account.role === "admin";
}

function customerRow(ctx, isAdmin, konto) {
  const tags = [accountChip(konto.status)];

  if (konto.role === "kunde") {
    /* Drei Zustaende, nicht zwei: ohne Abo, mit laufendem Abo, und das
       Abo, das einmal lief und jetzt ruht. Letzteres mit „Kein Abo" zu
       bezeichnen, wirft die Frage auf, warum es dann einen
       Aktivieren-Knopf gibt. */
    tags.push(
      aboActive(konto)
        ? chip("Abo aktiv", { variant: "green" })
        : chip(konto.abo ? "Abo pausiert" : "Kein Abo")
    );
  }
  if (konto.trial && konto.trial.date) tags.push(chip(`Probe ${fmtDateLong(konto.trial.date)}`));

  const coach = konto.coach ? accountByEmail(konto.coach) : null;
  if (coach) tags.push(chip(coach.name, { variant: "calm" }));

  const actions = [];

  if (konto.status === "wartend") {
    actions.push(
      button({ label: "Freischalten", size: "sm", icon: "check", onClick: () => freeDialog(ctx, konto) })
    );
  } else if (konto.status === "freigegeben") {
    actions.push(
      button({
        label: aboActive(konto) ? "Abo pausieren" : "Abo aktivieren",
        size: "sm",
        variant: "secondary",
        icon: aboActive(konto) ? "pause" : "play",
        onClick: () => aboDialog(ctx, konto),
      }),
      isAdmin &&
        button({
          label: "Sperren",
          size: "sm",
          variant: "ghost",
          icon: "lock",
          onClick: () => blockDialog(ctx, konto),
        })
    );
  } else {
    actions.push(
      button({ label: "Freigeben", size: "sm", variant: "secondary", icon: "check", onClick: () => freeDialog(ctx, konto) })
    );
  }

  if (isAdmin) {
    actions.push(
      button({
        label: "Coach",
        size: "sm",
        variant: "ghost",
        icon: "award",
        onClick: () => coachAssignDialog(ctx, konto),
      })
    );
  }

  return personRow({
    name: konto.name,
    email: konto.email,
    tags,
    note: konto.abo && konto.abo.since ? `Abo seit ${fmtDate(konto.abo.since)}` : "",
    actions,
  });
}

/* --------------------------------------------------------------------------
   Nachrichten (Coach)
   -------------------------------------------------------------------------- */

/* Der offene Antwortentwurf liegt am Modul: beim Tippen wird nichts
   gespeichert, und beim Öffnen eines Gesprächs beginnt er leer. */
const replyDraft = { text: "" };

function messagesSection(ctx, account, customerEmail) {
  if (customerEmail) return conversationView(ctx, account, customerEmail);

  const conversations = conversationsForCoach(account.email);

  return [
    card(
      {},
      cardHead(`Nachrichten · ${conversations.length}`),
      conversations.length
        ? h(
            "div",
            { class: "admin__rows" },
            ...conversations.map((item) => conversationRow(ctx, item))
          )
        : empty({
            icon: "chat",
            title: "Keine Nachrichten",
            hint: "Sobald dir ein Kunde schreibt, erscheint das Gespräch hier.",
          })
    ),
  ];
}

/** Eine Zeile je Kunde — mit Name, E-Mail und Ungelesen-Marke. */
function conversationRow(ctx, conversation) {
  const konto = accountByEmail(conversation.customer);
  const name = konto ? konto.name : conversation.customer;
  const tags = [];

  if (conversation.unread > 0) {
    tags.push(chip(`${conversation.unread} ungelesen`, { variant: "green", dot: true }));
  }

  return personRow({
    name,
    email: conversation.customer,
    tags,
    note: `${preview(conversation.last)} · ${fmtRelativeDay(dayOf(conversation.lastAt))}`,
    actions: [
      button({
        label: "Öffnen",
        size: "sm",
        icon: "chat",
        onClick: () => {
          replyDraft.text = "";
          ctx.navigate(`/admin/nachrichten/${conversation.customer}`);
        },
      }),
    ],
  });
}

/** Der offene Verlauf mit einem Kunden, samt Antwortfeld. */
function conversationView(ctx, account, customerEmail) {
  const konto = accountByEmail(customerEmail);
  const name = konto ? konto.name : customerEmail;
  const messages = messagesFor(customerEmail);

  /* Beim Öffnen gilt das Gespräch als gelesen. Gibt es etwas zu markieren,
     folgt ein Durchlauf mehr — dann verschwindet die Ungelesen-Marke. */
  const changed = markRead(customerEmail, "coach");
  if (changed > 0) queueMicrotask(() => ctx.refresh());

  return [
    card(
      {},
      h(
        "div",
        { class: "row" },
        button({
          label: "Zurück",
          size: "sm",
          variant: "ghost",
          icon: "arrow-left",
          onClick: () => ctx.navigate("/admin/nachrichten"),
        }),
        avatar(initials(name), { alt: "" }),
        h(
          "div",
          { style: { flex: "1", minWidth: "0" } },
          h("p", { class: "card__title" }, name),
          h("p", { class: "meta-dim" }, customerEmail)
        )
      )
    ),
    card({}, h("div", { class: "chat__thread" }, adminThread(messages, name)), adminComposer(ctx, account, customerEmail)),
  ];
}

function adminThread(messages, name) {
  if (!messages.length) {
    return h(
      "div",
      { class: "chat__empty" },
      h("p", { class: "meta-dim" }, "Noch keine Nachrichten in diesem Gespräch.")
    );
  }

  const out = [];
  let lastDay = null;

  for (const message of messages) {
    const day = String(message.at || "").slice(0, 10);
    if (day !== lastDay) {
      lastDay = day;
      out.push(h("p", { class: "chat__day" }, messageDayLabel(day)));
    }
    out.push(adminBubble(message, name));
  }

  return out;
}

function messageDayLabel(day) {
  if (day === dayKey()) return "Heute";
  if (day === addDays(dayKey(), -1)) return "Gestern";
  return fmtDate(day);
}

function adminBubble(message, name) {
  /* In der Coach-Sicht sind die eigenen Nachrichten die des Coachs. */
  const mine = message.from === "coach";

  return h(
    "div",
    { class: `msg ${mine ? "msg--me" : "msg--coach"}` },
    !mine &&
      h(
        "span",
        { class: "avatar avatar--cool avatar--sm msg__avatar", "aria-hidden": "true" },
        initials(name)
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

function adminComposer(ctx, account, customerEmail) {
  return h(
    "div",
    { class: "chat__composer", style: { bottom: "1rem" } },
    h(
      "form",
      {
        class: "chat__form",
        onSubmit: (event) => {
          event.preventDefault();
          sendAdminReply(ctx, account, customerEmail);
        },
      },
      textInput({
        value: replyDraft.text,
        id: "admin-reply",
        placeholder: "Antwort an den Kunden",
        maxLength: 500,
        onInput: (value) => {
          replyDraft.text = value;
          updateAdminSendButton();
        },
      }),
      h(
        "button",
        {
          type: "submit",
          class: "send",
          id: "admin-send",
          "aria-label": "Antwort senden",
          disabled: true,
        },
        Icon("send")
      )
    )
  );
}

function updateAdminSendButton() {
  const btn = document.getElementById("admin-send");
  if (btn) btn.disabled = !replyDraft.text.trim();
}

function sendAdminReply(ctx, account, customerEmail) {
  const text = replyDraft.text.trim();
  if (!text) return;

  replyDraft.text = "";
  sendMessage({ customer: customerEmail, coach: account.email, from: "coach", text });
  ctx.refresh();
}

/** Die letzte Nachricht in einer Zeile, kurz gehalten. */
function preview(text) {
  const single = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  return single.length > 64 ? `${single.slice(0, 63)}…` : single;
}

/* --------------------------------------------------------------------------
   Coaches
   -------------------------------------------------------------------------- */

function coachesSection(ctx) {
  const coaches = coachAccounts();

  return [
    sectionHead(
      "Coaches",
      button({ label: "Coach anlegen", size: "sm", icon: "plus", onClick: () => coachDialog(ctx) })
    ),

    card(
      {},
      coaches.length
        ? h(
            "div",
            { class: "admin__rows" },
            ...coaches.map((item) => {
              const load = kundeAccounts().filter((kunde) => kunde.coach === item.email).length;

              return personRow({
                name: item.name,
                email: item.email,
                tags: [
                  accountChip(item.status),
                  chip(`${load} ${plural(load, "Kunde", "Kunden")}`, { variant: "calm" }),
                ],
                actions: [
                  item.status === "freigegeben"
                    ? button({
                        label: "Sperren",
                        size: "sm",
                        variant: "ghost",
                        icon: "lock",
                        onClick: () => blockDialog(ctx, item),
                      })
                    : button({
                        label: "Freigeben",
                        size: "sm",
                        variant: "secondary",
                        icon: "check",
                        onClick: () => {
                          freeAccount(item.email);
                          ctx.refresh();
                          toast(`${item.name} ist freigegeben.`, { icon: "check" });
                        },
                      }),
                ],
              });
            })
          )
        : empty({ icon: "award", title: "Noch kein Coach", hint: "Lege den ersten Coach an." })
    ),
  ];
}

/* --------------------------------------------------------------------------
   Abo
   -------------------------------------------------------------------------- */

function aboSection(ctx) {
  const kunden = kundeAccounts();
  const active = kunden.filter(aboActive);
  const paused = kunden.filter((item) => item.abo && !item.abo.active);
  const waiting = kunden.filter((item) => item.status === "wartend");

  return [
    card(
      { glow: true },
      h(
        "div",
        { class: "abo-hero" },
        h(
          "div",
          null,
          h("p", { class: "label" }, "Ein Tarif, alles inklusive"),
          h(
            "p",
            { class: "abo-hero__price" },
            `${fmtNum(PRICE_EUR)} €`,
            h("span", { class: "abo-hero__unit" }, " / Monat")
          ),
          h(
            "p",
            { class: "lead" },
            "App, Trainingsplan, Ernährung, wöchentliches Video-Check-in und Chat mit dem Coach. Monatlich kündbar."
          )
        ),
        iconTile("credit-card", { size: "lg" })
      )
    ),

    h(
      "div",
      { class: "grid-4" },
      stat({ label: "Aktive Abos", value: active.length, icon: "check" }),
      stat({ label: "Pausiert", value: paused.length, icon: "pause" }),
      stat({ label: "Wartend", value: waiting.length, icon: "clock" }),
      stat({ label: "Umsatz / Monat", value: fmtNum(active.length * PRICE_EUR), unit: "€", icon: "bar-chart" })
    ),

    card(
      {},
      cardHead("Kunden und Abos"),
      kunden.length
        ? h(
            "div",
            { class: "admin__rows" },
            ...kunden
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, "de"))
              .map((item) => customerRow(ctx, true, item))
          )
        : empty({ icon: "credit-card", title: "Noch kein Abo", hint: "Abos entstehen mit der Freischaltung." })
    ),
  ];
}

/* --------------------------------------------------------------------------
   Zeile
   -------------------------------------------------------------------------- */

function personRow({ name, email, tags = [], note = "", actions = [] }) {
  return h(
    "div",
    { class: "arow" },
    avatar(initials(name || email), { alt: "" }),
    h(
      "div",
      { class: "arow__main" },
      h("p", { class: "arow__title" }, name || email),
      h("p", { class: "arow__sub" }, email),
      tags.length ? h("div", { class: "arow__tags" }, ...tags) : null,
      note && h("p", { class: "arow__note" }, note)
    ),
    actions.length ? h("div", { class: "arow__actions" }, ...actions) : null
  );
}

/* --------------------------------------------------------------------------
   Gespraeche (Dialoge)
   -------------------------------------------------------------------------- */

function acceptDialog(ctx, request, draft = null) {
  const state = draft || {
    password: suggestPassword(request.name),
    planned: request.planned || "",
    errors: {},
  };
  const existing = accountByEmail(request.email);

  openModal({
    title: request.type === "coach" ? "Coach aufnehmen" : "Anfrage annehmen",
    subtitle: `${request.name} · ${request.email}`,
    body: () =>
      h(
        "div",
        { class: "stack" },
        state.errors.form && noticeWarn(state.errors.form),
        h(
          "p",
          { class: "meta-dim" },
          request.type === "coach"
            ? "Der Coach bekommt sofort Zugang."
            : "Der Kunde bekommt den Zugang, sobald du ihn nach der Probestunde freischaltest."
        ),
        existing
          ? h("p", { class: "meta-dim" }, "Für diese Adresse gibt es schon ein Konto — das Passwort bleibt unverändert.")
          : field({
              label: "Startpasswort",
              hint: `Mindestens ${MIN_PASSWORD} Zeichen. Gib es an ${request.name} weiter.`,
              error: state.errors.password,
              control: textInput({
                value: state.password,
                maxLength: 72,
                autofocus: true,
                onInput: (value) => {
                  state.password = value;
                },
              }),
            }),
        request.type === "kunde" &&
          field({
            label: "Probestunde",
            hint: "Optional — der Termin der ersten Einheit.",
            control: dateInput({
              value: state.planned,
              onChange: (value) => {
                state.planned = value;
              },
            }),
          })
      ),
    actions: () => [
      button({ label: "Abbrechen", variant: "ghost", onClick: closeModal }),
      button({
        label: "Annehmen",
        icon: "check",
        onClick: async () => {
          const result = await acceptRequest(request.id, {
            password: state.password,
            planned: state.planned || null,
          });

          if (!result.ok) {
            acceptDialog(ctx, request, { ...state, errors: result.errors || {} });
            return;
          }

          closeModal();
          ctx.refresh();
          toast(`${request.name} angenommen.`, { icon: "check" });
        },
      }),
    ],
  });
}

function postponeDialog(ctx, request, draft = null) {
  const state = draft || {
    planned: request.planned || "",
    note: request.note || "",
    error: "",
    plannedError: "",
  };

  openModal({
    title: "Anfrage verschieben",
    subtitle: `${request.name} · ${request.email}`,
    body: () =>
      h(
        "div",
        { class: "stack" },
        state.error && noticeWarn(state.error),
        field({
          label: "Neuer Termin",
          hint: "Wann soll der Kontakt stattfinden?",
          error: state.plannedError,
          control: dateInput({
            value: state.planned,
            onChange: (value) => {
              state.planned = value;
              state.plannedError = "";
            },
          }),
        }),
        field({
          label: "Notiz",
          hint: "Bleibt nur in der Verwaltung sichtbar.",
          control: textarea({
            value: state.note,
            placeholder: "Warum wird verschoben?",
            onInput: (value) => {
              state.note = value;
            },
          }),
        })
      ),
    actions: () => [
      button({ label: "Abbrechen", variant: "ghost", onClick: closeModal }),
      button({
        label: "Verschieben",
        icon: "calendar",
        onClick: () => {
          /* Verschieben ohne Termin wirft die Anfrage einfach nur weg —
             dann verliert man sie aus dem Blick. */
          if (!state.planned) {
            postponeDialog(ctx, request, {
              ...state,
              plannedError: "Bitte einen neuen Termin wählen.",
            });
            return;
          }

          const result = postponeRequest(request.id, state.planned, state.note);

          if (!result.ok) {
            postponeDialog(ctx, request, { ...state, error: dialogError(result) });
            return;
          }

          closeModal();
          ctx.refresh();
          toast("Anfrage verschoben.", { icon: "calendar" });
        },
      }),
    ],
  });
}

function rejectDialog(ctx, request) {
  confirmDialog({
    title: "Anfrage ablehnen?",
    text: `${request.name} bekommt keinen Zugang. Ein wartendes Konto wird dabei auf „abgelehnt" gesetzt.`,
    confirmLabel: "Ablehnen",
    cancelLabel: "Abbrechen",
    danger: true,
    onConfirm: () => {
      rejectRequest(request.id);
      ctx.refresh();
      toast("Anfrage abgelehnt.", { icon: "close" });
    },
  });
}

function freeDialog(ctx, konto, draft = null) {
  const coaches = coachAccounts();
  const state = draft || {
    coach: konto.coach || (coaches.length ? coaches[0].email : ""),
    error: "",
  };

  openModal({
    title: "Zugang freischalten",
    subtitle: `${konto.name} · ${konto.email}`,
    body: () =>
      h(
        "div",
        { class: "stack" },
        state.error && noticeWarn(state.error),
        h(
          "p",
          { class: "meta-dim" },
          `Mit der Freischaltung startet das Abo: ${fmtNum(PRICE_EUR)} € im Monat. Danach kommt ${konto.name} in die App.`
        ),
        coaches.length
          ? field({
              label: "Coach",
              control: select({
                value: state.coach,
                options: coaches.map((item) => ({ value: item.email, label: item.name })),
                onChange: (value) => {
                  state.coach = value;
                },
              }),
            })
          : h("p", { class: "meta-dim" }, "Noch kein Coach angelegt — der Kunde bleibt ohne Zuordnung.")
      ),
    actions: () => [
      button({ label: "Abbrechen", variant: "ghost", onClick: closeModal }),
      button({
        label: "Freischalten",
        icon: "check",
        onClick: () => {
          const result = freeAccount(konto.email, { coach: state.coach || null });

          if (!result.ok) {
            freeDialog(ctx, konto, { ...state, error: dialogError(result) });
            return;
          }

          closeModal();
          ctx.refresh();
          toast(`${konto.name} ist freigeschaltet.`, { icon: "check" });
        },
      }),
    ],
  });
}

function coachAssignDialog(ctx, konto) {
  const coaches = coachAccounts();
  const state = { coach: konto.coach || "" };

  openModal({
    title: "Coach zuweisen",
    subtitle: `${konto.name} · ${konto.email}`,
    body: () =>
      coaches.length
        ? field({
            label: "Coach",
            control: select({
              value: state.coach,
              options: [{ value: "", label: "Ohne Zuordnung" }].concat(
                coaches.map((item) => ({ value: item.email, label: item.name }))
              ),
              onChange: (value) => {
                state.coach = value;
              },
            }),
          })
        : h("p", { class: "meta-dim" }, "Noch kein Coach angelegt."),
    actions: () => [
      button({ label: "Abbrechen", variant: "ghost", onClick: closeModal }),
      button({
        label: "Speichern",
        icon: "check",
        onClick: () => {
          updateAccount(konto.email, { coach: state.coach || null });
          closeModal();
          ctx.refresh();
          toast("Coach aktualisiert.", { icon: "award" });
        },
      }),
    ],
  });
}

function coachDialog(ctx, draft = null) {
  const state = draft || { name: "", email: "", password: "", errors: {} };

  openModal({
    title: "Coach anlegen",
    subtitle: "Mitarbeiter mit eigenem Zugang",
    body: () =>
      h(
        "div",
        { class: "stack" },
        state.errors.form && noticeWarn(state.errors.form),
        field({
          label: "Name",
          error: state.errors.name,
          control: textInput({
            value: state.name,
            maxLength: 40,
            autofocus: true,
            onInput: (value) => {
              state.name = value;
            },
          }),
        }),
        field({
          label: "E-Mail",
          error: state.errors.email,
          control: textInput({
            value: state.email,
            type: "email",
            autocomplete: "off",
            placeholder: "name@beispiel.de",
            onInput: (value) => {
              state.email = value;
            },
          }),
        }),
        field({
          label: "Startpasswort",
          hint: `Mindestens ${MIN_PASSWORD} Zeichen. Gib es an den Coach weiter.`,
          error: state.errors.password,
          control: textInput({
            value: state.password,
            maxLength: 72,
            onInput: (value) => {
              state.password = value;
            },
          }),
        })
      ),
    actions: () => [
      button({ label: "Abbrechen", variant: "ghost", onClick: closeModal }),
      button({
        label: "Anlegen",
        icon: "plus",
        onClick: async () => {
          const result = await createAccount({
            name: state.name,
            email: state.email,
            password: state.password,
            role: "coach",
            status: "freigegeben",
          });

          if (!result.ok) {
            coachDialog(ctx, { ...state, errors: result.errors || {} });
            return;
          }

          closeModal();
          ctx.refresh();
          toast("Coach angelegt.", { icon: "check" });
        },
      }),
    ],
  });
}

function blockDialog(ctx, konto) {
  confirmDialog({
    title: "Zugang sperren?",
    text: `${konto.name} kann sich danach nicht mehr anmelden. Das Abo wird pausiert.`,
    confirmLabel: "Sperren",
    cancelLabel: "Abbrechen",
    danger: true,
    onConfirm: () => {
      blockAccount(konto.email);
      ctx.refresh();
      toast("Zugang gesperrt.", { icon: "lock" });
    },
  });
}

function aboDialog(ctx, konto) {
  const on = aboActive(konto);

  confirmDialog({
    title: on ? "Abo pausieren?" : "Abo aktivieren?",
    text: on
      ? `${konto.name} kann die App weiter nutzen, bis der Zugang gesperrt wird. Die monatliche Zahlung von ${fmtNum(PRICE_EUR)} € wird pausiert.`
      : `${konto.name} zahlt wieder ${fmtNum(PRICE_EUR)} € im Monat.`,
    confirmLabel: on ? "Pausieren" : "Aktivieren",
    cancelLabel: "Abbrechen",
    onConfirm: () => {
      setAbo(konto.email, !on);
      ctx.refresh();
      toast(on ? "Abo pausiert." : "Abo aktiviert.", { icon: "credit-card" });
    },
  });
}

function confirmSignOut(ctx) {
  confirmDialog({
    title: "Abmelden?",
    text: "Die Verwaltung wird geschlossen. Die Daten bleiben auf diesem Gerät.",
    confirmLabel: "Abmelden",
    cancelLabel: "Abbrechen",
    onConfirm: () => ctx.leaveAccount(),
  });
}

/* --------------------------------------------------------------------------
   Kleinkram
   -------------------------------------------------------------------------- */

function dialogError(result) {
  const errors = (result && result.errors) || {};
  return errors.form || errors.password || errors.email || errors.name || "Das hat nicht geklappt.";
}

function noticeWarn(text) {
  return h("div", { class: "notice notice--warn" }, Icon("help", "icon icon--sm"), h("p", null, text));
}

function dayOf(stamp) {
  return String(stamp || "").slice(0, 10);
}

/** Freigabestatus eines Kontos. */
function accountStatus(status) {
  const map = {
    wartend: { label: "Wartend", variant: "warn" },
    freigegeben: { label: "Freigegeben", variant: "green" },
    abgelehnt: { label: "Abgelehnt", variant: "" },
    gesperrt: { label: "Gesperrt", variant: "warn" },
  };
  return map[status] || { label: status, variant: "" };
}

function accountChip(status) {
  const info = accountStatus(status);
  return chip(info.label, { variant: info.variant, dot: true });
}

/** Zustand einer Anfrage. Eigene Wörter — „freigegeben" gibt es hier nicht. */
function requestStatus(status) {
  const map = {
    offen: { label: "Offen", variant: "warn" },
    verschoben: { label: "Verschoben", variant: "calm" },
    angenommen: { label: "Angenommen", variant: "green" },
    abgelehnt: { label: "Abgelehnt", variant: "" },
  };
  return map[status] || { label: status, variant: "" };
}

function requestChip(status) {
  const info = requestStatus(status);
  return chip(info.label, { variant: info.variant, dot: true });
}

function typeLabel(type) {
  return type === "coach" ? "Coach" : "Kunde";
}

function typeChip(type) {
  return chip(typeLabel(type), { variant: type === "coach" ? "calm" : "" });
}

function sourceLabel(source) {
  return source === "app" ? "App" : "Website";
}

/**
 * Ein Startpasswort, das man am Telefon vorlesen kann.
 *
 * Kein Zufallsblock: der Admin muss es weitergeben, und ein Passwort, das
 * niemand aussprechen kann, landet auf einem Zettel. Aendern kann es der
 * Kunde spaeter nicht — dafuer fehlt der Server.
 */
function suggestPassword(name) {
  const first = String(name || "").trim().split(/\s+/)[0] || "Sigma";
  const clean = first.replace(/[^A-Za-zÄÖÜäöüß]/g, "") || "Sigma";
  const guess = `${clean.charAt(0).toUpperCase()}${clean.slice(1)}2026!`;
  return guess.length >= MIN_PASSWORD ? guess : "Sigma2026!";
}
