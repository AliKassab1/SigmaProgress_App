/* ==========================================================================
   SIGMA PROGRESS — screens/dashboard.js
   --------------------------------------------------------------------------
   Die Startseite.

   Reihenfolge ist hier die wichtigste Designentscheidung: erst die
   Begruessung, dann DIE eine Frage des Tages, dann das Training, dann die
   Zahlen. Wer viel Zeit hat, liest weiter. Wer wenig hat, hat nach der
   zweiten Karte schon alles, was er braucht.
   ========================================================================== */

import { h } from "../core/dom.js";
import {
  button,
  card,
  cardHead,
  chip,
  iconTile,
  sectionHead,
  stat,
  track,
  Icon,
} from "../components/ui.js";
import { lineChart, barChart, dayBars } from "../components/charts.js";
import {
  goalProgress,
  intensityLabel,
  latestWeight,
  minutesThisWeek,
  mindsetOfDay,
  nextCheckin,
  nutritionOn,
  stepsLastDays,
  stepsOn,
  todayTasks,
  trainingKindLabel,
  trainingOn,
  weeklySeries,
  weightChange,
  workoutsThisWeek,
  weekStreak,
} from "../core/stats.js";
import {
  addDays,
  dayKey,
  fmtDate,
  fmtDelta,
  fmtDecimal,
  fmtMinutes,
  fmtNum,
  fmtRelativeDay,
  fmtWeekdayShort,
  greeting,
  initials,
  shortName,
} from "../core/format.js";
import { currentCoach, sessionAccount } from "../core/auth.js";
import { unreadForCustomer } from "../core/messages.js";

/* Der angefasste Punkt im Diagramm lebt im Modul: er ist reiner
   Bildschirmzustand und gehoert nicht in die gespeicherten Daten. */
let selectedWeightDate = null;

export default function renderDashboard(ctx) {
  const state = ctx.getState();
  const session = trainingOn(state, dayKey());

  return h(
    "div",
    { class: "shell" },
    h(
      "div",
      { class: "screen__inner" },
      greetingBlock(ctx, state),
      todayCard(ctx, state),
      trainingCard(ctx, state, session),
      statGrid(state),
      h(
        "div",
        { class: "layout-split" },
        h(
          "div",
          { class: "stack stack--lg" },
          weightCard(ctx, state),
          weeklyMinutesCard(state)
        ),
        h(
          "div",
          { class: "layout-split__side stack stack--lg" },
          weekGoalCard(state),
          coachCard(ctx, state)
        )
      ),
      mindsetCard(state),
      quickActions(ctx)
    )
  );
}

/* --------------------------------------------------------------------------
   Begruessung
   -------------------------------------------------------------------------- */

function greetingBlock(ctx, state) {
  const tasks = todayTasks(state);
  const remaining = tasks.filter((task) => !task.done).length;
  const streak = weekStreak(state);

  return h(
    "header",
    { class: "greet reveal reveal-1" },
    h(
      "div",
      { class: "greet__text" },
      h("p", { class: "label" }, todayLong()),
      h(
        "h1",
        { class: "greet__name" },
        `${greeting()}, `,
        h("em", null, shortName(state.profile.name))
      ),
      h(
        "p",
        { class: "greet__sub" },
        remaining === 0
          ? "Alles erledigt für heute. Geniess den Rest."
          : remaining === 1
          ? "Eine Sache steht heute an."
          : `${remaining} Dinge stehen heute an.`
      )
    ),
    streak.current > 0 &&
      h(
        "div",
        { class: "greet__right" },
        chip(`${streak.current} ${streak.current === 1 ? "Woche" : "Wochen"} Serie`, {
          variant: "green",
          dot: true,
        })
      )
  );
}

function todayLong() {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

/* --------------------------------------------------------------------------
   Was muss ich heute tun?
   -------------------------------------------------------------------------- */

function todayCard(ctx, state) {
  const tasks = todayTasks(state);
  const open = tasks.filter((task) => !task.done).length;

  return card(
    { class: "reveal reveal-2", variant: "raised" },
    sectionHead(
      "Was muss ich heute tun?",
      open === 0
        ? chip("Alles erledigt", { variant: "green", dot: true })
        : chip(`${open} offen`, { variant: "warn" })
    ),
    tasks.length === 0
      ? h("p", { class: "meta-dim" }, "Für heute ist nichts geplant.")
      : h(
          "ul",
          { class: "tasks" },
          tasks.map((task) =>
            h(
              "li",
              { class: `task ${task.done ? "task--done" : ""}` },
              h(
                "span",
                { class: "task__mark" },
                Icon(task.done ? "check" : task.icon, "icon icon--sm")
              ),
              h(
                "div",
                { class: "task__body" },
                h("p", { class: "task__label" }, task.label),
                h("p", { class: "task__hint" }, task.hint)
              ),
              task.progress !== undefined &&
                h(
                  "div",
                  { class: "task__progress" },
                  track(Math.min(1, task.progress) * 100, { thin: true, label: task.label })
                ),
              task.action &&
                button({
                  label: task.action.label,
                  size: "sm",
                  variant: "secondary",
                  onClick: () => ctx.go(task.action.screen, { tab: task.action.tab }),
                })
            )
          )
        )
  );
}

/* --------------------------------------------------------------------------
   Trainingstagebuch
   -------------------------------------------------------------------------- */

function trainingCard(ctx, state, session) {
  const sessions = workoutsThisWeek(state);
  const minutes = minutesThisWeek(state);

  return card(
    { class: "reveal reveal-3 card--halo card--glow" },
    h(
      "div",
      { class: "workout__tag" },
      Icon(session ? "check" : "dumbbell", "icon icon--sm"),
      session ? "Heute trainiert" : "Heute noch nichts eingetragen"
    ),
    h(
      "h2",
      { class: "workout__title" },
      session ? session.name : "Training mit deinem Trainer"
    ),
    h(
      "p",
      { class: "workout__intro" },
      session
        ? `${session.minutes} Minuten · ${intensityLabel(session.intensity)}${
            session.withCoach ? " · mit Trainer" : ""
          }`
        : "Dein Training findet vor Ort statt. Trag danach hier ein, was du gemacht hast."
    ),

    session?.note && h("p", { class: "quote", style: { marginTop: "0.75rem" } }, `„${session.note}“`),

    h(
      "div",
      { class: "workout__meta" },
      metaCell("dumbbell", String(sessions.length), "diese Woche"),
      metaCell("clock", String(minutes), "Minuten"),
      metaCell("target", session ? trainingKindLabel(session.kind) : "Studio", session ? "Art" : "Ort")
    ),

    h(
      "div",
      { class: "workout__actions" },
      button({
        label: session ? "Eintrag ansehen" : "Training eintragen",
        icon: session ? "bar-chart" : "edit",
        variant: session ? "secondary" : "primary",
        block: true,
        onClick: () => ctx.go("tracken", { tab: "training" }),
      })
    )
  );
}

function metaCell(icon, value, text) {
  return h(
    "div",
    { class: "meta-cell" },
    iconTile(icon, { size: "sm" }),
    h("span", { class: "meta-cell__value" }, value),
    h("span", { class: "meta-cell__label" }, text)
  );
}

/* --------------------------------------------------------------------------
   Kennzahlen
   -------------------------------------------------------------------------- */

function statGrid(state) {
  const change = weightChange(state, 28);
  const weight = latestWeight(state)?.kg ?? state.profile.weight;
  const kcal = nutritionOn(state, dayKey()).kcal;
  const steps = stepsOn(state, dayKey());
  const sessions = workoutsThisWeek(state);
  const minutes = minutesThisWeek(state);

  return h(
    "div",
    { class: "grid-4 reveal reveal-4" },
    stat({
      label: "Gewicht",
      value: fmtDecimal(weight),
      unit: "kg",
      icon: "ruler",
      delta: fmtDelta(change),
      deltaMod: change > 0 ? "delta--warn" : "",
      foot: "4 Wochen",
    }),
    stat({
      label: "Kalorien",
      value: fmtNum(kcal),
      unit: "kcal",
      icon: "flame",
      foot: `Ziel ${fmtNum(state.goals.kcalPerDay)}`,
    }),
    stat({
      label: "Schritte",
      value: fmtNum(steps),
      icon: "steps",
      foot: `Ziel ${fmtNum(state.goals.stepsPerDay)}`,
    }),
    stat({
      label: "Training",
      value: fmtMinutes(minutes),
      icon: "clock",
      foot: `${sessions.length}× diese Woche`,
    })
  );
}

/* --------------------------------------------------------------------------
   Gewichtsverlauf
   -------------------------------------------------------------------------- */

function weightCard(ctx, state) {
  const progress = goalProgress(state);
  const series = state.weights
    .filter((entry) => entry.date >= addDays(dayKey(), -84))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const active =
    selectedWeightDate && series.some((entry) => entry.date === selectedWeightDate)
      ? selectedWeightDate
      : series.length
      ? series[series.length - 1].date
      : null;

  const activeEntry = series.find((entry) => entry.date === active);

  return card(
    { class: "reveal reveal-4" },
    cardHead(
      "Gewichtsverlauf",
      chip(`${fmtDecimal(progress.percent)} %`, { variant: "green", mono: true })
    ),
    h(
      "div",
      { class: "chart-card__figure" },
      h("span", { class: "chart-card__figure-value" }, fmtDecimal(activeEntry?.kg ?? progress.current)),
      h("span", { class: "chart-card__figure-unit" }, "kg")
    ),
    h(
      "p",
      { class: "meta-dim", style: { marginTop: "0.25rem" } },
      activeEntry
        ? `${fmtDate(activeEntry.date)}${
            progress.target ? ` · Ziel ${fmtDecimal(progress.target)} kg` : ""
          }`
        : "Noch keine Einträge"
    ),
    h(
      "div",
      { style: { marginTop: "0.875rem" } },
      lineChart({
        data: series,
        goal: state.profile.goalWeight,
        selected: active,
        onSelect: (date) => {
          selectedWeightDate = date;
          ctx.refresh();
        },
        label: "Gewichtsverlauf der letzten zwölf Wochen. Zum Abfragen einen Punkt antippen.",
      })
    ),
    h(
      "div",
      { class: "chart-card__legend" },
      legendItem("green", "Verlauf"),
      state.profile.goalWeight && legendItem("muted", "Zielgewicht")
    )
  );
}

function legendItem(variant, text) {
  return h(
    "span",
    { class: "row", style: { gap: "0.375rem" } },
    h("span", { class: `legend-dot legend-dot--${variant}` }),
    text
  );
}

/* --------------------------------------------------------------------------
   Wochenziel
   -------------------------------------------------------------------------- */

function weekGoalCard(state) {
  const sessions = workoutsThisWeek(state);
  const goal = state.goals.workoutsPerWeek;
  const minutes = minutesThisWeek(state);
  const minutesGoal = state.goals.minutesPerWeek || goal * 30;
  const steps = stepsLastDays(state, 7);
  const averageSteps = steps.length
    ? Math.round(steps.reduce((sum, item) => sum + item.count, 0) / steps.length)
    : 0;
  const streak = weekStreak(state);

  return card(
    { class: "reveal reveal-5" },
    sectionHead("Diese Woche"),
    h(
      "div",
      { class: "goal" },
      h(
        "div",
        { class: "goal__ring" },
        weeklyRing((sessions.length / goal) * 100, `${sessions.length}/${goal}`)
      ),
      h(
        "div",
        { class: "goal__rows" },
        goalRow(
          "Trainingsminuten",
          `${fmtMinutes(minutes)} / ${minutesGoal} min`,
          minutes / minutesGoal
        ),
        goalRow(
          "Schritte ⌀",
          `${fmtNum(averageSteps)} / ${fmtNum(state.goals.stepsPerDay)}`,
          averageSteps / state.goals.stepsPerDay
        ),
        goalRow("Serie", `${streak.current} Wochen`, streak.current / 4)
      )
    ),
    h(
      "div",
      { style: { marginTop: "1rem" } },
      dayBars(
        steps.map((item) => ({ ...item, label: fmtWeekdayShort(item.date).slice(0, 2) })),
        { goal: state.goals.stepsPerDay }
      )
    )
  );
}

/* Ring mit eigener Textzeile — der generische `ring` traegt keinen
   mehrzeiligen Text, deshalb hier direkt gebaut. */
function weeklyRing(percent, text) {
  const size = 78;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const offset = circumference * (1 - clamped / 100);

  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: `0 0 ${size} ${size}`,
      role: "img",
      "aria-label": `${clamped} Prozent des Wochenziels`,
    },
    h("circle", {
      class: "ring__track",
      cx: size / 2,
      cy: size / 2,
      r: radius,
      "stroke-width": stroke,
    }),
    h("circle", {
      class: "ring__value",
      cx: size / 2,
      cy: size / 2,
      r: radius,
      "stroke-width": stroke,
      "stroke-dasharray": circumference,
      "stroke-dashoffset": offset,
    }),
    h(
      "text",
      {
        class: "ring__text",
        x: size / 2,
        y: size / 2 + 4,
        "text-anchor": "middle",
      },
      text
    )
  );
}

function goalRow(text, value, percent) {
  return h(
    "div",
    { class: "goal-row" },
    h("span", { class: "goal-row__label" }, text),
    h("span", { class: "goal-row__value" }, value),
    track(Math.max(0, Math.min(1, percent || 0)) * 100, { thin: true, label: text })
  );
}

/* --------------------------------------------------------------------------
   Trainingsminuten je Woche
   -------------------------------------------------------------------------- */

function weeklyMinutesCard(state) {
  const weeks = weeklySeries(state, 8).map((week) => ({
    ...week,
    label: fmtWeekdayShort(week.start).slice(0, 2),
  }));

  return card(
    { class: "reveal reveal-5" },
    cardHead(
      "Trainingsminuten je Woche",
      chip(`Ziel ${state.goals.minutesPerWeek}`, { mono: true })
    ),
    h(
      "div",
      { style: { marginTop: "0.75rem" } },
      barChart({
        data: weeks,
        valueKey: "minutes",
        goal: state.goals.minutesPerWeek,
        height: 148,
        label: "Trainingsminuten je Woche",
      })
    )
  );
}

/* --------------------------------------------------------------------------
   Coach
   -------------------------------------------------------------------------- */

function coachCard(ctx, state) {
  const checkin = nextCheckin(state);
  const coach = currentCoach(state.profile);
  const account = sessionAccount();
  const unread = account ? unreadForCustomer(account.email) : 0;

  return card(
    { class: "reveal reveal-5 card--glow" },
    sectionHead(
      "Dein Coaching",
      chip(coach.active ? "Aktiv" : "Pausiert", {
        variant: coach.active ? "green" : "",
        dot: coach.active,
      })
    ),
    h(
      "div",
      { class: "row", style: { marginTop: "0.25rem" } },
      h("span", { class: "avatar avatar--cool" }, initials(coach.name)),
      h(
        "div",
        { style: { flex: "1", minWidth: "0" } },
        h("p", { class: "card__title", style: { fontSize: "0.9375rem" } }, coach.name),
        h("p", { class: "meta-dim" }, coach.title)
      )
    ),
    checkin &&
      h(
        "div",
        { class: "checkin-mini" },
        h(
          "div",
          null,
          h("p", { class: "label" }, "Nächstes Check-in"),
          h("p", { class: "checkin-mini__date" }, fmtRelativeDay(checkin.date))
        ),
        button({
          label: "Öffnen",
          size: "sm",
          variant: "secondary",
          onClick: () => ctx.go("profil"),
        })
      ),
    !checkin && h("p", { class: "meta-dim", style: { marginTop: "0.75rem" } }, "Kein offenes Check-in."),
    unread > 0 &&
      h(
        "button",
        { type: "button", class: "coach-unread", onClick: () => ctx.go("chat") },
        Icon("chat", "icon icon--sm"),
        `${unread} neue ${unread === 1 ? "Nachricht" : "Nachrichten"}`
      )
  );
}

/* --------------------------------------------------------------------------
   Mindset
   -------------------------------------------------------------------------- */

function mindsetCard(state) {
  return card(
    { class: "reveal reveal-6", variant: "sunken" },
    h(
      "div",
      { class: "quote" },
      mindsetOfDay(),
      h("p", { class: "quote__meta" }, "Impuls des Tages · ", currentCoach(state.profile).name)
    )
  );
}

/* --------------------------------------------------------------------------
   Schnellzugriff
   -------------------------------------------------------------------------- */

function quickActions(ctx) {
  const actions = [
    { icon: "ruler", label: "Gewicht", tab: "gewicht" },
    { icon: "utensils", label: "Essen", tab: "ernaehrung" },
    { icon: "camera", label: "Foto", tab: "fotos" },
    { icon: "chat", label: "Coach", tab: null },
  ];

  return h(
    "div",
    { class: "quick reveal reveal-6" },
    actions.map((action) =>
      h(
        "button",
        {
          type: "button",
          class: "quick__item",
          onClick: () => (action.tab ? ctx.go("tracken", { tab: action.tab }) : ctx.go("chat")),
        },
        h("span", { class: "quick__icon" }, Icon(action.icon)),
        action.label
      )
    )
  );
}
