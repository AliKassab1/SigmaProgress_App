/* ==========================================================================
   SIGMA PROGRESS — screens/onboarding.js
   --------------------------------------------------------------------------
   Erster Start in vier kurzen Schritten.

   Grundsatz fuer Menschen mit wenig Zeit: nie mehr als eine Frage pro
   Bildschirm, alles vorbelegt, und ein sichtbarer Fortschritt. Kein
   Screen, auf dem man-scrollen muss.
   ========================================================================== */

import { h } from "../core/dom.js";
import { button, Icon } from "../components/ui.js";
import { field, textInput, optionGroup, checkGroup, steps } from "../components/forms.js";
import {
  EQUIPMENT_OPTIONS,
  GOAL_OPTIONS,
  LEVEL_OPTIONS,
  TIME_OPTIONS,
  demoFor,
} from "../data/seed.js";
import { navigate } from "../core/router.js";
import { currentSession } from "../core/auth.js";
import { toast } from "../core/overlay.js";

/** Entwurf: haengt am Modul, nicht im Zustand, bis der Nutzer fertig ist. */
const draft = {
  name: "",
  age: null,
  height: null,
  weight: null,
  goalWeight: null,
  goal: null,
  level: null,
  timePerDay: null,
  equipment: ["matte"],
};

const TOTAL_STEPS = 4;

function resetDraft() {
  draft.name = "";
  draft.age = null;
  draft.height = null;
  draft.weight = null;
  draft.goalWeight = null;
  draft.goal = null;
  draft.level = null;
  draft.timePerDay = null;
  draft.equipment = ["matte"];
}

export default function renderOnboarding(ctx, route) {
  const current = Math.max(1, Math.min(TOTAL_STEPS, Number(route.param) || 1));

  /* Der Name steht schon im Konto — ihn noch einmal tippen zu lassen, wäre
     eine Frage, deren Antwort schon da ist. */
  if (!draft.name) {
    const session = currentSession();
    if (session) draft.name = session.name || "";
  }

  /* Auswahlfelder aendern, was sichtbar ist (z.B. erscheint danach erst das
     Gewichtsfeld). Deshalb zeichnen sie den Schritt neu. */
  const rerender = () => ctx.refresh();

  return h(
    "div",
    { class: "onboarding" },
    h(
      "div",
      { class: "onboarding__top" },
      h(
        "span",
        { class: "brand__mark brand__mark--lg" },
        h(
          "svg",
          { viewBox: "87.43 386.78 281.24 204.49", "aria-hidden": "true" },
          h("path", { d: "M133.16 472.55h143.53v35.35h-48.52v82.77h-46.5V507.9h-48.51z" })
        )
      ),
      steps({ current, total: TOTAL_STEPS, labels: ["Du", "Ziel", "Rahmen", "Start"] })
    ),

    h("div", { class: "onboarding__body" }, renderStep(current, rerender)),

    h(
      "div",
      { class: "onboarding__foot" },
      current > 1 &&
        button({
          label: "Zurück",
          variant: "ghost",
          onClick: () => navigate(`/onboarding/${current - 1}`, { replace: true }),
        }),
      button({
        label: current === TOTAL_STEPS ? "Los geht's" : "Weiter",
        iconEnd: "arrow-right",
        block: current === 1,
        onClick: () => advance(ctx, current),
      })
    )
  );
}

/* --------------------------------------------------------------------------
   Schritte
   -------------------------------------------------------------------------- */

function renderStep(step, rerender) {
  switch (step) {
    case 1:
      return stepIdentity();
    case 2:
      return stepGoal(rerender);
    case 3:
      return stepFrame(rerender);
    default:
      return stepStart();
  }
}

/** 1 — Wer bist du? */
function stepIdentity() {
  return stepShell(
    "Kurz zu dir",
    "Damit die Zahlen passen. Du kannst alles später ändern.",
    [
      field({
        label: "Wie heisst du?",
        control: textInput({
          value: draft.name,
          placeholder: "Vor- und Nachname",
          autofocus: true,
          maxLength: 40,
          onInput: (value) => {
            draft.name = value;
          },
        }),
      }),
      field({
        label: "Alter",
        control: textInput({
          value: draft.age ?? "",
          type: "number",
          min: 14,
          max: 99,
          inputMode: "numeric",
          placeholder: "z.B. 34",
          onInput: (value) => {
            draft.age = value ? Number(value) : null;
          },
        }),
        suffix: "Jahre",
      }),
      field({
        label: "Grösse",
        control: textInput({
          value: draft.height ?? "",
          type: "number",
          min: 120,
          max: 230,
          inputMode: "numeric",
          placeholder: "z.B. 168",
          onInput: (value) => {
            draft.height = value ? Number(value) : null;
          },
        }),
        suffix: "cm",
      }),
    ]
  );
}

/** 2 — Wohin willst du? */
function stepGoal(rerender) {
  return stepShell(
    "Was ist dein Ziel?",
    "Es gibt kein falsches Ziel. Wir richten alles darauf aus.",
    [
      optionGroup({
        name: "Trainingsziel",
        columns: 1,
        options: GOAL_OPTIONS,
        selected: draft.goal,
        onSelect: (value) => {
          draft.goal = value;
          rerender();
        },
      }),
      draft.goal &&
        field({
          label: "Aktuelles Gewicht",
          control: textInput({
            value: draft.weight ?? "",
            type: "number",
            min: 35,
            max: 250,
            step: 0.1,
            inputMode: "decimal",
            placeholder: "z.B. 68.5",
            onInput: (value) => {
              draft.weight = value ? Number(value) : null;
            },
          }),
          suffix: "kg",
        }),
      draft.goal === "abnehmen" &&
        field({
          label: "Zielgewicht",
          hint: "Realistisch sind 0,5 bis 1 kg pro Woche.",
          control: textInput({
            value: draft.goalWeight ?? "",
            type: "number",
            min: 35,
            max: 250,
            step: 0.1,
            inputMode: "decimal",
            placeholder: "z.B. 62",
            onInput: (value) => {
              draft.goalWeight = value ? Number(value) : null;
            },
          }),
          suffix: "kg",
        }),
    ]
  );
}

/** 3 — Wie viel Zeit und was hast du da? */
function stepFrame(rerender) {
  return stepShell(
    "Dein Rahmen",
    "Wir bauen den Plan nur aus dem, was du wirklich zur Verfügung hast.",
    [
      h("p", { class: "onboarding__q" }, "Wie viel Zeit hast du pro Einheit?"),
      optionGroup({
        name: "Zeit pro Trainingseinheit",
        columns: 2,
        options: TIME_OPTIONS,
        selected: draft.timePerDay,
        onSelect: (value) => {
          draft.timePerDay = value;
          rerender();
        },
      }),

      h("p", { class: "onboarding__q" }, "Wie viel Trainingserfahrung hast du?"),
      optionGroup({
        name: "Trainingslevel",
        columns: 1,
        options: LEVEL_OPTIONS,
        selected: draft.level,
        onSelect: (value) => {
          draft.level = value;
          rerender();
        },
      }),

      h("p", { class: "onboarding__q" }, "Was steht bei dir zu Hause?"),
      h("p", { class: "onboarding__hint" }, "Alles optional — wir zeigen nur, was damit geht."),
      checkGroup({
        name: "Vorhandenes Equipment",
        options: EQUIPMENT_OPTIONS,
        selected: draft.equipment,
        onToggle: (values) => {
          draft.equipment = values;
        },
      }),
    ]
  );
}

/** 4 — Zusammenfassung */
function stepStart() {
  const summary = [
    { label: "Name", value: draft.name || "—" },
    { label: "Grösse / Alter", value: `${draft.height ?? "—"} cm · ${draft.age ?? "—"}` },
    {
      label: "Ziel",
      value: `${goalLabel(draft.goal)}${draft.goalWeight ? ` → ${draft.goalWeight} kg` : ""}`,
    },
    { label: "Zeit pro Einheit", value: draft.timePerDay ? `${draft.timePerDay} Minuten` : "—" },
    {
      label: "Level",
      value: LEVEL_OPTIONS.find((item) => item.value === draft.level)?.label || "—",
    },
    {
      label: "Equipment",
      value: draft.equipment.length
        ? EQUIPMENT_OPTIONS.filter((item) => draft.equipment.includes(item.value))
            .map((item) => item.label)
            .join(", ")
        : "Nichts — nur Körpergewicht",
    },
  ];

  return stepShell(
    "Passt das so?",
    "Du kannst alles jederzeit im Profil ändern.",
    [
      h(
        "div",
        { class: "summary" },
        summary.map((row) =>
          h(
            "div",
            { class: "summary__row" },
            h("span", { class: "summary__label" }, row.label),
            h("span", { class: "summary__value" }, row.value)
          )
        )
      ),
      h(
        "p",
        { class: "onboarding__note" },
        Icon("lock", "icon icon--sm"),
        currentSession()
          ? "Dein Konto und diese Angaben bleiben auf diesem Gerät. Es wird nichts ins Netz geschickt."
          : "Deine Daten bleiben auf diesem Gerät. Es wird nichts ins Netz geschickt."
      ),
    ]
  );
}

function goalLabel(value) {
  return GOAL_OPTIONS.find((item) => item.value === value)?.label || "—";
}

function stepShell(title, sub, children) {
  return h(
    "section",
    { class: "onboarding__step" },
    h("h1", { class: "h1 onboarding__title" }, title),
    h("p", { class: "lead onboarding__sub" }, sub),
    h("div", { class: "onboarding__fields" }, ...children)
  );
}

/* --------------------------------------------------------------------------
   Weiter / Speichern
   -------------------------------------------------------------------------- */

function advance(ctx, current) {
  /* Prüfen, bevor es weitergeht — und sagen, was fehlt. */
  const missing = validate(current);
  if (missing) {
    toast(missing, { icon: "help", duration: 3200 });
    return;
  }

  if (current < TOTAL_STEPS) {
    navigate(`/onboarding/${current + 1}`, { replace: true });
    return;
  }

  finish(ctx);
}

function validate(step) {
  if (step === 1) {
    if (!draft.name.trim()) return "Wie heisst du? Das braucht die App für die Begrüssung.";
    if (!draft.age) return "Bitte dein Alter eintragen.";
    if (!draft.height) return "Bitte deine Grösse eintragen.";
  }

  if (step === 2) {
    if (!draft.goal) return "Wähle ein Ziel aus.";
    if (!draft.weight) return "Bitte dein aktuelles Gewicht eintragen.";
    if (draft.goal === "abnehmen") {
      if (!draft.goalWeight) return "Bitte dein Zielgewicht eintragen.";
      if (draft.goalWeight >= draft.weight) {
        return "Dein Zielgewicht liegt über dem aktuellen. Für „Abnehmen“ bitte ein kleineres Ziel wählen.";
      }
    }
  }

  if (step === 3) {
    if (!draft.timePerDay) return "Wähle aus, wie viel Zeit du hast.";
    if (!draft.level) return "Wähle dein Trainingslevel.";
  }

  return null;
}

/**
 * Onboarding abschliessen.
 *
 * Aus den Angaben wird ein vollstaendiger Demodatenbestand gerechnet: der
 * Gewichtsverlauf laeuft vom eingetragenen Startgewicht bis zum heutigen
 * Wert, die Historie enthaelt nur Einheiten, die mit dem angegebenen
 * Equipment und der angegebenen Zeit moeglich sind. Die App sieht damit
 * beim ersten Oeffnen nicht leer aus — und sie widerspricht sich nicht,
 * weil irgendwo noch die Werte eines anderen Profils stehen.
 */
async function finish(ctx) {
  const profile = {
    name: draft.name.trim(),
    age: draft.age,
    height: draft.height,
    weight: draft.weight,
    goalWeight: draft.goal === "abnehmen" ? draft.goalWeight : draft.weight,
    goal: draft.goal,
    level: draft.level,
    timePerDay: draft.timePerDay,
    equipment: draft.equipment.slice(),
  };

  const demo = demoFor(profile);

  await ctx.update((state) => {
    state.onboarded = true;
    state.profile = {
      ...state.profile,
      ...profile,
      startWeight: demo.startWeight,
    };
    state.goals = demo.goals;
    state.weights = demo.weights;
    state.photos = demo.photos;
    state.milestones = demo.milestones;
    state.nutrition = demo.nutrition;
    state.steps = demo.steps;
    state.workouts = { history: demo.history };
    state.meta.createdAt = new Date().toISOString();
  });

  resetDraft();
  navigate("/dashboard", { replace: true });
}
