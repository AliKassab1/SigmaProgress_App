/* ==========================================================================
   SIGMA PROGRESS — screens/profil.js
   --------------------------------------------------------------------------
   Deine Daten, dein Coaching, deine Einstellungen.

   Aufbau nach dem, was Nutzer tatsaechlich suchen:

     1. Wer bin ich          — Name, Alter, Groesse, Gewicht, Ziel (bearbeitbar)
     2. Wie trainiere ich    — Level, Zeit, Equipment, Wochenziel
     3. Mein Coaching        — Status, naechstes Check-in, Aufgaben
     4. Einstellungen        — Benachrichtigungen, Sprache, Dunkelmodus, Daten
     5. Konto                — angemeldet, abmelden, zuruecksetzen

   Der Check-in ist der wichtigste Teil: dort entsteht die naechste Aufgabe,
   und sie landet am selben Tag auf dem Dashboard.
   ========================================================================== */

import { h } from "../core/dom.js";
import {
  avatar,
  button,
  card,
  cardHead,
  chip,
  iconTile,
  list,
  listRow,
  sectionHead,
  stat,
  Icon,
} from "../components/ui.js";
import {
  checkGroup,
  field,
  optionGroup,
  select,
  textInput,
  toggle,
} from "../components/forms.js";
import { closeModal, confirmDialog, openModal, toast } from "../core/overlay.js";
import { exportState, reset } from "../core/repo.js";
import { currentCoach, currentSession, sessionAccount, PRICE_EUR } from "../core/auth.js";
import {
  bmi,
  bmiLabel,
  goalProgress,
  lastCheckin,
  nextCheckin,
  totalWorkouts,
  todayTasks,
  weekStreak,
} from "../core/stats.js";
import {
  dayKey,
  daysBetween,
  fmtDate,
  fmtDateLong,
  fmtDecimal,
  fmtNum,
  fmtRelativeDay,
  initials,
} from "../core/format.js";
import {
  EQUIPMENT_OPTIONS,
  GOAL_OPTIONS,
  LEVEL_OPTIONS,
  TIME_OPTIONS,
} from "../data/seed.js";

export default function renderProfil(ctx) {
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
        h("h1", { class: "h1" }, "Profil"),
        h("p", { class: "lead" }, "Deine Angaben, dein Coaching, deine Einstellungen.")
      ),

      identityCard(ctx, state),
      trainingSetupCard(ctx, state),
      coachingCard(ctx, state),
      aboCard(),
      settingsCard(ctx, state),
      accountCard(ctx, state),
      aboutCard()
    )
  );
}

/* ==========================================================================
   Wer bin ich
   ========================================================================== */

function identityCard(ctx, state) {
  const { profile } = state;
  const progress = goalProgress(state);

  return card(
    {},
    h(
      "div",
      { class: "identity" },
      h("span", { class: "avatar avatar--xl" }, initials(profile.name)),
      h(
        "div",
        { style: { flex: "1", minWidth: "0" } },
        h("p", { class: "identity__name" }, profile.name || "Dein Name"),
        h(
          "p",
          { class: "meta-dim" },
          profile.age && profile.height
            ? `${profile.age} Jahre · ${profile.height} cm · BMI ${fmtDecimal(bmi(state))}`
            : "Angaben ergänzen"
        ),
        h(
          "p",
          { class: "meta-dim" },
          goalLabel(profile.goal),
          profile.goalWeight ? ` · Ziel ${fmtDecimal(profile.goalWeight)} kg` : ""
        )
      ),
      button({
        label: "Bearbeiten",
        size: "sm",
        variant: "secondary",
        icon: "edit",
        onClick: () => openProfileEditor(ctx, state),
      })
    ),

    h(
      "div",
      { class: "grid-4", style: { marginTop: "1.25rem" } },
      stat({
        label: "Aktuell",
        value: fmtDecimal(progress.current),
        unit: "kg",
        icon: "ruler",
      }),
      stat({
        label: "Ziel",
        value: progress.target ? fmtDecimal(progress.target) : "—",
        unit: "kg",
        icon: "target",
      }),
      stat({
        label: "Fortschritt",
        value: `${progress.percent} %`,
        icon: "bar-chart",
      }),
      stat({
        label: "BMI",
        value: fmtDecimal(bmi(state)),
        icon: "activity",
        foot: bmiLabel(bmi(state)),
      })
    ),

    h(
      "div",
      { class: "grid-2", style: { marginTop: "1.25rem" } },
      smallFact("Workouts gesamt", String(totalWorkouts(state))),
      smallFact("Serie", `${weekStreak(state).current} Wochen`)
    )
  );
}

function goalLabel(value) {
  return GOAL_OPTIONS.find((item) => item.value === value)?.label || "Ziel nicht gesetzt";
}

function smallFact(label, value) {
  return h(
    "div",
    { class: "measure" },
    h("span", { class: "measure__label" }, label),
    h("div", { class: "measure__value" }, value)
  );
}

/* --- Bearbeiten ---------------------------------------------------------- */

/* Der Entwurf haengt am Modul: beim Tippen wird nichts gespeichert, und
   ein abgebrochener Dialog aendert nichts. */
const draft = {};

function openProfileEditor(ctx, state) {
  Object.assign(draft, {
    name: state.profile.name,
    age: state.profile.age,
    height: state.profile.height,
    weight: state.profile.weight,
    goalWeight: state.profile.goalWeight,
    goal: state.profile.goal,
    level: state.profile.level,
    timePerDay: state.profile.timePerDay,
    equipment: [...(state.profile.equipment || [])],
  });

  openModal({
    title: "Angaben bearbeiten",
    subtitle: "Alles optional ausser dem Namen.",
    size: "tall",
    body: () =>
      h(
        "div",
        { class: "stack stack--lg" },

        field({
          label: "Name",
          control: textInput({
            value: draft.name,
            maxLength: 40,
            onInput: (value) => {
              draft.name = value;
            },
          }),
        }),

        h(
          "div",
          { class: "grid-2" },
          field({
            label: "Alter",
            control: textInput({
              value: draft.age ?? "",
              type: "number",
              min: 14,
              max: 99,
              inputMode: "numeric",
              onInput: (value) => {
                draft.age = value ? Number(value) : null;
              },
            }),
            suffix: "J.",
          }),
          field({
            label: "Grösse",
            control: textInput({
              value: draft.height ?? "",
              type: "number",
              min: 120,
              max: 230,
              inputMode: "numeric",
              onInput: (value) => {
                draft.height = value ? Number(value) : null;
              },
            }),
            suffix: "cm",
          })
        ),

        h(
          "div",
          { class: "grid-2" },
          field({
            label: "Aktuelles Gewicht",
            control: textInput({
              value: draft.weight ?? "",
              type: "number",
              min: 30,
              max: 250,
              step: 0.1,
              inputMode: "decimal",
              onInput: (value) => {
                draft.weight = value ? Number(value) : null;
              },
            }),
            suffix: "kg",
          }),
          field({
            label: "Zielgewicht",
            hint: "leer lassen = halten",
            control: textInput({
              value: draft.goalWeight ?? "",
              type: "number",
              min: 30,
              max: 250,
              step: 0.1,
              inputMode: "decimal",
              onInput: (value) => {
                draft.goalWeight = value ? Number(value) : null;
              },
            }),
            suffix: "kg",
          })
        ),

        sectionHead("Ziel"),
        optionGroup({
          name: "Trainingsziel",
          columns: 2,
          options: GOAL_OPTIONS,
          selected: draft.goal,
          onSelect: (value) => {
            draft.goal = value;
            ctx.refresh();
          },
        }),

        sectionHead("Wie ich trainiere"),
        optionGroup({
          name: "Zeit pro Einheit",
          columns: 2,
          options: TIME_OPTIONS,
          selected: draft.timePerDay,
          onSelect: (value) => {
            draft.timePerDay = value;
            ctx.refresh();
          },
        }),
        optionGroup({
          name: "Trainingslevel",
          columns: 1,
          options: LEVEL_OPTIONS,
          selected: draft.level,
          onSelect: (value) => {
            draft.level = value;
            ctx.refresh();
          },
        }),

        sectionHead("Equipment"),
        checkGroup({
          name: "Vorhandenes Equipment",
          options: EQUIPMENT_OPTIONS,
          selected: draft.equipment,
          onToggle: (values) => {
            draft.equipment = values;
          },
        })
      ),
    actions: h(
      "div",
      { class: "row", style: { width: "100%", gap: "0.5rem" } },
      h(
        "button",
        { type: "button", class: "btn btn--secondary btn--block", onClick: () => closeEditor() },
        "Abbrechen"
      ),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--primary btn--block",
          onClick: () => saveProfile(ctx),
        },
        "Speichern"
      )
    ),
  });
}

/* Dialog schliessen. Eigene Funktion, weil sie in vier Blaettern gebraucht
   wird und der Import sonst viermal wiederholt werden muesste. */
function closeEditor() {
  closeModal();
}

async function saveProfile(ctx) {
  const weightChanged = draft.weight && draft.weight !== ctx.getState().profile.weight;

  await ctx.update((state) => {
    state.profile.name = String(draft.name || "").trim() || state.profile.name;
    state.profile.age = draft.age;
    state.profile.height = draft.height;
    state.profile.weight = draft.weight ?? state.profile.weight;
    state.profile.goalWeight = draft.goalWeight ?? null;
    state.profile.goal = draft.goal;
    state.profile.level = draft.level;
    state.profile.timePerDay = draft.timePerDay;
    state.profile.equipment = draft.equipment.slice();

    /* Startgewicht erst setzen, wenn es noch keines gibt — sonst waere
       jeder Profilwechsel ein Neustart bei null. */
    if (!state.profile.startWeight && draft.weight) {
      state.profile.startWeight = draft.weight;
    }

    /* Gewichtswechsel im Profil als eigenen Eintrag festhalten, damit der
       Verlauf nicht springt, nur weil im Formular eine andere Zahl steht. */
    if (weightChanged) {
      const today = dayKey();
      const existing = state.weights.find((entry) => entry.date === today);
      if (existing) existing.kg = draft.weight;
      else state.weights.push({ id: `w-${today}`, date: today, kg: draft.weight });
    }
  });

  closeEditor();
  toast("Angaben gespeichert", { icon: "check" });
}

/* ==========================================================================
   Trainingsrahmen
   ========================================================================== */

function trainingSetupCard(ctx, state) {
  const { profile, goals } = state;

  return card(
    {},
    cardHead("Trainingsrahmen"),
    h(
      "div",
      { class: "stack" },
      listRow({
        title: "Zeit pro Einheit",
        sub: "So lang ist dein Tagesprogramm",
        icon: "clock",
        chevron: false,
        trailing: chip(`${profile.timePerDay || "–"} min`, { mono: true }),
      }),
      listRow({
        title: "Level",
        sub: levelLabel(profile.level),
        icon: "activity",
        chevron: false,
        trailing: button({
          label: "Ändern",
          size: "sm",
          variant: "ghost",
          onClick: () => openSetupSheet(ctx),
        }),
      }),
      listRow({
        title: "Equipment",
        sub: equipmentLabel(profile.equipment),
        icon: "dumbbell",
        chevron: false,
      }),
      listRow({
        title: "Wochenziel",
        sub: `${goals.workoutsPerWeek} Einheiten · ${goals.minutesPerWeek} Minuten`,
        icon: "target",
        chevron: false,
        trailing: button({
          label: "Ändern",
          size: "sm",
          variant: "ghost",
          onClick: () => openGoalsSheet(ctx),
        }),
      })
    )
  );
}

function levelLabel(value) {
  return LEVEL_OPTIONS.find((item) => item.value === value)?.label || "Nicht gesetzt";
}

/* --- Zeit, Level und Equipment ------------------------------------------- */

const setupDraft = { timePerDay: null, level: null, equipment: [] };

function openSetupSheet(ctx) {
  const state = ctx.getState();
  Object.assign(setupDraft, {
    timePerDay: state.profile.timePerDay,
    level: state.profile.level,
    equipment: [...(state.profile.equipment || [])],
  });

  openModal({
    title: "Trainingsrahmen",
    subtitle: "Danach richtet sich der Tagesplan.",
    body: () =>
      h(
        "div",
        { class: "stack stack--lg" },

        sectionHead("Zeit pro Einheit"),
        optionGroup({
          name: "Zeit pro Einheit",
          columns: 2,
          options: TIME_OPTIONS,
          selected: setupDraft.timePerDay,
          onSelect: (value) => {
            setupDraft.timePerDay = value;
            ctx.refresh();
          },
        }),

        sectionHead("Trainingslevel"),
        optionGroup({
          name: "Trainingslevel",
          columns: 1,
          options: LEVEL_OPTIONS,
          selected: setupDraft.level,
          onSelect: (value) => {
            setupDraft.level = value;
            ctx.refresh();
          },
        }),

        sectionHead("Equipment"),
        h(
          "p",
          { class: "meta-dim" },
          "Alles optional. Wir zeigen nur Trainings, die mit dem Passenden funktionieren."
        ),
        checkGroup({
          name: "Vorhandenes Equipment",
          options: EQUIPMENT_OPTIONS,
          selected: setupDraft.equipment,
          onToggle: (values) => {
            setupDraft.equipment = values;
          },
        })
      ),
    actions: h(
      "div",
      { class: "row", style: { width: "100%", gap: "0.5rem" } },
      h(
        "button",
        { type: "button", class: "btn btn--secondary btn--block", onClick: () => closeEditor() },
        "Abbrechen"
      ),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--primary btn--block",
          onClick: async () => {
            await ctx.update((s) => {
              s.profile.timePerDay = setupDraft.timePerDay;
              s.profile.level = setupDraft.level;
              s.profile.equipment = setupDraft.equipment.slice();

              /* Das Wochenziel folgt der Zeit — sonst steht im Kopf etwas
                 anderes als auf dem Dashboard. */
              if (s.profile.timePerDay) {
                s.goals.minutesPerWeek = s.goals.workoutsPerWeek * s.profile.timePerDay;
              }
            });
            closeEditor();
            toast("Trainingsrahmen gespeichert", { icon: "check" });
          },
        },
        "Speichern"
      )
    ),
  });
}

function equipmentLabel(list) {
  if (!list || !list.length) return "Nur Körpergewicht";
  return EQUIPMENT_OPTIONS.filter((item) => list.includes(item.value))
    .map((item) => item.label)
    .join(", ");
}

/* --- Wochenziel anpassen ------------------------------------------------- */

function openGoalsSheet(ctx) {
  const goals = { ...ctx.getState().goals };

  openModal({
    title: "Wochenziel",
    subtitle: "Realistisch ist, was du auch an schlechten Tagen schaffst.",
    body: () =>
      h(
        "div",
        { class: "stack stack--lg" },

        optionGroup({
          name: "Einheiten pro Woche",
          columns: 2,
          options: [2, 3, 4, 5].map((value) => ({
            value,
            label: `${value}×`,
            hint: value <= 2 ? "Minimum" : value >= 5 ? "Sportlich" : "Solide",
          })),
          selected: goals.workoutsPerWeek,
          onSelect: (value) => {
            goals.workoutsPerWeek = value;
            /* Minutenziel automatisch mitfuehren, sonst widersprechen
               sich die beiden Zahlen. */
            goals.minutesPerWeek = value * (ctx.getState().profile.timePerDay || 20);
            ctx.refresh();
          },
        }),

        sectionHead("Tagesziele"),
        h(
          "div",
          { class: "grid-2" },
          field({
            label: "Schritte",
            control: textInput({
              value: goals.stepsPerDay,
              type: "number",
              min: 2000,
              max: 20000,
              step: 500,
              inputMode: "numeric",
              onInput: (value) => {
                goals.stepsPerDay = Number(value) || 0;
              },
            }),
          }),
          field({
            label: "Kalorien",
            control: textInput({
              value: goals.kcalPerDay,
              type: "number",
              min: 1200,
              max: 4000,
              step: 50,
              inputMode: "numeric",
              onInput: (value) => {
                goals.kcalPerDay = Number(value) || 0;
              },
            }),
            suffix: "kcal",
          })
        ),
        field({
          label: "Protein",
          control: textInput({
            value: goals.proteinPerDay,
            type: "number",
            min: 40,
            max: 250,
            step: 5,
            inputMode: "numeric",
            onInput: (value) => {
              goals.proteinPerDay = Number(value) || 0;
            },
          }),
          suffix: "g",
        })
      ),
    actions: h(
      "div",
      { class: "row", style: { width: "100%", gap: "0.5rem" } },
      h(
        "button",
        { type: "button", class: "btn btn--secondary btn--block", onClick: () => closeEditor() },
        "Abbrechen"
      ),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--primary btn--block",
          onClick: async () => {
            await ctx.update((state) => {
              state.goals.stepsPerDay = goals.stepsPerDay;
              state.goals.kcalPerDay = goals.kcalPerDay;
              state.goals.proteinPerDay = goals.proteinPerDay;
              state.goals.workoutsPerWeek = goals.workoutsPerWeek;
              state.goals.minutesPerWeek = goals.minutesPerWeek;
            });
            closeEditor();
            toast("Wochenziel gespeichert", { icon: "check" });
          },
        },
        "Speichern"
      )
    ),
  });
}

/* ==========================================================================
   Coaching
   ========================================================================== */

function coachingCard(ctx, state) {
  const coach = currentCoach(state.profile);
  const checkin = nextCheckin(state);
  const done = lastCheckin(state);
  const tasks = todayTasks(state).filter((task) => task.id === "checkin" || task.id === "nutrition");

  return card(
    { class: "card--glow" },
    cardHead(
      "Dein Coaching",
      chip(coach.active ? "Aktives Coaching" : "Pausiert", {
        variant: coach.active ? "green" : "",
        dot: coach.active,
      })
    ),

    h(
      "div",
      { class: "row", style: { marginTop: "0.25rem" } },
      h("span", { class: "avatar avatar--cool avatar--lg" }, initials(coach.name)),
      h(
        "div",
        { style: { flex: "1", minWidth: "0" } },
        h("p", { class: "card__title" }, coach.name),
        h("p", { class: "meta-dim" }, `${coach.title} · seit ${fmtDate(state.meta.createdAt.slice(0, 10))}`)
      )
    ),

    checkin
      ? h(
          "div",
          { class: "checkin-card", style: { marginTop: "1rem" } },
          h(
            "div",
            { class: "checkin-card__head" },
            iconTile("video", { size: "sm" }),
            h(
              "div",
              { style: { flex: "1", minWidth: "0" } },
              h("p", { class: "label" }, "Dein nächstes Check-in"),
              h("p", { class: "checkin-card__date" }, fmtRelativeDay(checkin.date)),
              h(
                "p",
                { class: "meta-dim" },
                daysBetween(dayKey(), checkin.date) === 0
                  ? "Heute fällig · Videogespräch mit deinem Coach"
                  : `In ${daysBetween(dayKey(), checkin.date)} Tagen · Videogespräch`
              )
            ),
            chip(
              daysBetween(dayKey(), checkin.date) === 0 ? "Heute" : "Geplant",
              { variant: daysBetween(dayKey(), checkin.date) <= 2 ? "green" : "" }
            )
          ),
          button({
            label: "Check-in öffnen",
            icon: "video",
            block: true,
            onClick: () => openCheckinSheet(ctx, checkin),
          })
        )
      : h(
          "p",
          { class: "meta-dim", style: { marginTop: "1rem" } },
          "Aktuell ist kein Check-in offen. Sobald eins ansteht, erscheint es hier und auf dem Dashboard."
        ),

    tasks.length > 0 &&
      h(
        "div",
        { style: { marginTop: "1rem" } },
        sectionHead("Deine Aufgaben"),
        h(
          "ul",
          { class: "tasks tasks--compact" },
          tasks.map((task) =>
            h(
              "li",
              { class: `task ${task.done ? "task--done" : ""}` },
              h("span", { class: "task__mark" }, Icon(task.icon, "icon icon--sm")),
              h(
                "div",
                { class: "task__body" },
                h("p", { class: "task__label" }, task.label),
                h("p", { class: "task__hint" }, task.hint)
              )
            )
          )
        )
      ),

    done &&
      h(
        "div",
        { class: "checkin-done" },
        Icon("check", "icon icon--sm"),
        h(
          "div",
          null,
          h("p", { class: "task__label" }, `Check-in vom ${fmtDate(done.date)} erledigt`),
          h("p", { class: "task__hint" }, `Stimmung ${done.mood}/5${done.note ? ` · „${done.note}"` : ""}`)
        )
      )
  );
}

/* --- Check-in bearbeiten ------------------------------------------------- */

const checkinDraft = { mood: 4, schlaf: 7, energie: 4, schmerz: 2, note: "" };

function openCheckinSheet(ctx, checkin) {
  /* `answers` fehlt bei einem Check-in, das noch nie ausgefuellt wurde —
     deshalb der Ersatzwert statt `checkin.answers.schlaf`. */
  const answers = checkin.answers || {};

  Object.assign(checkinDraft, {
    mood: checkin.mood ?? 4,
    schlaf: answers.schlaf ?? 7,
    energie: answers.energie ?? 4,
    schmerz: answers.schmerz ?? 2,
    note: checkin.note || "",
  });

  openModal({
    title: "Check-in",
    subtitle: `${fmtDateLong(checkin.date)} · fünf Fragen, keine falschen.`,
    body: () =>
      h(
        "div",
        { class: "stack stack--lg" },

        h(
          "div",
          null,
          sectionHead("Wie war die Woche?"),
          h(
            "div",
            { class: "scale" },
            [1, 2, 3, 4, 5].map((value) =>
              h(
                "button",
                {
                  type: "button",
                  class: `scale__btn ${checkinDraft.mood === value ? "scale__btn--on" : ""}`,
                  "aria-pressed": checkinDraft.mood === value ? "true" : "false",
                  "aria-label": `${value} von 5`,
                  onClick: (event) => {
                    checkinDraft.mood = value;
                    const parent = event.currentTarget.parentNode;
                    Array.from(parent.children).forEach((node) => {
                      node.classList.remove("scale__btn--on");
                      node.setAttribute("aria-pressed", "false");
                    });
                    event.currentTarget.classList.add("scale__btn--on");
                    event.currentTarget.setAttribute("aria-pressed", "true");
                  },
                },
                String(value)
              )
            )
          ),
          h(
            "p",
            { class: "meta-dim", style: { textAlign: "center", marginTop: "0.5rem" } },
            ["", "schwer", "mühsam", "geht so", "gut", "sehr gut"][checkinDraft.mood]
          )
        ),

        slider("Schlaf", "sleep", "schlaf", 1, 10, "wenig", "viel"),
        slider("Energie", "battery", "energie", 1, 10, "leer", "voll"),
        slider("Schmerzen", "shield", "schmerz", 0, 10, "keine", "starke"),

        field({
          label: "Notiz für deinen Coach",
          hint: "optional, aber oft das Hilfreichste",
          control: h("textarea", {
            class: "input input--area",
            rows: 3,
            maxLength: 300,
            placeholder: "z.B. Knie rechts nach der Einheit unruhig",
            value: checkinDraft.note,
            onInput: (event) => {
              checkinDraft.note = event.target.value;
            },
          }),
        })
      ),
    actions: h(
      "div",
      { class: "row", style: { width: "100%", gap: "0.5rem" } },
      h(
        "button",
        { type: "button", class: "btn btn--secondary btn--block", onClick: () => closeEditor() },
        "Später"
      ),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--primary btn--block",
          onClick: async () => {
            await ctx.update((state) => {
              const item = state.checkins.find((entry) => entry.id === checkin.id);
              if (!item) return;
              item.status = "erledigt";
              item.mood = checkinDraft.mood;
              item.note = checkinDraft.note;
              item.answeredAt = new Date().toISOString();
              item.answers = {
                schlaf: checkinDraft.schlaf,
                energie: checkinDraft.energie,
                schmerz: checkinDraft.schmerz,
              };
            });
            closeEditor();
            toast("Check-in gespeichert", { icon: "check", duration: 3200 });
          },
        },
        "Senden"
      )
    ),
  });
}

function slider(label, icon, key, min, max, lowText, highText) {
  return h(
    "div",
    { class: "slider-field" },
    h(
      "div",
      { class: "slider-field__head" },
      iconTile(icon, { size: "sm", variant: "plain" }),
      h("span", { class: "slider-field__label" }, label)
    ),
    h("input", {
      type: "range",
      class: "slider",
      min,
      max,
      value: checkinDraft[key],
      "aria-label": label,
      onInput: (event) => {
        checkinDraft[key] = Number(event.target.value);
        const out = event.target.parentNode.querySelector(".slider__value");
        if (out) out.textContent = String(event.target.value);
      },
    }),
    h(
      "div",
      { class: "slider-field__scale" },
      h("span", null, lowText),
      h("span", { class: "slider__value" }, String(checkinDraft[key])),
      h("span", null, highText)
    )
  );
}

/* ==========================================================================
   Einstellungen
   ========================================================================== */

function settingsCard(ctx, state) {
  const { settings } = state;

  return card(
    {},
    cardHead("Einstellungen"),

    sectionHead("Benachrichtigungen"),
    list(
      listRow({
        title: "Trainingserinnerung",
        sub: "Eine Nachricht, wenn eine Einheit auf dem Plan steht",
        icon: "bell",
        chevron: false,
        trailing: toggle({
          checked: settings.trainingReminder,
          label: "Trainingserinnerung",
          onChange: (value) => setSetting(ctx, "trainingReminder", value),
        }),
      }),
      listRow({
        title: "Hinweise",
        sub: "Erinnerungen für Gewicht, Ernährung und Check-ins",
        icon: "info",
        chevron: false,
        trailing: toggle({
          checked: settings.notifications,
          label: "Hinweise",
          onChange: (value) => setSetting(ctx, "notifications", value),
        }),
      })
    ),

    sectionHead("Darstellung"),
    list(
      listRow({
        title: "Dunkles Design",
        sub: "Sigma Progress ist auf Dunkelheit ausgelegt",
        icon: "moon",
        chevron: false,
        trailing: toggle({
          checked: settings.darkMode,
          label: "Dunkles Design",
          onChange: (value) => setDarkMode(ctx, value),
        }),
      }),
      listRow({
        title: "Sprache",
        sub: "Weitere Sprachen folgen",
        icon: "globe",
        chevron: false,
        trailing: select({
          value: settings.language,
          ariaLabel: "Sprache wählen",
          options: [
            { value: "de", label: "Deutsch" },
            { value: "fr", label: "Français" },
            { value: "en", label: "English" },
          ],
          onChange: (value) => setSetting(ctx, "language", value),
        }),
      }),
      listRow({
        title: "Weniger Daten",
        sub: "Fotos verkleinern, Diagrammen vereinfachen",
        icon: "database",
        chevron: false,
        trailing: toggle({
          checked: settings.reducedData,
          label: "Weniger Daten",
          onChange: (value) => setSetting(ctx, "reducedData", value),
        }),
      })
    ),

    sectionHead("Datenschutz"),
    list(
      listRow({
        title: "Meine Daten",
        sub: "Lokal gespeichert, nicht übertragen",
        icon: "lock",
        onClick: () => openPrivacySheet(),
      }),
      listRow({
        title: "Daten sichern",
        sub: "Alles als Datei herunterladen",
        icon: "download",
        onClick: () => exportData(),
      })
    )
  );
}

async function setSetting(ctx, key, value) {
  await ctx.update((state) => {
    state.settings[key] = value;
  });
}

async function setDarkMode(ctx, value) {
  document.documentElement.classList.toggle("theme-light", !value);
  await setSetting(ctx, "darkMode", value);
  toast(
    value ? "Dunkles Design aktiv" : "Helles Design aktiv — noch experimentell",
    { icon: value ? "moon" : "sun", duration: 3200 }
  );
}

/* --- Datenschutz --------------------------------------------------------- */

function openPrivacySheet() {
  openModal({
    title: "Datenschutz",
    subtitle: "Kurz gesagt: alles bleibt bei dir.",
    body: h(
      "div",
      { class: "stack" },
      ...[
        [
          "lock",
          "Alles liegt auf diesem Gerät",
          "Deine Angaben, Messwerte, Fotos und Nachrichten stehen im localStorage dieses Browsers. Sie werden nirgendwohin geschickt — die App hat keinen Server.",
        ],
        [
          "cloud-off",
          "Offline funktionsfähig",
          "Nach dem ersten Laden läuft die App ohne Verbindung. Der Service Worker hält Dateien bereit, damit nichts nachgeladen werden muss.",
        ],
        [
          "database",
          "Kein Konto im Netz, keine Werbung",
          "Das Konto prüft E-Mail und Passwort nur auf diesem Gerät — es gibt keinen Server, keine Analyse und keine Weitergabe. Beim Löschen der Browserdaten ist alles weg.",
        ],
        [
          "shield",
          "Fotos werden verkleinert",
          "Bevor ein Bild gespeichert wird, skaliert die App es auf höchstens 900 Pixel. Das schützt das 5-MB-Limit und den Speicher.",
        ],
      ].map(([icon, title, text]) =>
        h(
          "div",
          { class: "privacy-item" },
          iconTile(icon),
          h(
            "div",
            null,
            h("p", { class: "privacy-item__title" }, title),
            h("p", { class: "meta-dim" }, text)
          )
        )
      )
    ),
  });
}

/* --- Export -------------------------------------------------------------- */

function exportData() {
  try {
    const blob = new Blob([exportState()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = h("a", { href: url, download: `sigma-progress-${dayKey()}.json` });

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast("Backup heruntergeladen", { icon: "download" });
  } catch (error) {
    toast("Export nicht möglich", { icon: "help" });
  }
}

/* ==========================================================================
   Abo
   ========================================================================== */

/**
 * Das Abo im Klartext.
 *
 * Ein Tarif, ein Preis — kein Stufenvergleich, keine Sternchen. Wer kein
 * aktives Abo hat, sieht hier, dass nichts abgebucht wird, statt eine Zahl
 * zu raten. Der Kontostatus daneben (wartend, freigegeben, gesperrt) kommt
 * aus der Verwaltung und ist hier nur zu lesen.
 */
function aboCard() {
  const account = sessionAccount();
  const abo = account ? account.abo : null;
  const active = Boolean(abo && abo.active);

  return card(
    { glow: active },
    cardHead(
      "Abo",
      chip(active ? "Aktiv" : "Pausiert", { variant: active ? "green" : "warn", dot: true })
    ),

    h(
      "div",
      { class: "abo-line" },
      h(
        "div",
        null,
        h(
          "p",
          { class: "abo-line__price" },
          `${fmtNum(PRICE_EUR)} €`,
          h("span", { class: "abo-line__unit" }, " / Monat")
        ),
        h("p", { class: "meta-dim" }, "Ein Tarif, alles inklusive, monatlich kündbar.")
      ),
      iconTile("credit-card")
    ),

    list(
      listRow({ title: "App und Trainingsplan", sub: "Alle Einheiten, Fortschritt und Fotos", icon: "dumbbell", chevron: false }),
      listRow({ title: "Ernährung", sub: "Tagesziele und Kalender", icon: "utensils", chevron: false }),
      listRow({ title: "Wöchentliches Video-Check-in", sub: "Mit deinem Coach", icon: "video", chevron: false }),
      listRow({ title: "Chat mit dem Coach", sub: "Fragen zwischen den Einheiten", icon: "chat", chevron: false }),
      listRow({
        title: "Abrechnung",
        sub: active ? (abo.since ? `Aktiv seit ${fmtDate(abo.since)}` : "Aktiv") : "Zurzeit pausiert",
        icon: "credit-card",
        chevron: false,
      })
    ),

    h(
      "p",
      { class: "meta-dim", style: { marginTop: "0.75rem" } },
      active
        ? "Das Abo verlängert sich monatlich. Kündigen kannst du jederzeit im Chat."
        : "Dein Abo ist pausiert. Melde dich bei deinem Coach, wenn du weitermachen willst."
    )
  );
}

/* ==========================================================================
   Konto und Zuruecksetzen
   ========================================================================== */

const ROLE_LABELS = {
  admin: "Admin — Inhaber",
  coach: "Coach — Mitarbeiter",
  kunde: "Kunde",
};

const ACCOUNT_STATUS = {
  wartend: { label: "Wartend", variant: "warn" },
  freigegeben: { label: "Freigegeben", variant: "green" },
  abgelehnt: { label: "Abgelehnt", variant: "" },
  gesperrt: { label: "Gesperrt", variant: "warn" },
};

function accountCard(ctx, state) {
  const session = currentSession();
  const account = sessionAccount();
  const status = account ? ACCOUNT_STATUS[account.status] : null;
  const coach = currentCoach(state.profile);

  return card(
    {},
    cardHead("Konto"),
    list(
      listRow({
        title: account ? account.name : state.profile.name,
        sub: session ? session.email : "Lokales Profil",
        icon: "user",
        chevron: false,
        trailing: status
          ? chip(status.label, { variant: status.variant, dot: true })
          : chip("Angemeldet", { variant: "green" }),
      }),
      listRow({
        title: "Rolle",
        sub: account ? ROLE_LABELS[account.role] || account.role : "—",
        icon: "shield",
        chevron: false,
      }),
      listRow({
        title: "Coaching-Status",
        sub: coach.active ? "Wöchentliches Check-in aktiv" : "Pausiert",
        icon: "award",
        chevron: false,
        trailing: chip(coach.active ? "Aktiv" : "Inaktiv", {
          variant: coach.active ? "green" : "",
        }),
      }),
      listRow({
        title: "Trainingseinheiten",
        sub: `${state.workouts.history.length} im Tagebuch`,
        icon: "trophy",
        chevron: false,
      })
    ),

    h(
      "p",
      { class: "meta-dim", style: { marginTop: "0.875rem" } },
      "Dieses Konto und sein Trainingsstand liegen nur auf diesem Gerät."
    ),

    h(
      "div",
      { class: "stack", style: { marginTop: "1rem" } },
      button({
        label: "Abmelden",
        variant: "secondary",
        block: true,
        icon: "log-out",
        onClick: () => confirmSignOut(ctx),
      }),
      button({
        label: "Alle Daten zurücksetzen",
        variant: "secondary",
        block: true,
        icon: "refresh",
        onClick: () => confirmReset(ctx),
      })
    )
  );
}

function confirmSignOut(ctx) {
  confirmDialog({
    title: "Abmelden?",
    text: "Deine Trainingsdaten bleiben gespeichert. Beim nächsten Besuch meldest du dich mit deiner E-Mail-Adresse wieder an.",
    confirmLabel: "Abmelden",
    cancelLabel: "Abbrechen",
    onConfirm: () => ctx.leaveAccount(),
  });
}

function confirmReset(ctx) {
  confirmDialog({
    title: "Alles zurücksetzen?",
    text: "Gewichte, Trainingshistorie, Fotos, Ernährung und Nachrichten werden gelöscht. Der Trainingsplan wird neu aufgesetzt und du wirst abgemeldet. Das lässt sich nicht rückgängig machen.",
    confirmLabel: "Zurücksetzen",
    cancelLabel: "Abbrechen",
    danger: true,
    onConfirm: async () => {
      await reset({ onboarding: false });
      await ctx.leaveAccount();
      toast("Zurückgesetzt — melde dich wieder an.", { icon: "refresh" });
    },
  });
}

/* ==========================================================================
   Ueber die App
   ========================================================================== */

function aboutCard() {
  return card(
    { variant: "sunken" },
    h(
      "div",
      { class: "notice" },
      Icon("info", "icon icon--sm"),
      h(
        "div",
        null,
        h("p", { class: "privacy-item__title" }, "Sigma Progress"),
        h(
          "p",
          { class: "meta-dim" },
          "Prototyp, Version 1.0. Der Coach ist ein Regelwerk mit Zugriff auf deine Daten — keine KI, keine Cloud. Konten und Passwörter werden lokal auf diesem Gerät geprüft. Die nächsten Schritte: echte Konten im Backend, Video-Check-ins, Trainingspläne aus dem Backend."
        )
      )
    )
  );
}
