/* ==========================================================================
   SIGMA PROGRESS — screens/tracken.js
   --------------------------------------------------------------------------
   Der Ort zum Eingeben.

     Gewicht     — 30 Sekunden, eine Zahl, fertig
     Training    — Tagebuch: was du (mit deinem Trainer) gemacht hast
     Ernährung   — ein Essenstagebuch im Yazio-Stil: suchen, Portion
                   wählen, Mahlzeit zuordnen, Summen und Makros im Blick
     Fotos       — der Fortschritt, den man sieht

   Grundsatz fuer diesen Screen: so wenig Tippen wie moeglich. Ueberall
   wo sich etwas rechnen laesst, rechnet die App es aus. Jede Aktion gibt
   sofort Rueckmeldung, und das Ergebnis steht im selben Moment an anderer
   Stelle der App wieder.
   ========================================================================== */

import { h, readImage } from "../core/dom.js";
import {
  button,
  card,
  cardHead,
  chip,
  empty,
  iconTile,
  listRow,
  segmented,
  track,
  Icon,
} from "../components/ui.js";
import {
  dateInput,
  field,
  filePicker,
  numberStepper,
  select,
  textInput,
} from "../components/forms.js";
import { lineChart } from "../components/charts.js";
import { closeModal, confirmDialog, openModal, toast } from "../core/overlay.js";
import {
  bySessionDate,
  intensityLabel,
  INTENSITIES,
  latestWeight,
  minutesThisWeek,
  nutritionEntriesOn,
  nutritionOn,
  trainingKindLabel,
  trainingOn,
  TRAINING_KINDS,
  waterOn,
  workoutsThisWeek,
} from "../core/stats.js";
import { FOODS, FOOD_CATEGORIES, foodById, foodPortion } from "../data/foods.js";
import {
  dayKey,
  fmtDate,
  fmtDateLong,
  fmtDecimal,
  fmtNum,
  fmtRelativeDay,
  plural,
} from "../core/format.js";

/* -------------------------------------------------------------------------- */

const TABS = [
  { id: "gewicht", label: "Gewicht" },
  { id: "training", label: "Training" },
  { id: "ernaehrung", label: "Ernährung" },
  { id: "fotos", label: "Fotos" },
];

/* Entwuerfe. Sie gehoeren nicht in die gespeicherten Daten — erst das
   Speichern macht daraus eine Eingabe. So springt beim Tippen nichts. */
const draft = {
  weightKg: null,
  weightDate: null,
  meal: null,
  training: null,
  foodQuery: "",
  foodCat: "alle",
  foodMeal: "Frühstück",
  foodOpen: null,
  foodGrams: null,
  photoNote: "",
  photoDate: null,
};

function resetWeightDraft(state) {
  const last = latestWeight(state);
  draft.weightKg = last?.kg ?? state.profile.weight ?? 70;
  draft.weightDate = dayKey();
}

function resetMealDraft() {
  draft.meal = { meal: "Frühstück", kcal: null, protein: null, carbs: null, fat: null };
}

function resetTrainingDraft() {
  draft.training = {
    kind: "kraft",
    date: dayKey(),
    minutes: 45,
    intensity: "mittel",
    withCoach: true,
    note: "",
  };
}

export default function renderTracken(ctx, route) {
  const state = ctx.getState();
  const tab = TABS.some((item) => item.id === route.param) ? route.param : "gewicht";

  /* Entwuerfe bei Bedarf fuellen, damit die Felder nie leer starten. */
  if (draft.weightKg === null) resetWeightDraft(state);
  if (!draft.meal) resetMealDraft();
  if (!draft.training) resetTrainingDraft();

  const render = () => {
    switch (tab) {
      case "training":
        return trainingTab(ctx, state);
      case "ernaehrung":
        return nutritionTab(ctx, state);
      case "fotos":
        return photosTab(ctx, state);
      default:
        return weightTab(ctx, state);
    }
  };

  return h(
    "div",
    { class: "shell" },
    h(
      "div",
      { class: "screen__inner" },
      h(
        "header",
        { class: "screen__head" },
        h("h1", { class: "h1" }, "Tracken"),
        h("p", { class: "lead" }, "Alles, was du eingibst, wird sofort ausgewertet.")
      ),
      segmented(
        TABS,
        tab,
        (next) => ctx.go("tracken", { tab: next }),
        { label: "Bereich wählen" }
      ),
      h("div", { class: "tabpanel" }, render())
    )
  );
}

/**
 * Kleine Auswahl mit lokalem Zustand. Anders als `segmented` (das nur den
 * Zustand beim Aufbau kennt) spiegelt diese Variante den Klick sofort im
 * Bild — wichtig in Dialogen, die nicht neu gezeichnet werden.
 */
function choiceGroup(items, activeId, onSelect, { label: ariaLabel } = {}) {
  let active = activeId;
  const buttons = items.map((item) =>
    h(
      "button",
      {
        type: "button",
        class: "segmented__btn",
        "aria-pressed": item.id === active ? "true" : "false",
        onClick: () => {
          active = item.id;
          buttons.forEach((btn, index) =>
            btn.setAttribute("aria-pressed", items[index].id === active ? "true" : "false")
          );
          onSelect(item.id);
        },
      },
      item.label
    )
  );

  return h(
    "div",
    { class: "segmented", role: "group", "aria-label": ariaLabel || "Auswahl" },
    buttons
  );
}

/* ==========================================================================
   GEWICHT
   ========================================================================== */

function weightTab(ctx, state) {
  return h(
    "div",
    { class: "stack stack--lg" },

    card(
      { variant: "raised" },
      h("h2", { class: "card__title" }, "Wie viel wiegst du?"),
      h(
        "p",
        { class: "meta-dim", style: { marginTop: "0.25rem" } },
        "Morgens, nüchtern, nach dem WC. Ein Wert pro Tag reicht."
      ),

      /* Der Wert wird live im Feld angezeigt; gespeichert wird unten. */
      h(
        "div",
        { class: "weigh" },
        numberStepper({
          value: draft.weightKg,
          min: 30,
          max: 250,
          step: 0.1,
          big: true,
          suffix: "kg",
          label: "Gewicht in Kilogramm",
          onChange: (value) => {
            draft.weightKg = value;
          },
        })
      ),
      h(
        "div",
        { style: { marginTop: "1rem" } },
        button({
          label: "Gewicht speichern",
          icon: "check",
          block: true,
          size: "lg",
          onClick: () => saveWeight(ctx),
        })
      )
    ),

    weightChartCard(state),
    weightHistoryCard(ctx, state)
  );
}

async function saveWeight(ctx) {
  const kg = Math.round(draft.weightKg * 10) / 10;
  if (!kg || kg < 30 || kg > 250) {
    toast("Bitte ein Gewicht zwischen 30 und 250 kg eintragen.", { icon: "help" });
    return;
  }

  const date = draft.weightDate || dayKey();

  await ctx.update((state) => {
    const existing = state.weights.find((entry) => entry.date === date);
    if (existing) {
      existing.kg = kg;
    } else {
      state.weights.push({ id: `w-${date}`, date, kg });
    }
    state.profile.weight = kg;
    /* Beim ersten Eintrag gilt er als Startgewicht. */
    if (!state.profile.startWeight) state.profile.startWeight = kg;
  });

  toast(`${fmtDecimal(kg)} kg gespeichert`, { icon: "check" });
}

function weightChartCard(state) {
  const series = [...state.weights]
    .filter((entry) => entry.date >= "0000")
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-30);

  return card(
    {},
    cardHead("Gewichtsverlauf"),
    h(
      "div",
      { style: { marginTop: "0.875rem" } },
      lineChart({
        data: series,
        goal: state.profile.goalWeight,
        label: "Gewichtsverlauf. Einen Punkt antippen für den genauen Wert.",
        format: (value) => fmtDecimal(value),
      })
    )
  );
}

function weightHistoryCard(ctx, state) {
  const entries = [...state.weights]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 12);

  return card(
    {},
    cardHead("Deine Einträge"),
    entries.length === 0
      ? empty({ icon: "ruler", title: "Noch keine Einträge", hint: "Dein erster Wert steht oben." })
      : h(
          "div",
          { class: "stack" },
          entries.map((entry, index) => {
            const previous = entries[index + 1];
            const delta = previous ? Math.round((entry.kg - previous.kg) * 10) / 10 : null;

            return h(
              "div",
              { class: "wlog" },
              h(
                "div",
                { style: { flex: "1", minWidth: "0" } },
                h("p", { class: "list__title" }, fmtDate(entry.date)),
                h(
                  "p",
                  { class: "list__sub" },
                  `${fmtRelativeDay(entry.date)}${
                    delta !== null ? ` · ${delta > 0 ? "+" : ""}${fmtDecimal(delta)} kg` : ""
                  }`
                )
              ),
              h("span", { class: "wlog__value" }, fmtDecimal(entry.kg), h("span", null, " kg")),
              h(
                "button",
                {
                  type: "button",
                  class: "icon-btn icon-btn--ghost",
                  "aria-label": `${fmtDate(entry.date)} löschen`,
                  onClick: () => removeWeight(ctx, entry),
                },
                Icon("trash")
              )
            );
          })
        )
  );
}

function removeWeight(ctx, entry) {
  confirmDialog({
    title: "Eintrag löschen?",
    text: `${fmtDecimal(entry.kg)} kg vom ${fmtDate(entry.date)} werden entfernt.`,
    confirmLabel: "Löschen",
    danger: true,
    onConfirm: async () => {
      await ctx.update((state) => {
        state.weights = state.weights.filter((item) => item.id !== entry.id);
        const next = [...state.weights].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        if (next) state.profile.weight = next.kg;
      });
      toast("Eintrag gelöscht", { icon: "check" });
    },
  });
}

/* ==========================================================================
   TRAINING — das Tagebuch
   ========================================================================== */

const INTENSITY_OPTS = INTENSITIES;

function metaCell(icon, value, text) {
  return h(
    "div",
    { class: "meta-cell" },
    iconTile(icon, { size: "sm" }),
    h("span", { class: "meta-cell__value" }, value),
    h("span", { class: "meta-cell__label" }, text)
  );
}

function trainingTab(ctx, state) {
  const session = trainingOn(state, dayKey());

  return h(
    "div",
    { class: "stack stack--lg" },
    todayTrainingCard(ctx, state, session),
    historyCard(ctx, state)
  );
}

function todayTrainingCard(ctx, state, session) {
  const weekMinutes = minutesThisWeek(state);
  const weekCount = workoutsThisWeek(state).length;

  return card(
    { class: "card--halo card--glow" },
    h(
      "div",
      { class: "workout__tag" },
      Icon(session ? "check" : "dumbbell", "icon icon--sm"),
      session ? "Heute trainiert" : "Heute noch nichts eingetragen"
    ),
    h("h2", { class: "workout__title" }, session ? session.name : "Training mit deinem Trainer"),
    h(
      "p",
      { class: "workout__intro" },
      session
        ? `${session.minutes} Minuten · ${intensityLabel(session.intensity)}${
            session.withCoach ? " · mit Trainer" : " · allein"
          }`
        : "Dein Training findet vor Ort statt. Trag hier ein, was du gemacht hast — die App zählt Einheiten, Minuten und deine Serie."
    ),

    h(
      "div",
      { class: "workout__meta" },
      metaCell("clock", String(session ? session.minutes : weekMinutes), session ? "Minuten heute" : "Minuten diese Woche"),
      metaCell("dumbbell", String(weekCount), "diese Woche"),
      metaCell("target", session ? trainingKindLabel(session.kind) : "Studio", session ? "Art" : "Trainingsort")
    ),

    h(
      "div",
      { class: "stack", style: { marginTop: "1rem" } },
      session
        ? button({
            label: "Eintrag ansehen",
            icon: "bar-chart",
            variant: "secondary",
            block: true,
            onClick: () => openSessionDetail(ctx, session),
          })
        : button({
            label: "Training eintragen",
            icon: "edit",
            block: true,
            size: "lg",
            onClick: () => openTrainingSheet(ctx, state),
          }),
      button({
        label: session ? "Weiteren Tag eintragen" : "Für einen anderen Tag eintragen",
        variant: "ghost",
        block: true,
        onClick: () => openTrainingSheet(ctx, state),
      })
    )
  );
}

/* --- Training eintragen ------------------------------------------------- */

/* Das Formular lebt im Dialog. Beim Tippen wird der Entwurf geaendert und
   die Vorschau direkt aktualisiert — kein Neuzeichnen, kein Sprung. */
function openTrainingSheet(ctx, state) {
  if (!draft.training || draft.training.date === null) resetTrainingDraft();
  draft.training.date = dayKey();
  const training = draft.training;

  openModal({
    title: "Training eintragen",
    subtitle: "Was du mit deinem Trainer gemacht hast — nicht, was du vorhattest.",
    body: () => {
      const summary = h("p", { class: "sheet__preview" });
      const updateSummary = () => {
        summary.textContent = `${trainingKindLabel(training.kind)} · ${training.minutes} min · ${intensityLabel(
          training.intensity
        )}${training.withCoach ? " · mit Trainer" : " · allein"}`;
      };
      updateSummary();

      return h(
        "div",
        { class: "stack" },
        field({
          label: "Art des Trainings",
          control: select({
            value: training.kind,
            ariaLabel: "Trainingsart wählen",
            options: TRAINING_KINDS.map((kind) => ({ value: kind.id, label: kind.label })),
            onChange: (value) => {
              training.kind = value;
              updateSummary();
            },
          }),
        }),
        field({
          label: "Datum",
          control: dateInput({
            value: training.date,
            max: dayKey(),
            onChange: (value) => {
              training.date = value || dayKey();
            },
          }),
        }),
        field({
          label: "Dauer",
          control: numberStepper({
            value: training.minutes,
            min: 5,
            max: 240,
            step: 5,
            suffix: "min",
            label: "Dauer in Minuten",
            onChange: (value) => {
              training.minutes = value;
              updateSummary();
            },
          }),
        }),
        field({
          label: "Intensität",
          control: choiceGroup(INTENSITY_OPTS, training.intensity, (value) => {
            training.intensity = value;
            updateSummary();
          }, { label: "Intensität wählen" }),
        }),
        field({
          label: "Begleitung",
          control: choiceGroup(
            [
              { id: "mit", label: "Mit Trainer" },
              { id: "allein", label: "Allein" },
            ],
            training.withCoach ? "mit" : "allein",
            (value) => {
              training.withCoach = value === "mit";
              updateSummary();
            },
            { label: "Begleitung wählen" }
          ),
        }),
        field({
          label: "Notiz (optional)",
          control: textInput({
            value: training.note || "",
            placeholder: "z.B. Fokus Beine, neues Gewicht, Anmerkung vom Trainer …",
            onInput: (value) => {
              training.note = value;
            },
          }),
        }),
        h("p", { class: "sheet__preview sheet__preview--accent" }, ""),
        h("p", { class: "meta-dim" }, "Ein Eintrag pro Tag — die Zahlen im Dashboard beziehen sich darauf.")
      )
    },
    actions: () => [
      button({ label: "Abbrechen", variant: "ghost", onClick: closeModal }),
      button({ label: "Eintragen", icon: "check", onClick: () => saveTraining(ctx) }),
    ],
  });
}

async function saveTraining(ctx) {
  const training = draft.training;
  if (!training) return;

  const date = training.date || dayKey();
  const minutes = Math.max(1, Number(training.minutes) || 45);
  const kind = TRAINING_KINDS.some((item) => item.id === training.kind) ? training.kind : "kraft";

  /* Ein Training pro Tag — sonst wären die Wochenwerte doppelt. */
  if (ctx.getState().workouts.history.some((item) => item.date === date)) {
    closeModal();
    toast("Für diesen Tag ist schon ein Training erfasst.", { icon: "help" });
    return;
  }

  await ctx.update((state) => {
    state.workouts.history.push({
      id: `h-${date}-${Date.now()}`,
      date,
      kind,
      name: trainingKindLabel(kind),
      minutes,
      intensity: training.intensity || "mittel",
      withCoach: !!training.withCoach,
      note: (training.note || "").trim(),
      completedAt: new Date().toISOString(),
    });
    state.workouts.history.sort(bySessionDate);
  });

  closeModal();
  resetTrainingDraft();
  toast("Training eingetragen.", { icon: "check" });
}

function historyCard(ctx, state) {
  const sessions = [...state.workouts.history]
    .filter((item) => item.date !== dayKey())
    .sort(bySessionDate)
    .slice(0, 12);

  return card(
    {},
    cardHead(
      "Trainingsverlauf",
      chip(`${state.workouts.history.length} gesamt`, { mono: true })
    ),
    sessions.length === 0
      ? empty({ icon: "dumbbell", title: "Noch keine Trainingseinheiten" })
      : h(
          "div",
          { class: "stack" },
          sessions.map((session) =>
            listRow({
              title: session.name,
              sub: `${fmtDate(session.date)} · ${session.minutes} Minuten · ${intensityLabel(
                session.intensity
              )}${session.withCoach ? " · mit Trainer" : ""}`,
              icon: "dumbbell",
              onClick: () => openSessionDetail(ctx, session),
              trailing: chip(`${session.minutes} min`, { mono: true }),
            })
          )
        )
  );
}

function openSessionDetail(ctx, session) {
  const rows = [
    `Dauer: ${session.minutes} Minuten`,
    session.intensity ? `Intensität: ${intensityLabel(session.intensity)}` : null,
    session.withCoach ? "Begleitung: mit deinem Trainer" : "Begleitung: allein",
    session.note ? `Notiz: ${session.note}` : null,
  ].filter(Boolean);

  openModal({
    title: session.name,
    subtitle: `${fmtDateLong(session.date)} · ${session.minutes} Minuten`,
    body: h(
      "div",
      { class: "stack" },
      rows.map((text) => h("p", { class: "list__sub" }, text)),
      h(
        "div",
        { style: { marginTop: "0.5rem" } },
        button({
          label: "Eintrag löschen",
          variant: "ghost",
          icon: "trash",
          onClick: () => removeTraining(ctx, session),
        })
      )
    ),
  });
}

function removeTraining(ctx, session) {
  confirmDialog({
    title: "Eintrag löschen?",
    text: `Das Training vom ${fmtDate(session.date)} wird entfernt.`,
    confirmLabel: "Löschen",
    danger: true,
    onConfirm: async () => {
      await ctx.update((state) => {
        state.workouts.history = state.workouts.history.filter((item) => item.id !== session.id);
      });
      closeModal();
      toast("Eintrag gelöscht", { icon: "check" });
    },
  });
}

/* ==========================================================================
   ERNÄHRUNG
   ========================================================================== */

const MEALS_OF_DAY = ["Frühstück", "Mittagessen", "Snack", "Abendessen"];
const WATER_GLASS_ML = 250;
const WATER_GLASSES = 8;

function nutritionTab(ctx, state) {
  const totals = nutritionOn(state, dayKey());
  const entries = nutritionEntriesOn(state, dayKey());

  return h(
    "div",
    { class: "stack stack--lg" },
    daySummaryCard(ctx, state, totals, entries),
    waterCard(ctx, state),
    h("div", { class: "stack" }, MEALS_OF_DAY.map((meal) => mealCard(ctx, entries, meal))),
    h(
      "div",
      null,
      button({
        label: "Nur Kalorien eintragen (manuell)",
        icon: "edit",
        variant: "ghost",
        block: true,
        onClick: () => openMealSheet(ctx),
      })
    )
  );
}

function daySummaryCard(ctx, state, totals, entries) {
  const goal = state.goals.kcalPerDay || 2000;
  const remaining = goal - totals.kcal;
  const over = remaining < 0;

  return card(
    {},
    cardHead(
      "Heute",
      chip(`${entries.length} ${plural(entries.length, "Eintrag", "Einträge")}`, { mono: true })
    ),
    h(
      "div",
      { class: "energy" },
      h(
        "span",
        { class: `energy__value ${over ? "energy__value--over" : ""}` },
        fmtNum(Math.abs(remaining)),
        h("span", { class: "energy__unit" }, " kcal")
      ),
      h("span", { class: "energy__label" }, over ? "über deinem Ziel" : "noch übrig")
    ),
    track(Math.min(100, (totals.kcal / goal) * 100), {
      label: `Kalorien: ${fmtNum(totals.kcal)} von ${fmtNum(goal)} kcal`,
    }),
    h(
      "p",
      { class: "meta-dim", style: { marginTop: "0.375rem" } },
      `Gegessen ${fmtNum(totals.kcal)} von ${fmtNum(goal)} kcal`
    ),
    h(
      "div",
      { class: "macro", style: { marginTop: "0.875rem" } },
      macroBar("Protein", totals.protein, state.goals.proteinPerDay, "g"),
      macroBar("Kohlenhydrate", totals.carbs, Math.round((goal * 0.45) / 4), "g"),
      macroBar("Fett", totals.fat, Math.round((goal * 0.3) / 9), "g")
    ),
    h(
      "div",
      { style: { marginTop: "1rem" } },
      button({
        label: "Essen hinzufügen",
        icon: "plus",
        block: true,
        size: "lg",
        onClick: () => openFoodSearch(ctx),
      })
    )
  );
}

function macroBar(name, value, target, unit) {
  const percent = target ? Math.min(100, (value / target) * 100) : 0;

  return h(
    "div",
    { class: "macro__row" },
    h(
      "div",
      { class: "macro__head" },
      h("span", { class: "macro__name" }, name),
      h("span", { class: "macro__value" }, `${fmtNum(value)} / ${fmtNum(target)} ${unit}`)
    ),
    track(percent, {
      thin: percent >= 100,
      label: `${name}: ${fmtNum(value)} von ${fmtNum(target)} ${unit}`,
    })
  );
}

function waterCard(ctx, state) {
  const ml = waterOn(state, dayKey());
  const glasses = Math.round(ml / WATER_GLASS_ML);
  const liters = (ml / 1000).toLocaleString("de-CH", { maximumFractionDigits: 2 });

  return card(
    {},
    cardHead("Wasser", chip(`${liters} l`, { mono: true })),
    h(
      "div",
      { class: "water" },
      h(
        "button",
        {
          type: "button",
          class: "icon-btn icon-btn--ghost",
          "aria-label": "Ein Glas weniger",
          onClick: () => setWater(ctx, Math.max(0, parseGlasses(ctx) - 1)),
        },
        Icon("minus")
      ),
      h(
        "div",
        { class: "water__glasses" },
        Array.from({ length: WATER_GLASSES }, (_, index) =>
          h(
            "button",
            {
              type: "button",
              class: `water__glass ${index < parseGlasses(ctx) ? "water__glass--full" : ""}`,
              "aria-label": `${index + 1} ${index + 1 === 1 ? "Glas" : "Gläser"} Wasser`,
              onClick: () => setWater(ctx, index + 1),
            },
            Icon("drop", "icon icon--sm")
          )
        )
      ),
      h(
        "button",
        {
          type: "button",
          class: "icon-btn icon-btn--ghost",
          "aria-label": "Ein Glas mehr",
          onClick: () => setWater(ctx, parseGlasses(ctx) + 1),
        },
        Icon("plus")
      )
    ),
    h(
      "p",
      { class: "meta-dim", style: { marginTop: "0.5rem", textAlign: "center" } },
      `${parseGlasses(ctx)} von ${WATER_GLASSES} Gläsern · Ziel ${(WATER_GLASSES * WATER_GLASS_ML) / 1000} l`
    )
  );
}

function parseGlasses(ctx) {
  return Math.floor(waterOn(ctx.getState(), dayKey()) / WATER_GLASS_ML);
}

function setWater(ctx, glasses) {
  const next = Math.max(0, Math.min(16, glasses)) * WATER_GLASS_ML;
  ctx.update((state) => {
    if (!state.nutrition.water) state.nutrition.water = {};
    state.nutrition.water[dayKey()] = next;
  });
}

function mealCard(ctx, entries, meal) {
  const items = entries.filter((entry) => entry.meal === meal);
  const kcal = items.reduce((sum, entry) => sum + entry.kcal, 0);

  return card(
    {},
    cardHead(
      meal,
      h(
        "div",
        { class: "row", style: { gap: "0.375rem" } },
        chip(`${fmtNum(kcal)} kcal`, { mono: true }),
        h(
          "button",
          {
            type: "button",
            class: "icon-btn icon-btn--primary",
            "aria-label": `${meal}: Essen hinzufügen`,
            onClick: () => openFoodSearch(ctx, meal),
          },
          Icon("plus")
        )
      )
    ),
    items.length === 0
      ? h("p", { class: "meta-dim", style: { padding: "0.375rem 0" } }, "Nichts erfasst.")
      : h(
          "div",
          { class: "stack" },
          items.map((entry) => mealRow(ctx, entry))
        )
  );
}

function mealRow(ctx, entry) {
  return h(
    "div",
    { class: "wlog" },
    h(
      "div",
      { style: { flex: "1", minWidth: "0" } },
      h("p", { class: "list__title" }, entry.name || "Eigener Eintrag"),
      h(
        "p",
        { class: "list__sub" },
        `${entry.grams ? `${fmtNum(entry.grams)} g · ` : ""}${entry.protein || entry.carbs || entry.fat ? `${entry.protein} g Protein · ${entry.carbs} g KH · ${entry.fat} g Fett` : "ohne Makros"}`
      )
    ),
    h("span", { class: "wlog__value" }, fmtNum(entry.kcal), h("span", null, " kcal")),
    h(
      "button",
      {
        type: "button",
        class: "icon-btn icon-btn--ghost",
        "aria-label": `${entry.name || entry.meal} löschen`,
        onClick: () => removeMeal(ctx, entry),
      },
      Icon("trash")
    )
  );
}

function removeMeal(ctx, entry) {
  ctx.update((state) => {
    state.nutrition.entries = state.nutrition.entries.filter((item) => item.id !== entry.id);
  });
  toast(`${entry.name || entry.meal} entfernt`, { icon: "check" });
}

/* --- Essenssuche im Yazio-Stil ----------------------------------------- */

function openFoodSearch(ctx, presetMeal = null) {
  if (presetMeal) draft.foodMeal = presetMeal;
  if (!MEALS_OF_DAY.includes(draft.foodMeal)) draft.foodMeal = MEALS_OF_DAY[0];
  draft.foodQuery = "";
  draft.foodCat = "alle";
  draft.foodOpen = null;
  draft.foodGrams = null;

  openModal({
    title: "Essen hinzufügen",
    subtitle: "Suche, wähle die Menge und trag es in eine Mahlzeit ein.",
    body: () => {
      const results = h("div", { class: "food-list" });
      const favorites = h("div", { class: "quick-picks" });
      const recents = h("div", { class: "quick-picks" });

      const mealSelect = select({
        value: draft.foodMeal,
        ariaLabel: "Mahlzeit wählen",
        options: MEALS_OF_DAY.map((meal) => ({ value: meal, label: meal })),
        onChange: (value) => {
          draft.foodMeal = value;
        },
      });

      const search = textInput({
        value: draft.foodQuery,
        placeholder: "z.B. Hähnchen, Reis, Banane …",
        autofocus: true,
        onInput: (value) => {
          draft.foodQuery = value;
          draft.foodOpen = null;
          renderList();
        },
      });

      const catRow = h("div", { class: "chip-row" });

      const renderCats = () => {
        catRow.replaceChildren(
          ...FOOD_CATEGORIES.map((category) =>
            h(
              "button",
              {
                type: "button",
                class: `chip chip--btn ${draft.foodCat === category.id ? "chip--green" : ""}`,
                "aria-pressed": draft.foodCat === category.id ? "true" : "false",
                onClick: () => {
                  draft.foodCat = category.id;
                  draft.foodOpen = null;
                  renderCats();
                  renderList();
                },
              },
              category.label
            )
          )
        );
      };

      const renderFavorites = () => {
        const ids = ctx.getState().nutrition.favorites || [];
        const foods = ids.map((id) => foodById(id)).filter(Boolean);

        if (!foods.length) {
          favorites.replaceChildren();
          favorites.hidden = true;
          return;
        }

        favorites.hidden = false;
        favorites.replaceChildren(
          h("span", { class: "quick-picks__label" }, "Favoriten"),
          ...foods.map((food) =>
            h(
              "button",
              {
                type: "button",
                class: "chip chip--btn",
                onClick: () => {
                  draft.foodOpen = food.id;
                  draft.foodGrams = food.grams;
                  renderList();
                },
              },
              food.name
            )
          )
        );
      };

      const renderList = () => {
        const query = (draft.foodQuery || "").toLowerCase().trim();
        let items = FOODS.filter((food) => draft.foodCat === "alle" || food.cat === draft.foodCat);
        if (query) items = items.filter((food) => food.name.toLowerCase().includes(query));

        results.replaceChildren(...items.map((food) => foodRow(ctx, food, renderList)));
      };

      const renderRecents = () => {
        const items = recentFoods(ctx.getState());
        recents.replaceChildren(
          items.length ? h("span", { class: "quick-picks__label" }, "Zuletzt") : "",
          ...items.map((item) =>
            h(
              "button",
              {
                type: "button",
                class: "chip chip--btn",
                onClick: () => addFood(ctx, foodById(item.id), item.grams),
              },
              `${item.name} · ${item.grams} g`
            )
          )
        );
      };

      renderCats();
      renderFavorites();
      renderRecents();
      renderList();

      return h(
        "div",
        { class: "stack" },
        field({ label: "Mahlzeit", control: mealSelect }),
        field({ label: "Suchen", control: search }),
        catRow,
        favorites,
        recents,
        results
      );
    },
  });
}

function foodRow(ctx, food, rerender) {
  const favorites = ctx.getState().nutrition.favorites || [];
  const isFavorite = favorites.includes(food.id);
  const open = draft.foodOpen === food.id;
  const grams = open && draft.foodGrams ? draft.foodGrams : food.grams;
  const portion = foodPortion(food);

  const serving = h(
    "div",
    { class: "food-detail" },
    h(
      "p",
      { class: "food-row__meta" },
      `je 100 g: ${food.kcal} kcal · ${food.protein} g Protein · ${food.carbs} g KH · ${food.fat} g Fett`
    ),
    h(
      "div",
      { class: "food-detail__chips" },
      [...new Set([food.grams, 100, 150, 200])]
        .sort((a, b) => a - b)
        .map((option) =>
          h(
            "button",
            {
              type: "button",
              class: `chip chip--btn ${option === grams ? "chip--green" : ""}`,
              onClick: () => {
                draft.foodGrams = option;
                rerender();
              },
            },
            `${option} g`
          )
        )
    ),
    h(
      "div",
      { class: "food-detail__amount" },
      numberStepper({
        value: grams,
        min: 5,
        max: 1000,
        step: 5,
        suffix: "g",
        label: `${food.name}: Gramm`,
        onChange: (value) => {
          draft.foodGrams = value;
        },
      }),
      button({
        label: "Hinzufügen",
        icon: "plus",
        onClick: () => addFood(ctx, food, draft.foodGrams || food.grams),
      })
    )
  );

  return h(
    "div",
    { class: `food-row ${open ? "food-row--open" : ""}` },
    h(
      "div",
      { style: { flex: "1", minWidth: "0" } },
      h(
        "button",
        {
          type: "button",
          class: "food-row__main",
          onClick: () => {
            draft.foodOpen = open ? null : food.id;
            draft.foodGrams = open ? null : food.grams;
            rerender();
          },
        },
        h("p", { class: "food-row__name" }, food.name),
        h(
          "p",
          { class: "food-row__meta" },
          `${food.portion} · ${portion.kcal} kcal · ${food.protein} g Protein`
        )
      ),
      open && serving
    ),
    h(
      "div",
      { class: "food-row__actions" },
      h(
        "button",
        {
          type: "button",
          class: `icon-btn icon-btn--ghost ${isFavorite ? "is-active" : ""}`,
          "aria-label": `${food.name} als Favorit ${isFavorite ? "entfernen" : "markieren"}`,
          onClick: () => toggleFavorite(ctx, food.id, rerender),
        },
        Icon("heart", `icon icon--sm ${isFavorite ? "icon--filled" : ""}`)
      ),
      h(
        "button",
        {
          type: "button",
          class: "icon-btn icon-btn--primary",
          "aria-label": open ? `${food.name} schließen` : `${food.name} auswählen`,
          onClick: () => {
            draft.foodOpen = open ? null : food.id;
            draft.foodGrams = open ? null : food.grams;
            rerender();
          },
        },
        Icon(open ? "close" : "plus")
      )
    )
  );
}

function recentFoods(state) {
  const seen = new Map();

  for (const entry of state.nutrition.entries) {
    if (!entry.foodId) continue;
    const current = seen.get(entry.foodId);
    if (current) {
      current.count += 1;
    } else {
      seen.set(entry.foodId, { id: entry.foodId, name: entry.name, grams: entry.grams || 100, count: 1 });
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function toggleFavorite(ctx, id, rerender) {
  ctx.update((state) => {
    if (!state.nutrition.favorites) state.nutrition.favorites = [];
    const list = state.nutrition.favorites;
    const index = list.indexOf(id);
    if (index >= 0) list.splice(index, 1);
    else list.push(id);
  });
  if (rerender) rerender();
}

async function addFood(ctx, food, grams) {
  if (!food) return;
  const portion = foodPortion(food, grams || food.grams);

  await ctx.update((state) => {
    state.nutrition.entries.push({
      id: `n-${dayKey()}-${Date.now()}`,
      date: dayKey(),
      meal: draft.foodMeal || MEALS_OF_DAY[0],
      foodId: food.id,
      name: food.name,
      grams: portion.grams,
      kcal: portion.kcal,
      protein: portion.protein,
      carbs: portion.carbs,
      fat: portion.fat,
    });
  });

  closeModal();
  const totals = nutritionOn(ctx.getState(), dayKey());
  toast(`${food.name} erfasst — ${fmtNum(totals.kcal)} kcal heute`, { icon: "check" });
}

/* --- Nur Kalorien (manuell) -------------------------------------------- */

function openMealSheet(ctx) {
  if (!draft.meal) resetMealDraft();
  const meal = draft.meal;

  openModal({
    title: "Nur Kalorien",
    subtitle: "Für schnelle Einträge ohne Suche — die App rechnet die Summe.",
    body: () => {
      const summary = h("p", { class: "sheet__preview" });
      const updateSummary = () => {
        summary.textContent = [
          meal.kcal ? `${fmtNum(meal.kcal)} kcal` : null,
          meal.protein ? `${meal.protein} g Protein` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        summary.hidden = !meal.kcal;
      };
      updateSummary();

      return h(
        "div",
        { class: "stack" },
        field({
          label: "Mahlzeit",
          control: select({
            value: meal.meal,
            ariaLabel: "Mahlzeit wählen",
            options: MEALS_OF_DAY.map((item) => ({ value: item, label: item })),
            onChange: (value) => {
              meal.meal = value;
            },
          }),
        }),
        field({ label: "Kalorien", control: numberInput(meal, "kcal", 0, 5000, updateSummary) }),
        field({ label: "Protein", hint: "optional", control: numberInput(meal, "protein", 0, 300, updateSummary) }),
        h(
          "div",
          { class: "grid-2" },
          field({ label: "Kohlenhydrate", hint: "optional", control: numberInput(meal, "carbs") }),
          field({ label: "Fett", hint: "optional", control: numberInput(meal, "fat") })
        ),
        summary,
        h(
          "p",
          { class: "meta-dim" },
          "Für einzelne Lebensmittel mit genauen Nährwerten nutze „Essen hinzufügen“."
        )
      );
    },
    actions: () =>
      h(
        "div",
        { class: "row", style: { width: "100%", gap: "0.5rem" } },
        h(
          "button",
          { type: "button", class: "btn btn--secondary btn--block", onClick: () => closeModal() },
          "Abbrechen"
        ),
        h(
          "button",
          { type: "button", class: "btn btn--primary btn--block", onClick: () => saveMeal(ctx) },
          "Speichern"
        )
      ),
  });
}

function numberInput(target, key, min = 0, max = 5000, onChange = null) {
  return textInput({
    value: target[key] ?? "",
    type: "number",
    min,
    max,
    inputMode: "decimal",
    placeholder: "0",
    onInput: (value) => {
      target[key] = value === "" ? null : Number(value);
      if (onChange) onChange();
    },
  });
}

async function saveMeal(ctx) {
  const meal = draft.meal;

  if (!meal.kcal) {
    toast("Ohne Kalorien hilft der Eintrag nicht weiter.", { icon: "help" });
    return;
  }

  await ctx.update((state) => {
    state.nutrition.entries.push({
      id: `m-${dayKey()}-${Date.now()}`,
      date: dayKey(),
      meal: meal.meal,
      kcal: meal.kcal,
      protein: meal.protein || 0,
      carbs: meal.carbs || 0,
      fat: meal.fat || 0,
    });
  });

  closeModal();
  resetMealDraft();

  const totals = nutritionOn(ctx.getState(), dayKey());
  toast(`Erfasst — ${fmtNum(totals.kcal)} kcal heute`, { icon: "check" });
}

/* ==========================================================================
   FOTOS
   ========================================================================== */

function photosTab(ctx, state) {
  const photos = [...state.photos].sort((a, b) => (a.date < b.date ? 1 : -1));
  const first = photos[0];
  const last = photos[photos.length - 1];

  return h(
    "div",
    { class: "stack stack--lg" },

    card(
      { variant: "raised" },
      h("h2", { class: "card__title" }, "Fortschrittsfoto"),
      h(
        "p",
        { class: "meta-dim", style: { marginTop: "0.25rem" } },
        first && last && first.id !== last.id
          ? `${fmtDecimal(last.kg)} kg → ${fmtDecimal(first.kg)} kg`
          : "Gleiche Bedingungen (Licht, Pose, Tageszeit) machen den Vergleich erst aussagekräftig."
      ),
      h(
        "div",
        { style: { marginTop: "1rem" } },
        photoPicker(ctx)
      )
    ),

    photos.length === 0
      ? card(
          {},
          empty({
            icon: "camera",
            title: "Noch keine Fotos",
            hint: "Ein Foto alle zwei Wochen reicht.",
          })
        )
      : h(
          "div",
          { class: "photo-grid" },
          photos.map((photo) => photoTile(ctx, photo, first))
        ),

    card(
      { variant: "sunken" },
      h(
        "p",
        { class: "meta-dim" },
        "Fotos werden auf diesem Gerät verkleinert und bleiben offline gespeichert. Sie werden nirgendwohin hochgeladen."
      )
    )
  );
}

function photoPicker(ctx) {
  const picker = filePicker({
    onFiles: (files) => addPhotos(ctx, files),
    multiple: true,
    accept: "image/*",
  });

  return h(
    "div",
    { class: "row", style: { gap: "0.5rem" } },
    button({ label: "Foto aufnehmen oder wählen", icon: "camera", block: true, onClick: picker.trigger }),
    picker.input
  );
}

function photoTile(ctx, photo, newest) {
  return h(
    "figure",
    { class: `photo ${newest?.id === photo.id ? "photo--newest" : ""}` },
    h("img", {
      src: photo.src,
      alt: `Fortschrittsfoto vom ${fmtDate(photo.date)}${photo.kg ? `, ${fmtDecimal(photo.kg)} kg` : ""}`,
    }),
    h(
      "figcaption",
      null,
      h("span", null, fmtDate(photo.date)),
      photo.kg ? h("span", { class: "meta-dim" }, `${fmtDecimal(photo.kg)} kg`) : null
    ),
    h(
      "button",
      {
        type: "button",
        class: "icon-btn icon-btn--ghost",
        "aria-label": `Foto vom ${fmtDate(photo.date)} löschen`,
        onClick: () => removePhoto(ctx, photo),
      },
      Icon("trash")
    )
  );
}

async function addPhotos(ctx, files) {
  let added = 0;

  for (const file of files) {
    try {
      const { src } = await readImage(file, 900);

      await ctx.update((state) => {
        state.photos.push({
          id: `p-${Date.now()}-${added}`,
          date: dayKey(),
          kg: latestWeight(state)?.kg ?? state.profile.weight,
          note: "",
          placeholder: false,
          src,
        });
        added += 1;
      });
    } catch (error) {
      toast(error.message || "Bild konnte nicht geladen werden.", { icon: "help", duration: 3600 });
      break;
    }
  }

  if (added) toast(`${added} ${plural(added, "Foto", "Fotos")} hinzugefügt`, { icon: "check" });
}

function removePhoto(ctx, photo) {
  confirmDialog({
    title: "Foto löschen?",
    text: `Das Bild vom ${fmtDate(photo.date)} wird von diesem Gerät entfernt.`,
    confirmLabel: "Löschen",
    danger: true,
    onConfirm: async () => {
      await ctx.update((state) => {
        state.photos = state.photos.filter((item) => item.id !== photo.id);
      });
      toast("Foto gelöscht", { icon: "check" });
    },
  });
}
