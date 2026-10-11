/* ==========================================================================
   SIGMA PROGRESS — screens/fortschritt.js
   --------------------------------------------------------------------------
   Der Bereich, der die Frage beantwortet: „Bringt das was?"

   Zwei Dinge bewusst weggelassen:
     - Konfetti, Punkte, Level. Fortschritt ist kein Spiel.
     - Jede Kennzahl einzeln. Es gibt Summen, Verlauf und Verteilung.

   Alles hier kommt aus stats.js — dieselbe Quelle wie im Dashboard. Wer
   beide Bereiche nebeneinander legt, sieht keine unterschiedlichen Zahlen.
   ========================================================================== */

import { h } from "../core/dom.js";
import {
  button,
  card,
  cardHead,
  chip,
  empty,
  iconTile,
  sectionHead,
  stat,
  track,
  Icon,
} from "../components/ui.js";
import { barChart, lineChart } from "../components/charts.js";
import {
  bmi,
  bmiLabel,
  goalProgress,
  minutesInLastDays,
  minutesThisWeek,
  totalMinutes,
  totalWorkouts,
  trainingKindLabel,
  weekStreak,
  weightChange,
  weightSeries,
  weeklySeries,
  workoutsThisWeek,
} from "../core/stats.js";
import {
  addDays,
  dayKey,
  fmtDate,
  fmtDateLong,
  fmtDelta,
  fmtDecimal,
  fmtMinutes,
  fmtNum,
  plural,
} from "../core/format.js";

/* Zeitraum-Umschalter. Modulzustand — reines Anzeigefilter. */
let range = "90";
let selectedWeight = null;

const RANGES = [
  { id: "30", label: "30 T" },
  { id: "90", label: "90 T" },
  { id: "365", label: "1 J" },
  { id: "all", label: "Alles" },
];

export default function renderFortschritt(ctx) {
  const state = ctx.getState();

  return h(
    "div",
    { class: "shell" },
    h(
      "div",
      { class: "screen__inner" },

      h(
        "header",
        { class: "screen__head" },
        h("h1", { class: "h1" }, "Fortschritt"),
        h(
          "p",
          { class: "lead" },
          "Nüchtern betrachtet: was sich verändert hat und was nicht."
        )
      ),

      headline(ctx, state),
      weightSection(ctx, state),
      trainingSection(state),
      h(
        "div",
        { class: "layout-split" },
        bodyCard(state),
        h("div", { class: "stack stack--lg" }, milestonesCard(state), trendCard(state))
      )
    )
  );
}

/* ==========================================================================
   Die Zahl, auf die es ankommt
   ========================================================================== */

function headline(ctx, state) {
  const progress = goalProgress(state);
  const change = weightChange(state, 84);
  const sessions = workoutsThisWeek(state);
  const goal = state.goals.workoutsPerWeek;
  const streak = weekStreak(state);

  return card(
    { class: "card--glow card--halo" },
    h(
      "div",
      { class: "headline" },
      h(
        "div",
        { class: "headline__main" },
        h("p", { class: "label" }, "Aktuelles Gewicht"),
        h(
          "p",
          { class: "headline__value" },
          fmtDecimal(progress.current),
          h("span", { class: "headline__unit" }, "kg")
        ),
        h(
          "p",
          { class: "meta-dim" },
          progress.start
            ? `Start bei ${fmtDecimal(progress.start)} kg am ${fmtDate(
                state.weights[state.weights.length - 1]?.date
              )}`
            : "Noch kein Startgewicht erfasst"
        )
      ),
      h(
        "div",
        { class: "headline__side" },
        changeBadge(change),
        h(
          "p",
          { class: "meta-dim", style: { marginTop: "0.375rem", textAlign: "right" } },
          streak.current > 0
            ? `${streak.current} ${plural(streak.current, "Woche", "Wochen")} Serie`
            : "Serie beginnt diese Woche"
        )
      )
    ),

    /* Der Fortschritt zum Ziel, mit Abstand zum Ziel in Kilos. */
    h(
      "div",
      { class: "goalbar" },
      track(progress.percent, { label: `Fortschritt zum Zielgewicht: ${progress.percent} Prozent` }),
      h(
        "div",
        { class: "goalbar__labels" },
        h("span", null, progress.start ? `${fmtDecimal(progress.start)} kg` : "Start"),
        h(
          "span",
          { class: progress.done ? "goalbar__done" : "" },
          progress.done
            ? "Ziel erreicht"
            : progress.remaining > 0
            ? `Noch ${fmtDecimal(progress.remaining)} kg`
            : `${progress.percent} %`
        ),
        h("span", null, progress.target ? `${fmtDecimal(progress.target)} kg` : "Ziel")
      )
    ),

    h(
      "div",
      { class: "grid-4", style: { marginTop: "1.25rem" } },
      stat({
        label: "Workouts",
        value: fmtNum(totalWorkouts(state)),
        icon: "dumbbell",
        foot: `${sessions.length}× diese Woche`,
      }),
      stat({
        label: "Trainingszeit",
        value: fmtMinutes(totalMinutes(state)),
        icon: "clock",
        foot: `${fmtMinutes(minutesThisWeek(state))} diese Woche`,
      }),
      stat({
        label: "Zum Ziel",
        value: `${progress.percent} %`,
        icon: "target",
        foot: `Ziel ${goal}× pro Woche`,
      }),
      stat({
        label: "BMI",
        value: fmtDecimal(bmi(state)),
        icon: "ruler",
        foot: bmiLabel(bmi(state)),
      })
    )
  );
}

function changeBadge(change) {
  const good = change < 0;
  const flat = Math.abs(change) < 0.3;

  return h(
    "span",
    { class: `badge-change ${flat ? "badge-change--flat" : good ? "" : "badge-change--up"}` },
    Icon(flat ? "minus" : good ? "arrow-down" : "arrow-up", "icon icon--sm"),
    fmtDelta(change)
  );
}

/* ==========================================================================
   Gewicht
   ========================================================================== */

function weightSection(ctx, state) {
  const days = range === "all" ? 3650 : Number(range);
  const series = weightSeries(state, days);

  const active =
    selectedWeight && series.some((entry) => entry.date === selectedWeight)
      ? selectedWeight
      : series.length
      ? series[series.length - 1].date
      : null;
  const activeEntry = series.find((entry) => entry.date === active);
  const first = series[0];
  const last = series[series.length - 1];

  return card(
    {},
    cardHead(
      "Gewichtsverlauf",
      h(
        "div",
        { class: "row", style: { gap: "0.375rem" } },
        RANGES.map((item) =>
          h(
            "button",
            {
              type: "button",
              class: `chip chip--btn ${range === item.id ? "chip--green" : ""}`,
              "aria-pressed": range === item.id ? "true" : "false",
              onClick: () => {
                range = item.id;
                selectedWeight = null;
                ctx.refresh();
              },
            },
            item.label
          )
        )
      )
    ),

    series.length < 2
      ? empty({
          icon: "ruler",
          title: "Zu wenig Daten",
          hint: "Ab zwei Einträgen siehst du hier eine Kurve.",
          action: button({
            label: "Gewicht eintragen",
            icon: "ruler",
            onClick: () => ctx.go("tracken", { tab: "gewicht" }),
          }),
        })
      : h(
          "div",
          null,
          h(
            "div",
            { class: "chart-card__figure" },
            h("span", { class: "chart-card__figure-value" }, fmtDecimal(activeEntry?.kg ?? 0)),
            h("span", { class: "chart-card__figure-unit" }, "kg")
          ),
          h(
            "p",
            { class: "meta-dim", style: { marginTop: "0.25rem" } },
            activeEntry
              ? `${fmtDateLong(activeEntry.date)} · ${first.date === last.date ? "einziger Eintrag" : `${fmtDecimal(first.kg)} → ${fmtDecimal(last.kg)} kg`}`
              : "—"
          ),
          h(
            "div",
            { style: { marginTop: "0.875rem" } },
            lineChart({
              data: series,
              goal: state.profile.goalWeight,
              height: 200,
              selected: active,
              format: (value) => fmtDecimal(value),
              onSelect: (date) => {
                selectedWeight = date;
                ctx.refresh();
              },
              label: "Gewichtsverlauf. Einen Punkt antippen für den genauen Wert.",
            })
          ),
          h(
            "p",
            { class: "meta-dim", style: { marginTop: "0.75rem" } },
            "Die Waage zeigt jeden Tag etwas anderes. Entscheidend ist die Linie über Wochen, nicht der Wert von heute."
          )
        )
  );
}

/* ==========================================================================
   Training
   ========================================================================== */

function trainingSection(state) {
  const weeks = weeklySeries(state, 8).map((week) => ({
    ...week,
    label: fmtDate(week.start).slice(0, 2),
  }));

  const last28 = minutesInLastDays(state, 28);
  const from = addDays(dayKey(), -27);
  const sessions28 = state.workouts.history.filter((item) => item.date >= from).length;

  return card(
    {},
    cardHead("Trainingsumfang je Woche", chip(`Ziel ${state.goals.minutesPerWeek} min`, { mono: true })),

    h(
      "div",
      { style: { marginTop: "0.875rem" } },
      barChart({
        data: weeks,
        valueKey: "minutes",
        goal: state.goals.minutesPerWeek,
        height: 168,
        label: "Trainingsminuten je Woche",
      })
    ),

    h(
      "div",
      { class: "grid-2", style: { marginTop: "1.25rem" } },
      measureRow("Letzte 4 Wochen", fmtMinutes(last28), "Minuten trainiert"),
      measureRow("Einheiten", fmtNum(sessions28), "in den letzten 4 Wochen")
    )
  );
}

function measureRow(label, value, sub) {
  return h(
    "div",
    { class: "measure" },
    h("span", { class: "measure__label" }, label),
    h("div", { class: "measure__value" }, value),
    h("div", { class: "measure__delta" }, sub)
  );
}

/* ==========================================================================
   Koerper und BMI
   ========================================================================== */

function bodyCard(state) {
  /* Wie sich die Trainingszeit in den letzten vier Wochen auf die
     Trainingsarten verteilt — zeigt, was tatsächlich gemacht wurde. */
  const totals = new Map();
  const from = addDays(dayKey(), -27);
  let total = 0;

  state.workouts.history
    .filter((item) => item.date >= from)
    .forEach((session) => {
      const minutes = session.minutes || 0;
      totals.set(session.kind, (totals.get(session.kind) || 0) + minutes);
      total += minutes;
    });

  const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);

  return card(
    {},
    sectionHead("Was du wirklich trainiert hast", h("span", { class: "meta-dim" }, "letzte 4 Wochen")),
    h(
      "div",
      { class: "distribution" },
      h(
        "ul",
        { class: "distribution__list" },
        ranked.map(([kind, value]) =>
          h(
            "li",
            { class: "distribution__row" },
            h("span", { class: "distribution__name" }, trainingKindLabel(kind)),
            h(
              "span",
              { class: "distribution__value" },
              `${Math.round((value / Math.max(1, total)) * 100)} %`
            ),
            track((value / Math.max(1, total)) * 100, {
              thin: true,
              label: `${trainingKindLabel(kind)}: ${value} von ${total} Minuten`,
            })
          )
        )
      )
    ),
    total === 0 && h("p", { class: "meta-dim" }, "Noch keine Trainingsdaten im Zeitraum.")
  );
}

/* ==========================================================================
   Meilensteine
   ========================================================================== */

function milestonesCard(state) {
  const milestones = state.milestones || [];
  const progress = goalProgress(state);

  /* Was als naechstes kommt, ist eine Aussage, kein Spielstand. */
  const next =
    progress.percent >= 100
      ? "Zielgewicht erreicht — jetzt geht es um Erhalt."
      : `Noch ${fmtDecimal(progress.remaining)} kg bis zum Ziel.`;

  return card(
    {},
    sectionHead("Meilensteine", chip(`${milestones.length} erreicht`, { variant: "green", dot: true })),
    milestones.length === 0
      ? h("p", { class: "meta-dim" }, "Noch keine Meilensteine.")
      : h(
          "ul",
          { class: "milestones" },
          milestones
            .slice()
            .reverse()
            .map((item) =>
              h(
                "li",
                { class: "milestone" },
                iconTile(item.icon, { size: "sm" }),
                h(
                  "div",
                  { style: { flex: "1", minWidth: "0" } },
                  h("p", { class: "milestone__label" }, item.label),
                  h("p", { class: "milestone__date" }, fmtRelative(item.date))
                )
              )
            )
        ),
    h("p", { class: "milestone__next" }, Icon("arrow-right", "icon icon--sm"), next)
  );
}

function fmtRelative(day) {
  const days = Math.round(
    (new Date(dayKey()) - new Date(day)) / 86400000
  );
  if (days <= 0) return "Heute";
  if (days === 1) return "Gestern";
  if (days < 31) return `Vor ${days} Tagen`;
  return fmtDate(day);
}

/* ==========================================================================
   Einordnung
   ========================================================================== */

function trendCard(state) {
  const week = workoutsThisWeek(state);
  const goal = state.goals.workoutsPerWeek;
  const minutes = minutesThisWeek(state);
  const averagePerWeek = averageWeekly(state);

  return card(
    {},
    sectionHead("Einordnung"),
    h(
      "ul",
      { class: "facts" },
      factRow("dumbbell", "Diese Woche", `${week.length} von ${goal} Einheiten`),
      factRow("clock", "Zeit diese Woche", fmtMinutes(minutes)),
      factRow("bar-chart", "Schnitt über 8 Wochen", fmtMinutes(averagePerWeek)),
      factRow("calendar", "Ziel pro Woche", fmtMinutes(state.goals.minutesPerWeek))
    ),
    h(
      "p",
      { class: "meta-dim", style: { marginTop: "0.875rem" } },
      week.length >= goal
        ? "Ziel dieser Woche ist erreicht. Gut."
        : `Noch ${goal - week.length} ${plural(goal - week.length, "Einheit", "Einheiten")} bis zum Wochenziel.`
    )
  );
}

function averageWeekly(state) {
  const weeks = weeklySeries(state, 8);
  if (!weeks.length) return 0;
  const total = weeks.reduce((sum, week) => sum + week.minutes, 0);
  return Math.round(total / weeks.length);
}

function factRow(icon, label, value) {
  return h(
    "li",
    { class: "fact" },
    iconTile(icon, { size: "sm", variant: "plain" }),
    h("span", { class: "fact__label" }, label),
    h("span", { class: "fact__value" }, value)
  );
}
